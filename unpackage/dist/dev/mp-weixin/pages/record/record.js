"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_notification = require("../../utils/notification.js");
const common_assets = require("../../common/assets.js");
const HOMEWORK_KEY = "homework_list";
const SUBJECT_KEY = "subject_list";
const DEFAULT_DEADLINE_OFFSET_KEY = "default_deadline_offset_hours";
const DEFAULT_DEADLINE_OFFSET_HOURS = 24;
const DEFAULT_REMINDER_OFFSET_KEY = "default_reminder_offset_hours";
const DEFAULT_REMINDER_OFFSET_HOURS = 23;
const DEFAULT_SUBJECTS = ["高等数学", "大学英语", "程序设计", "数据结构", "线性代数"];
const PRELOAD_ICON_PATHS = [
  "/static/audio.png",
  "/static/camera.png",
  "/static/logo.png",
  "/static/more.png",
  "/static/plus.png",
  "/static/send.png",
  "/static/setting-active.png",
  "/static/setting.png",
  "/static/stop.png",
  "/static/tab-record-active.png",
  "/static/tab-record.png",
  "/static/tab-view-active.png",
  "/static/tab-view.png"
];
let viewPagePreloaded = false;
let iconImagesPreloaded = false;
const _sfc_main = {
  data() {
    return {
      homeworkList: [],
      subjectList: [],
      showForm: false,
      showPhotoAction: false,
      inputFocused: false,
      newSubjectName: "",
      editingId: "",
      isRecording: false,
      isRecordStopping: false,
      recordCanceled: false,
      recordStartTime: 0,
      recorderManager: null,
      form: this.createEmptyForm()
    };
  },
  computed: {
    subjectNames() {
      return this.subjectList.map((item) => item.name);
    },
    hasAttachment() {
      return Boolean(this.form.imagePaths.length || this.form.audios.length);
    },
    inputLineCount() {
      const text = this.form.note || "";
      if (!text)
        return 1;
      const visualLines = text.split("\n").reduce((total, line) => {
        return total + Math.max(1, Math.ceil(line.length / 18));
      }, 0);
      return Math.min(4, visualLines);
    },
    messageInputHeight() {
      return Math.min(206, 82 + (this.inputLineCount - 1) * 48);
    },
    inputBarStyle() {
      if (!this.inputFocused && !this.form.note.trim() && !this.hasAttachment)
        return "";
      return `height: ${Math.min(320, 114 + this.messageInputHeight)}rpx;`;
    },
    messageInputStyle() {
      if (!this.inputFocused && !this.form.note.trim() && !this.hasAttachment)
        return "";
      return `height: ${this.messageInputHeight}rpx;`;
    }
  },
  onLoad() {
    this.loadSubjects();
    this.loadHomework();
    this.initRecorder();
  },
  onShow() {
    this.loadHomework();
  },
  onUnload() {
    if (this.isRecording) {
      this.cancelVoiceRecord();
    }
  },
  onReady() {
    this.preloadViewPage();
    this.preloadIconImages();
  },
  methods: {
    preloadIconImages() {
      if (iconImagesPreloaded)
        return;
      iconImagesPreloaded = true;
      const preloadNext = (index) => {
        const src = PRELOAD_ICON_PATHS[index];
        if (!src)
          return;
        common_vendor.index.getImageInfo({
          src,
          complete: () => preloadNext(index + 1)
        });
      };
      preloadNext(0);
    },
    preloadViewPage() {
      if (viewPagePreloaded || typeof common_vendor.index.preloadPage !== "function")
        return;
      viewPagePreloaded = true;
      common_vendor.index.preloadPage({
        url: "/pages/view/view",
        fail: () => {
          viewPagePreloaded = false;
        }
      });
      common_vendor.index.preloadPage({
        url: "/pages/settings/settings"
      });
    },
    createEmptyForm() {
      const deadline = this.getDefaultDeadlineDate();
      return {
        subject: "",
        deadlineDate: this.formatDate(deadline),
        deadlineTime: this.formatTime(deadline),
        reminderOffsetHours: `${this.getDefaultReminderOffsetHours()}`,
        imagePaths: [],
        audios: [],
        imagePath: "",
        audioPath: "",
        audioDuration: 0,
        note: ""
      };
    },
    logAudioRecord(step, detail = {}) {
      common_vendor.index.__f__("log", "at pages/record/record.vue:281", `[作业助手][录音] ${step}`, {
        ...detail,
        isRecording: this.isRecording,
        isRecordStopping: this.isRecordStopping,
        recordCanceled: this.recordCanceled,
        recordStartTime: this.recordStartTime,
        audioCount: this.form.audios.length,
        time: (/* @__PURE__ */ new Date()).toISOString()
      });
    },
    resetRecordingUiState(reason) {
      this.isRecording = false;
      this.inputFocused = false;
      this.logAudioRecord("录音 UI 状态已重置", { reason });
      this.$nextTick(() => {
        if (this.isRecording) {
          this.isRecording = false;
          this.logAudioRecord("录音 UI 状态二次兜底重置", { reason });
        }
      });
    },
    resetRecordingRuntimeState(reason) {
      this.isRecording = false;
      this.isRecordStopping = false;
      this.recordCanceled = false;
      this.recordStartTime = 0;
      this.logAudioRecord("录音运行状态已重置", { reason });
    },
    initRecorder() {
      if (this.recorderManager) {
        this.logAudioRecord("录音管理器已存在，跳过重复初始化");
        return;
      }
      if (typeof common_vendor.index.getRecorderManager !== "function") {
        this.logAudioRecord("当前运行环境不支持 uni.getRecorderManager");
        common_vendor.index.showToast({ title: "当前环境不支持录音", icon: "none" });
        return;
      }
      this.recorderManager = common_vendor.index.getRecorderManager();
      this.logAudioRecord("录音管理器初始化完成");
      this.recorderManager.onStart(() => {
        this.logAudioRecord("录音开始回调触发");
      });
      this.recorderManager.onStop(async (res) => {
        const rawDurationMs = Number(res && res.duration || 0);
        const elapsedMs = this.recordStartTime ? Date.now() - this.recordStartTime : 0;
        const durationMs = rawDurationMs || elapsedMs;
        const duration = Math.ceil(durationMs / 1e3);
        const canceled = this.recordCanceled;
        this.logAudioRecord("录音停止回调触发", {
          res,
          rawDurationMs,
          elapsedMs,
          durationMs,
          duration,
          canceled,
          tempFilePath: res && res.tempFilePath
        });
        this.resetRecordingUiState("onStop");
        if (canceled) {
          this.resetRecordingRuntimeState("onStop canceled");
          this.logAudioRecord("录音已取消，不保存文件");
          return;
        }
        if (durationMs < 800) {
          this.resetRecordingRuntimeState("onStop too short");
          this.logAudioRecord("录音时间太短，不保存文件", { durationMs, res });
          common_vendor.index.showToast({ title: "录音时间太短，请重试", icon: "none" });
          return;
        }
        if (!res || !res.tempFilePath) {
          this.resetRecordingRuntimeState("onStop empty tempFilePath");
          this.logAudioRecord("录音停止但没有返回 tempFilePath", { res });
          common_vendor.index.showToast({ title: "录音文件无效，请重试", icon: "none" });
          return;
        }
        try {
          await this.attachAudioHomework(res.tempFilePath, duration);
          this.resetRecordingRuntimeState("onStop attachAudioHomework done");
          this.resetRecordingUiState("onStop attachAudioHomework done");
        } catch (e) {
          this.resetRecordingRuntimeState("onStop attachAudioHomework error");
          this.logAudioRecord("添加录音附件异常", { error: e });
          common_vendor.index.showToast({ title: "录音保存失败，请重试", icon: "none" });
        }
      });
      this.recorderManager.onError((err) => {
        this.logAudioRecord("录音错误回调触发", { err });
        this.resetRecordingUiState("onError");
        this.resetRecordingRuntimeState("onError");
        common_vendor.index.showToast({ title: "录音失败，请重试", icon: "none" });
      });
    },
    startVoiceRecord() {
      this.initRecorder();
      if (!this.recorderManager) {
        this.logAudioRecord("启动录音失败：录音管理器不存在");
        return;
      }
      if (this.isRecording || this.isRecordStopping) {
        this.logAudioRecord("启动录音被忽略：当前正在录音或正在停止录音");
        common_vendor.index.showToast({ title: "录音处理中，请稍候", icon: "none" });
        return;
      }
      this.isRecording = true;
      this.isRecordStopping = false;
      this.recordCanceled = false;
      this.recordStartTime = Date.now();
      const options = {
        duration: 6e4,
        format: "mp3"
      };
      this.logAudioRecord("准备启动录音", { options });
      try {
        this.recorderManager.start(options);
      } catch (e) {
        this.logAudioRecord("调用 recorderManager.start 抛出异常", { error: e });
        this.resetRecordingUiState("start exception");
        this.resetRecordingRuntimeState("start exception");
        common_vendor.index.showToast({ title: "录音启动失败", icon: "none" });
      }
    },
    stopVoiceRecord() {
      if (!this.recorderManager) {
        this.logAudioRecord("停止录音失败：录音管理器不存在");
        this.resetRecordingUiState("stop without recorderManager");
        this.resetRecordingRuntimeState("stop without recorderManager");
        return;
      }
      if (this.isRecordStopping) {
        this.logAudioRecord("停止录音被忽略：录音正在停止中");
        return;
      }
      if (!this.isRecording) {
        this.logAudioRecord("停止录音被忽略：当前不在录音");
        return;
      }
      this.logAudioRecord("准备停止录音");
      this.isRecordStopping = true;
      this.resetRecordingUiState("stopVoiceRecord immediate");
      try {
        this.recorderManager.stop();
      } catch (e) {
        this.logAudioRecord("调用 recorderManager.stop 抛出异常", { error: e });
        this.resetRecordingUiState("stop exception");
        this.resetRecordingRuntimeState("stop exception");
        common_vendor.index.showToast({ title: "停止录音失败", icon: "none" });
      }
    },
    toggleVoiceRecord() {
      this.logAudioRecord("切换录音状态");
      if (this.isRecordStopping) {
        this.logAudioRecord("切换录音状态被忽略：录音正在停止中");
        common_vendor.index.showToast({ title: "录音处理中，请稍候", icon: "none" });
        return;
      }
      if (this.isRecording) {
        this.stopVoiceRecord();
        return;
      }
      this.startVoiceRecord();
    },
    cancelVoiceRecord() {
      this.logAudioRecord("准备取消录音");
      if (this.recorderManager && this.isRecording && !this.isRecordStopping) {
        this.recordCanceled = true;
        this.isRecordStopping = true;
        this.resetRecordingUiState("cancelVoiceRecord immediate");
        try {
          this.recorderManager.stop();
        } catch (e) {
          this.logAudioRecord("取消录音时 stop 抛出异常", { error: e });
          this.resetRecordingUiState("cancel exception");
          this.resetRecordingRuntimeState("cancel exception");
        }
        return;
      }
      this.resetRecordingUiState("cancel without active recording");
      if (!this.isRecordStopping) {
        this.resetRecordingRuntimeState("cancel without active recording");
      }
    },
    async saveAudioFile(tempFilePath) {
      this.logAudioRecord("准备保存录音文件", { tempFilePath, hasSaveFile: typeof common_vendor.index.saveFile === "function" });
      if (!tempFilePath) {
        this.logAudioRecord("保存录音失败：tempFilePath 为空");
        common_vendor.index.showToast({ title: "录音文件无效，请重试", icon: "none" });
        return "";
      }
      if (typeof common_vendor.index.saveFile !== "function") {
        this.logAudioRecord("当前环境不支持 uni.saveFile，使用临时路径作为录音附件", { tempFilePath });
        return tempFilePath;
      }
      try {
        const res = await new Promise((resolve, reject) => {
          common_vendor.index.saveFile({
            tempFilePath,
            success: resolve,
            fail: reject
          });
        });
        const savedFilePath = res.savedFilePath || res.filePath || "";
        this.logAudioRecord("uni.saveFile 返回结果", { res, savedFilePath });
        if (!savedFilePath) {
          this.logAudioRecord("uni.saveFile 未返回保存路径，回退到临时路径", { res, tempFilePath });
          return tempFilePath;
        }
        return savedFilePath;
      } catch (e) {
        this.logAudioRecord("uni.saveFile 保存失败，回退到临时路径", { error: e, tempFilePath });
        return tempFilePath;
      }
    },
    async attachAudioHomework(audioPath, duration) {
      this.logAudioRecord("准备添加录音附件", { audioPath, duration });
      const savedAudioPath = await this.saveAudioFile(audioPath);
      if (!savedAudioPath) {
        this.logAudioRecord("添加录音附件失败：保存路径为空", { audioPath, duration });
        return;
      }
      this.form.audios.push({
        path: savedAudioPath,
        duration
      });
      this.syncLegacyAttachmentFields();
      this.form.subject = this.subjectNames[0] || "";
      this.showPhotoAction = true;
      this.logAudioRecord("录音附件已添加到表单", {
        savedAudioPath,
        duration,
        audios: this.form.audios,
        audioPath: this.form.audioPath,
        audioDuration: this.form.audioDuration
      });
      common_vendor.index.showToast({ title: "录音已添加", icon: "success" });
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
    loadHomework() {
      const saved = common_vendor.index.getStorageSync(HOMEWORK_KEY);
      this.homeworkList = Array.isArray(saved) ? saved : [];
    },
    saveSubjects() {
      common_vendor.index.setStorageSync(SUBJECT_KEY, this.subjectList);
    },
    saveHomeworkList() {
      common_vendor.index.setStorageSync(HOMEWORK_KEY, this.homeworkList);
    },
    takePhoto() {
      common_vendor.index.chooseImage({
        count: 1,
        sourceType: ["camera"],
        success: (res) => {
          this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || []);
          this.syncLegacyAttachmentFields();
          this.form.subject = this.subjectNames[0] || "";
          this.showPhotoAction = true;
        },
        fail: () => {
          common_vendor.index.showToast({ title: "未完成拍照", icon: "none" });
        }
      });
    },
    chooseImage() {
      common_vendor.index.chooseImage({
        count: 9,
        sourceType: ["album", "camera"],
        success: (res) => {
          this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || []);
          this.syncLegacyAttachmentFields();
          this.form.subject = this.subjectNames[0] || "";
          this.showPhotoAction = !this.showForm;
        },
        fail: () => {
          common_vendor.index.showToast({ title: "未选择图片", icon: "none" });
        }
      });
    },
    closePhotoAction() {
      this.showPhotoAction = false;
    },
    removeImageAttachment(index) {
      this.form.imagePaths.splice(index, 1);
      this.syncLegacyAttachmentFields();
      if (!this.hasAttachment) {
        this.showPhotoAction = false;
      }
    },
    removeAudioAttachment(index) {
      this.form.audios.splice(index, 1);
      this.syncLegacyAttachmentFields();
      if (!this.hasAttachment) {
        this.showPhotoAction = false;
      }
    },
    removeAttachment() {
      this.form.imagePaths = [];
      this.form.audios = [];
      this.syncLegacyAttachmentFields();
      this.showPhotoAction = false;
    },
    removePhoto() {
      this.removeImageAttachment(0);
    },
    syncLegacyAttachmentFields() {
      const firstAudio = this.form.audios[0] || {};
      this.form.imagePath = this.form.imagePaths[0] || "";
      this.form.audioPath = firstAudio.path || "";
      this.form.audioDuration = firstAudio.duration || 0;
    },
    openForm() {
      if (!this.form.note.trim() && !this.hasAttachment) {
        common_vendor.index.showToast({ title: "请输入作业内容或添加附件", icon: "none" });
        return;
      }
      this.form.subject = this.subjectNames[0] || "";
      this.showPhotoAction = false;
      this.showForm = true;
    },
    onSubjectChange(event) {
      this.form.subject = this.subjectNames[event.detail.value];
    },
    onDateChange(event) {
      this.form.deadlineDate = event.detail.value;
    },
    onTimeChange(event) {
      this.form.deadlineTime = event.detail.value;
    },
    addSubject() {
      const name = this.newSubjectName.trim();
      if (!name) {
        common_vendor.index.showToast({ title: "请输入学科名称", icon: "none" });
        return;
      }
      const exists = this.subjectList.some((item) => item.name === name);
      if (!exists) {
        this.subjectList.unshift({
          id: this.createId(),
          name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        this.saveSubjects();
      }
      this.form.subject = name;
      this.newSubjectName = "";
      common_vendor.index.showToast({ title: exists ? "已选择该学科" : "学科已新建", icon: "none" });
    },
    async saveHomework() {
      if (!this.hasAttachment && !this.form.note.trim()) {
        common_vendor.index.showToast({ title: "请输入作业内容或添加附件", icon: "none" });
        return;
      }
      if (!this.form.subject) {
        common_vendor.index.showToast({ title: "请选择学科", icon: "none" });
        return;
      }
      if (!this.form.deadlineDate || !this.form.deadlineTime) {
        common_vendor.index.showToast({ title: "请选择截止时间", icon: "none" });
        return;
      }
      const deadline = `${this.form.deadlineDate}T${this.form.deadlineTime}:00`;
      const reminderOffsetHours = Number(this.form.reminderOffsetHours);
      if (!Number.isInteger(reminderOffsetHours) || reminderOffsetHours <= 0 || reminderOffsetHours > 168) {
        common_vendor.index.showToast({ title: "提醒时间需为 1-168 小时", icon: "none" });
        return;
      }
      this.loadHomework();
      if (this.editingId) {
        const index = this.homeworkList.findIndex((item) => item.id === this.editingId);
        if (index !== -1) {
          this.syncLegacyAttachmentFields();
          this.homeworkList[index] = {
            ...this.homeworkList[index],
            subject: this.form.subject,
            deadline,
            deadlineDate: this.form.deadlineDate,
            deadlineTime: this.form.deadlineTime,
            reminderOffsetHours,
            imagePaths: [...this.form.imagePaths],
            audios: this.form.audios.map((item) => ({ ...item })),
            imagePath: this.form.imagePath,
            audioPath: this.form.audioPath,
            audioDuration: this.form.audioDuration,
            note: this.form.note.trim()
          };
          this.saveHomeworkList();
          utils_notification.resetNotificationStatus(this.homeworkList[index].id);
          utils_notification.setHomeworkReminder(this.homeworkList[index]);
        }
      } else {
        this.syncLegacyAttachmentFields();
        const newHomework = {
          id: this.createId(),
          subject: this.form.subject,
          deadline,
          deadlineDate: this.form.deadlineDate,
          deadlineTime: this.form.deadlineTime,
          imagePaths: [...this.form.imagePaths],
          audios: this.form.audios.map((item) => ({ ...item })),
          imagePath: this.form.imagePath,
          audioPath: this.form.audioPath,
          audioDuration: this.form.audioDuration,
          note: this.form.note.trim(),
          completed: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          completedAt: null
        };
        this.homeworkList.unshift(newHomework);
        this.saveHomeworkList();
        let noticeEnabled = false;
        try {
          noticeEnabled = await utils_notification.requestNotificationPermission();
        } catch (e) {
          common_vendor.index.__f__("warn", "at pages/record/record.vue:717", "通知权限请求失败：", e);
        }
        if (noticeEnabled) {
          utils_notification.setHomeworkReminder(newHomework);
        }
      }
      this.resetForm();
      common_vendor.index.showToast({ title: this.editingId ? "已更新" : "已保存", icon: "success" });
    },
    closeForm() {
      if (this.isRecording) {
        this.cancelVoiceRecord();
      }
      this.showForm = false;
      this.showPhotoAction = this.hasAttachment;
    },
    resetForm() {
      this.showForm = false;
      this.showPhotoAction = false;
      this.editingId = "";
      this.newSubjectName = "";
      this.form = this.createEmptyForm();
    },
    playAudio(path) {
      if (!path)
        return;
      const audio = common_vendor.index.createInnerAudioContext();
      audio.src = path;
      audio.onEnded(() => audio.destroy());
      audio.onError(() => {
        audio.destroy();
        common_vendor.index.showToast({ title: "语音播放失败", icon: "none" });
      });
      audio.play();
    },
    previewImage(path) {
      if (!path)
        return;
      common_vendor.index.previewImage({ urls: this.form.imagePaths.length ? this.form.imagePaths : [path], current: path });
    },
    formatDate(date) {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, "0");
      const day = `${date.getDate()}`.padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    formatTime(date) {
      const hour = `${date.getHours()}`.padStart(2, "0");
      const minute = `${date.getMinutes()}`.padStart(2, "0");
      return `${hour}:${minute}`;
    },
    getDefaultDeadlineOffsetHours() {
      const saved = Number(common_vendor.index.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY));
      return saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS;
    },
    getDefaultReminderOffsetHours() {
      const saved = Number(common_vendor.index.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY));
      return saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS;
    },
    getDefaultReminderOffsetHours() {
      const saved = Number(common_vendor.index.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY));
      return saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS;
    },
    getDefaultDeadlineDate() {
      const deadline = /* @__PURE__ */ new Date();
      deadline.setHours(deadline.getHours() + this.getDefaultDeadlineOffsetHours());
      return deadline;
    },
    createId() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.takePhoto && $options.takePhoto(...args)),
    b: $data.showPhotoAction
  }, $data.showPhotoAction ? {
    c: common_vendor.f($data.form.imagePaths, (path, index, i0) => {
      return {
        a: path,
        b: common_vendor.o(($event) => $options.previewImage(path), `image-${index}-${path}`),
        c: common_vendor.o(($event) => $options.removeImageAttachment(index), `image-${index}-${path}`),
        d: `image-${index}-${path}`
      };
    }),
    d: common_assets._imports_2,
    e: common_vendor.f($data.form.audios, (audio, index, i0) => {
      return {
        a: common_vendor.t(audio.duration || 1),
        b: common_vendor.o(($event) => $options.removeAudioAttachment(index), `audio-${index}-${audio.path}`),
        c: `audio-${index}-${audio.path}`,
        d: common_vendor.o(($event) => $options.playAudio(audio.path), `audio-${index}-${audio.path}`)
      };
    }),
    f: common_assets._imports_1,
    g: common_assets._imports_2,
    h: common_vendor.o(() => {
    }),
    i: common_vendor.o((...args) => $options.closePhotoAction && $options.closePhotoAction(...args))
  } : {}, {
    j: !$data.isRecording
  }, !$data.isRecording ? common_vendor.e({
    k: $data.isRecording ? "/static/stop.png" : "/static/audio.png",
    l: common_vendor.n($data.isRecording ? "recording" : ""),
    m: common_vendor.o((...args) => $options.toggleVoiceRecord && $options.toggleVoiceRecord(...args)),
    n: common_vendor.s($options.messageInputStyle),
    o: $data.isRecording ? "正在录音，再点一次停止..." : "文字记录",
    p: common_vendor.o(($event) => $data.inputFocused = true),
    q: common_vendor.o(($event) => $data.inputFocused = false),
    r: $data.form.note,
    s: common_vendor.o(($event) => $data.form.note = $event.detail.value),
    t: !$options.hasAttachment && !$data.form.note.trim()
  }, !$options.hasAttachment && !$data.form.note.trim() ? {
    v: common_assets._imports_2$1
  } : {
    w: common_assets._imports_3
  }, {
    x: common_vendor.o(($event) => $options.hasAttachment || $data.form.note.trim() ? $options.chooseImage() : $options.takePhoto()),
    y: !$options.hasAttachment && !$data.form.note.trim()
  }, !$options.hasAttachment && !$data.form.note.trim() ? {
    z: common_assets._imports_3
  } : {
    A: common_assets._imports_4
  }, {
    B: common_vendor.n($options.hasAttachment || $data.form.note.trim() ? "next" : ""),
    C: common_vendor.o(($event) => $options.hasAttachment || $data.form.note.trim() ? $options.openForm() : $options.chooseImage()),
    D: common_vendor.n($data.inputFocused || $data.form.note.trim() || $options.hasAttachment ? "expanded" : ""),
    E: common_vendor.s($options.inputBarStyle)
  }) : {}, {
    F: $data.isRecording
  }, $data.isRecording ? {
    G: common_vendor.o((...args) => $options.stopVoiceRecord && $options.stopVoiceRecord(...args))
  } : {}, {
    H: $data.showForm
  }, $data.showForm ? common_vendor.e({
    I: common_vendor.t($data.editingId ? "编辑作业" : $options.hasAttachment ? "保存作业" : "保存文字作业"),
    J: common_vendor.o((...args) => $options.closeForm && $options.closeForm(...args)),
    K: common_vendor.o((...args) => $options.chooseImage && $options.chooseImage(...args)),
    L: common_vendor.t($data.isRecording ? "停止录音" : "添加录音"),
    M: common_vendor.n($data.isRecording ? "recording" : ""),
    N: common_vendor.o((...args) => $options.toggleVoiceRecord && $options.toggleVoiceRecord(...args)),
    O: $data.form.imagePaths.length || $data.form.audios.length
  }, $data.form.imagePaths.length || $data.form.audios.length ? {
    P: common_vendor.f($data.form.imagePaths, (path, index, i0) => {
      return {
        a: path,
        b: common_vendor.o(($event) => $options.previewImage(path), `form-image-${index}-${path}`),
        c: common_vendor.o(($event) => $options.removeImageAttachment(index), `form-image-${index}-${path}`),
        d: `form-image-${index}-${path}`
      };
    }),
    Q: common_assets._imports_2,
    R: common_vendor.f($data.form.audios, (audio, index, i0) => {
      return {
        a: common_vendor.t(audio.duration || 1),
        b: common_vendor.o(($event) => $options.removeAudioAttachment(index), `form-audio-${index}-${audio.path}`),
        c: `form-audio-${index}-${audio.path}`,
        d: common_vendor.o(($event) => $options.playAudio(audio.path), `form-audio-${index}-${audio.path}`)
      };
    }),
    S: common_assets._imports_1,
    T: common_assets._imports_2
  } : {}, {
    U: common_vendor.t($data.form.subject || "从已建学科中选择"),
    V: $options.subjectNames,
    W: common_vendor.o((...args) => $options.onSubjectChange && $options.onSubjectChange(...args)),
    X: $data.newSubjectName,
    Y: common_vendor.o(($event) => $data.newSubjectName = $event.detail.value),
    Z: common_vendor.o((...args) => $options.addSubject && $options.addSubject(...args)),
    aa: common_vendor.t($data.form.deadlineDate || "选择日期"),
    ab: $data.form.deadlineDate,
    ac: common_vendor.o((...args) => $options.onDateChange && $options.onDateChange(...args)),
    ad: common_vendor.t($data.form.deadlineTime || "选择时间"),
    ae: $data.form.deadlineTime,
    af: common_vendor.o((...args) => $options.onTimeChange && $options.onTimeChange(...args)),
    ag: $data.form.reminderOffsetHours,
    ah: common_vendor.o(($event) => $data.form.reminderOffsetHours = $event.detail.value),
    ai: common_vendor.t($options.hasAttachment ? "备注" : "作业内容"),
    aj: $options.hasAttachment ? "例如：第 3 章习题、需要提交实验报告" : "请输入老师布置的作业内容",
    ak: $data.form.note,
    al: common_vendor.o(($event) => $data.form.note = $event.detail.value),
    am: common_vendor.t($data.editingId ? "保存修改" : $options.hasAttachment ? "保存到看板" : "保存文字作业"),
    an: common_vendor.o((...args) => $options.saveHomework && $options.saveHomework(...args)),
    ao: common_vendor.o(() => {
    }),
    ap: common_vendor.o((...args) => $options.closeForm && $options.closeForm(...args))
  }) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/record/record.js.map
