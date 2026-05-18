"use strict";
const common_vendor = require("../common/vendor.js");
const NOTIFIED_KEY = "notified_homework_ids";
const NOTICE_STATUS_KEY = "homework_notice_enabled";
const NOTICE_FIRST_REQUEST_KEY = "homework_notice_first_requested";
const NOTICE_TEMPLATE_ID = "_VTD5RnbyzssDWFq7RhAuOavo1BZB8FUro6mNNwODfc";
let notificationPermission = false;
function limitText(text, maxLength) {
  return `${text || ""}`.slice(0, maxLength);
}
function formatWechatNoticeTime(deadline) {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime()))
    return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
function buildWechatTemplateData(homework) {
  return {
    thing1: {
      value: limitText(`${homework.subject || "作业"}${homework.note ? `：${homework.note}` : ""}`, 20)
    },
    time3: {
      value: formatWechatNoticeTime(homework.deadline)
    },
    thing5: {
      value: "作业即将截止，请及时完成"
    },
    phrase6: {
      value: homework.completed ? "已完成" : "即将失效"
    }
  };
}
function getNotifiedIds() {
  try {
    return common_vendor.index.getStorageSync(NOTIFIED_KEY) || [];
  } catch (e) {
    return [];
  }
}
function markAsNotified(homeworkId) {
  const ids = getNotifiedIds();
  if (!ids.includes(homeworkId)) {
    ids.push(homeworkId);
    common_vendor.index.setStorageSync(NOTIFIED_KEY, ids);
  }
}
function isNotified(homeworkId) {
  return getNotifiedIds().includes(homeworkId);
}
function setNoticeStatus(enabled) {
  notificationPermission = enabled;
  common_vendor.index.setStorageSync(NOTICE_STATUS_KEY, enabled);
}
function getWechatSubscribeApi() {
  if (typeof common_vendor.index.requestSubscribeMessage === "function")
    return common_vendor.index.requestSubscribeMessage;
  if (typeof common_vendor.wx$1 !== "undefined" && typeof common_vendor.wx$1.requestSubscribeMessage === "function") {
    return common_vendor.wx$1.requestSubscribeMessage;
  }
  return null;
}
function isTemplateReady() {
  return !NOTICE_TEMPLATE_ID.includes("请替换");
}
function getNotificationPermissionStatus() {
  try {
    notificationPermission = !!common_vendor.index.getStorageSync(NOTICE_STATUS_KEY);
    return notificationPermission;
  } catch (e) {
    return notificationPermission;
  }
}
function shouldRequestNotificationOnFirstLaunch() {
  return !common_vendor.index.getStorageSync(NOTICE_FIRST_REQUEST_KEY);
}
function resetNotificationStatus(homeworkId) {
  const ids = getNotifiedIds();
  const index = ids.indexOf(homeworkId);
  if (index !== -1) {
    ids.splice(index, 1);
    common_vendor.index.setStorageSync(NOTIFIED_KEY, ids);
  }
}
function getPlatform() {
  return "mp-weixin";
}
async function requestNotificationPermission(options = {}) {
  const { silent = false, showToast = false } = options;
  const platform = getPlatform();
  common_vendor.index.setStorageSync(NOTICE_FIRST_REQUEST_KEY, true);
  try {
    if (platform === "mp-weixin") {
      const requestSubscribeMessage = getWechatSubscribeApi();
      if (!requestSubscribeMessage) {
        if (!silent)
          common_vendor.index.showToast({ title: "当前环境不支持服务通知", icon: "none" });
        setNoticeStatus(false);
        return false;
      }
      if (!isTemplateReady()) {
        if (!silent)
          common_vendor.index.showToast({ title: "请先配置订阅消息模板ID", icon: "none" });
        setNoticeStatus(false);
        return false;
      }
      const res = await new Promise((resolve) => {
        requestSubscribeMessage({
          tmplIds: [NOTICE_TEMPLATE_ID],
          success: resolve,
          fail: (err) => resolve({ errMsg: err.errMsg || "fail" })
        });
      });
      const enabled = res[NOTICE_TEMPLATE_ID] === "accept";
      setNoticeStatus(enabled);
      if (showToast || !silent) {
        common_vendor.index.showToast({ title: enabled ? "通知已开启" : "未开启通知", icon: "none" });
      }
      return enabled;
    }
    if (platform === "app-android" || platform === "app-ios") {
      setNoticeStatus(true);
      if (showToast)
        common_vendor.index.showToast({ title: "通知已开启", icon: "success" });
      return true;
    }
  } catch (e) {
    common_vendor.index.__f__("error", "at utils/notification.js:157", "请求通知权限失败：", e);
  }
  setNoticeStatus(false);
  return false;
}
function requestNotificationPermissionOnFirstLaunch() {
  if (!shouldRequestNotificationOnFirstLaunch())
    return;
  setTimeout(() => {
    requestNotificationPermission({ silent: true });
  }, 800);
}
function sendLocalNotification(options) {
  const { title, content, delay = 0, id, homework } = options;
  const platform = getPlatform();
  if (platform === "mp-weixin") {
    sendWechatServiceNotification(title, content, id, homework);
  }
}
function sendWechatServiceNotification(title, content, id, homework) {
  if (!getNotificationPermissionStatus())
    return;
  const templateData = buildWechatTemplateData(homework || {});
  common_vendor.index.$emit("homework-service-notice", {
    id,
    templateId: NOTICE_TEMPLATE_ID,
    page: "/pages/view/view",
    data: templateData,
    title,
    content,
    homework,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  common_vendor.index.showModal({
    title,
    content: `${content}`,
    showCancel: false
  });
}
function setHomeworkReminder(homework) {
  if (homework.completed)
    return;
  if (isNotified(homework.id))
    return;
  const deadlineTime = new Date(homework.deadline).getTime();
  const now = Date.now();
  const reminderOffsetHours = Number(homework.reminderOffsetHours) > 0 ? Number(homework.reminderOffsetHours) : 23;
  const reminderTime = deadlineTime - reminderOffsetHours * 60 * 60 * 1e3;
  if (deadlineTime <= now)
    return;
  if (reminderTime > now)
    return;
  sendLocalNotification({
    title: "作业即将截止",
    content: `“${homework.subject}”的作业将在${reminderOffsetHours}小时内截止，请及时完成！`,
    delay: 0,
    id: homework.id,
    homework
  });
  markAsNotified(homework.id);
}
function checkAndSetReminders(homeworkList) {
  homeworkList.forEach((homework) => {
    if (!homework.completed) {
      setHomeworkReminder(homework);
    }
  });
}
exports.checkAndSetReminders = checkAndSetReminders;
exports.getNotificationPermissionStatus = getNotificationPermissionStatus;
exports.requestNotificationPermission = requestNotificationPermission;
exports.requestNotificationPermissionOnFirstLaunch = requestNotificationPermissionOnFirstLaunch;
exports.resetNotificationStatus = resetNotificationStatus;
exports.setHomeworkReminder = setHomeworkReminder;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/notification.js.map
