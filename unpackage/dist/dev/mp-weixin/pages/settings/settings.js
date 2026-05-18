"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_notification = require("../../utils/notification.js");
const SUBJECT_KEY = "subject_list";
const HOMEWORK_KEY = "homework_list";
const DEFAULT_DEADLINE_OFFSET_KEY = "default_deadline_offset_hours";
const DEFAULT_DEADLINE_OFFSET_HOURS = 24;
const DEFAULT_REMINDER_OFFSET_KEY = "default_reminder_offset_hours";
const DEFAULT_REMINDER_OFFSET_HOURS = 23;
const DEFAULT_SUBJECTS = ["高等数学", "大学英语", "程序设计", "数据结构", "线性代数"];
const _sfc_main = {
  data() {
    return {
      subjectList: [],
      newSubjectName: "",
      noticeEnabled: false,
      defaultDeadlineOffsetHours: `${DEFAULT_DEADLINE_OFFSET_HOURS}`,
      defaultReminderOffsetHours: `${DEFAULT_REMINDER_OFFSET_HOURS}`
    };
  },
  onShow() {
    this.loadSubjects();
    this.loadNoticeStatus();
    this.loadDefaultDeadlineOffset();
    this.loadDefaultReminderOffset();
  },
  methods: {
    loadNoticeStatus() {
      this.noticeEnabled = utils_notification.getNotificationPermissionStatus();
    },
    async requestNoticePermission() {
      const enabled = await utils_notification.requestNotificationPermission({ showToast: true });
      this.noticeEnabled = enabled;
    },
    loadDefaultDeadlineOffset() {
      const saved = Number(common_vendor.index.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY));
      this.defaultDeadlineOffsetHours = `${saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS}`;
    },
    loadDefaultReminderOffset() {
      const saved = Number(common_vendor.index.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY));
      this.defaultReminderOffsetHours = `${saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS}`;
    },
    saveDefaultReminderOffset() {
      const hours = Number(this.defaultReminderOffsetHours);
      if (!Number.isInteger(hours) || hours <= 0 || hours > 168) {
        common_vendor.index.showToast({ title: "请输入 1-168 小时", icon: "none" });
        this.loadDefaultReminderOffset();
        return;
      }
      common_vendor.index.setStorageSync(DEFAULT_REMINDER_OFFSET_KEY, hours);
      this.defaultReminderOffsetHours = `${hours}`;
      common_vendor.index.showToast({ title: "已保存", icon: "success" });
    },
    saveDefaultDeadlineOffset() {
      const hours = Number(this.defaultDeadlineOffsetHours);
      if (!Number.isInteger(hours) || hours <= 0 || hours > 168) {
        common_vendor.index.showToast({ title: "请输入 1-168 小时", icon: "none" });
        this.loadDefaultDeadlineOffset();
        return;
      }
      common_vendor.index.setStorageSync(DEFAULT_DEADLINE_OFFSET_KEY, hours);
      this.defaultDeadlineOffsetHours = `${hours}`;
      common_vendor.index.showToast({ title: "已保存", icon: "success" });
    },
    loadSubjects() {
      const saved = common_vendor.index.getStorageSync(SUBJECT_KEY);
      if (Array.isArray(saved) && saved.length) {
        this.subjectList = saved;
        return;
      }
      this.subjectList = DEFAULT_SUBJECTS.map((name) => ({
        id: this.createId(),
        name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }));
      this.saveSubjects();
    },
    saveSubjects() {
      common_vendor.index.setStorageSync(SUBJECT_KEY, this.subjectList);
    },
    addSubject() {
      const name = this.newSubjectName.trim();
      if (!name) {
        common_vendor.index.showToast({ title: "请输入学科名称", icon: "none" });
        return;
      }
      if (this.subjectList.some((item) => item.name === name)) {
        common_vendor.index.showToast({ title: "学科已存在", icon: "none" });
        return;
      }
      this.subjectList.unshift({
        id: this.createId(),
        name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      this.newSubjectName = "";
      this.saveSubjects();
      common_vendor.index.showToast({ title: "已新增", icon: "success" });
    },
    renameSubject(item, value) {
      const name = value.trim();
      if (!name) {
        common_vendor.index.showToast({ title: "学科不能为空", icon: "none" });
        return;
      }
      if (name === item.name)
        return;
      if (this.subjectList.some((subject) => subject.id !== item.id && subject.name === name)) {
        common_vendor.index.showToast({ title: "学科已存在", icon: "none" });
        return;
      }
      const oldName = item.name;
      item.name = name;
      this.saveSubjects();
      this.renameHomeworkSubject(oldName, name);
      common_vendor.index.showToast({ title: "已修改", icon: "success" });
    },
    renameHomeworkSubject(oldName, newName) {
      const homeworkList = common_vendor.index.getStorageSync(HOMEWORK_KEY);
      if (!Array.isArray(homeworkList))
        return;
      const nextList = homeworkList.map((item) => {
        if (item.subject !== oldName)
          return item;
        return { ...item, subject: newName };
      });
      common_vendor.index.setStorageSync(HOMEWORK_KEY, nextList);
    },
    deleteSubject(item) {
      common_vendor.index.showModal({
        title: "删除学科",
        content: `确定删除“${item.name}”吗？已记录的作业不会被删除。`,
        confirmText: "删除",
        confirmColor: "#ef4444",
        success: (res) => {
          if (!res.confirm)
            return;
          this.subjectList = this.subjectList.filter((subject) => subject.id !== item.id);
          this.saveSubjects();
          common_vendor.index.showToast({ title: "已删除", icon: "success" });
        }
      });
    },
    clearCompletedHomework() {
      const homeworkList = common_vendor.index.getStorageSync(HOMEWORK_KEY);
      if (!Array.isArray(homeworkList) || !homeworkList.some((item) => item.completed)) {
        common_vendor.index.showToast({ title: "暂无已完成作业", icon: "none" });
        return;
      }
      const completedCount = homeworkList.filter((item) => item.completed).length;
      common_vendor.index.showModal({
        title: "清除已完成作业",
        content: `确定清除 ${completedCount} 条已完成作业吗？`,
        confirmText: "清除",
        confirmColor: "#ef4444",
        success: (res) => {
          if (!res.confirm)
            return;
          common_vendor.index.setStorageSync(HOMEWORK_KEY, homeworkList.filter((item) => !item.completed));
          common_vendor.index.showToast({ title: "已清除", icon: "success" });
        }
      });
    },
    createId() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.noticeEnabled ? "已开启" : "去授权"),
    b: common_vendor.o((...args) => $options.requestNoticePermission && $options.requestNoticePermission(...args)),
    c: $data.defaultReminderOffsetHours,
    d: common_vendor.o(($event) => $data.defaultReminderOffsetHours = $event.detail.value),
    e: common_vendor.o((...args) => $options.saveDefaultReminderOffset && $options.saveDefaultReminderOffset(...args)),
    f: $data.defaultDeadlineOffsetHours,
    g: common_vendor.o(($event) => $data.defaultDeadlineOffsetHours = $event.detail.value),
    h: common_vendor.o((...args) => $options.saveDefaultDeadlineOffset && $options.saveDefaultDeadlineOffset(...args)),
    i: $data.newSubjectName,
    j: common_vendor.o(($event) => $data.newSubjectName = $event.detail.value),
    k: common_vendor.o((...args) => $options.addSubject && $options.addSubject(...args)),
    l: $data.subjectList.length
  }, $data.subjectList.length ? {
    m: common_vendor.f($data.subjectList, (item, k0, i0) => {
      return {
        a: item.name,
        b: common_vendor.o(($event) => $options.renameSubject(item, $event.detail.value), item.id),
        c: common_vendor.o(($event) => $options.deleteSubject(item), item.id),
        d: item.id
      };
    })
  } : {}, {
    n: common_vendor.o((...args) => $options.clearCompletedHomework && $options.clearCompletedHomework(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/settings/settings.js.map
