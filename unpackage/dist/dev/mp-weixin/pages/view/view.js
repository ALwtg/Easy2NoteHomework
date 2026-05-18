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
const HOMEWORK_LOAD_BATCH_SIZE = 30;
const HOMEWORK_LOAD_INTERVAL = 90;
const _sfc_main = {
  data() {
    return {
      homeworkList: [],
      subjectList: [],
      selectedSubject: "全部",
      selectedStatus: "all",
      showForm: false,
      newSubjectName: "",
      touchStartX: 0,
      touchStartY: 0,
      touchingId: "",
      swipeOffsetX: 0,
      isHorizontalSwiping: false,
      suppressNextClick: false,
      completingId: "",
      completeTimer: null,
      longPressTriggered: false,
      editingId: "",
      form: this.createEmptyForm(),
      showImportForm: false,
      importCode: "",
      lastCopiedCode: "",
      isTopCollapsed: false,
      pageTouchStartY: 0,
      isPullingDown: false,
      lastScrollTop: 0,
      isRecording: false,
      recordCanceled: false,
      recordStartTime: 0,
      recorderManager: null,
      cardEnterActive: false,
      cardEnterTimer: null,
      visibleHomeworkCount: 0,
      loadBatchTarget: 0,
      isLoadingHomework: false,
      homeworkLoadTimer: null
    };
  },
  computed: {
    subjectNames() {
      return this.subjectList.map((item) => item.name);
    },
    subjectFilterOptions() {
      const subjects = this.homeworkList.map((item) => item.subject).filter(Boolean);
      return ["全部", .../* @__PURE__ */ new Set([...this.subjectNames, ...subjects])];
    },
    filteredHomework() {
      const subjectFiltered = this.selectedSubject === "全部" ? this.homeworkList : this.homeworkList.filter((item) => item.subject === this.selectedSubject);
      if (this.selectedStatus === "pending") {
        return subjectFiltered.filter((item) => !item.completed);
      }
      if (this.selectedStatus === "urgent") {
        return subjectFiltered.filter((item) => !item.completed && this.isUrgent(item));
      }
      if (this.selectedStatus === "completed") {
        return subjectFiltered.filter((item) => item.completed);
      }
      return subjectFiltered;
    },
    sortedHomework() {
      return [...this.filteredHomework].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        if (!a.completed && !b.completed) {
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        return new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime();
      });
    },
    visibleHomework() {
      return this.sortedHomework.slice(0, this.visibleHomeworkCount);
    },
    hasMoreHomework() {
      return this.visibleHomeworkCount < this.sortedHomework.length;
    },
    filterSummary() {
      const statusTextMap = {
        all: "",
        pending: "未完成",
        urgent: "临近截止",
        completed: "已完成"
      };
      const subjectText = this.selectedSubject === "全部" ? "全部" : this.selectedSubject;
      const statusText = statusTextMap[this.selectedStatus];
      return `${subjectText}${statusText ? ` · ${statusText}` : ""} · ${this.filteredHomework.length} 条`;
    },
    hasFormAttachment() {
      return Boolean(this.form.imagePaths.length || this.form.audios.length);
    },
    emptyTitle() {
      const statusTextMap = {
        all: "作业",
        pending: "未完成作业",
        urgent: "临近截止作业",
        completed: "已完成作业"
      };
      const prefix = this.selectedSubject === "全部" ? "暂无" : `暂无${this.selectedSubject}`;
      return `${prefix}${statusTextMap[this.selectedStatus]}`;
    },
    emptyTip() {
      if (this.selectedStatus !== "all")
        return "点击上方状态卡片可切换筛选范围";
      return this.selectedSubject === "全部" ? '点击"记录作业"标签，把黑板上的作业保存下来' : "切换其他学科，或去记录新的作业";
    },
    pendingCount() {
      return this.homeworkList.filter((item) => !item.completed).length;
    },
    completedCount() {
      return this.homeworkList.filter((item) => item.completed).length;
    },
    urgentCount() {
      return this.homeworkList.filter((item) => !item.completed && this.isUrgent(item)).length;
    }
  },
  onLoad(options = {}) {
    this.loadSubjects();
    this.loadHomework();
    this.initRecorder();
    this.handleSharedHomeworkOptions(options);
  },
  onShareAppMessage() {
    const shareCode = this.buildShareCode();
    return {
      title: `我分享了 ${this.homeworkList.length} 条作业给你`,
      path: `/pages/view/view?shareCode=${shareCode}`,
      imageUrl: "/static/logo.png"
    };
  },
  onShow() {
    this.loadHomework();
    this.checkHomeworkReminders();
    this.playCardEnterAnimation();
  },
  onUnload() {
    if (this.isRecording) {
      this.cancelFormRecord();
    }
    if (this.completeTimer) {
      clearTimeout(this.completeTimer);
      this.completeTimer = null;
    }
    this.clearCardEnterTimer();
    this.clearHomeworkLoadTimer();
  },
  onPageScroll(event) {
    const scrollTop = event.scrollTop || 0;
    this.lastScrollTop = scrollTop;
    if (scrollTop > 80 && !this.isTopCollapsed) {
      this.isTopCollapsed = true;
      return;
    }
    this.expandTopPanelAtTop(scrollTop);
  },
  onReachBottom() {
    this.loadMoreHomework();
  },
  methods: {
    onPageTouchStart(event) {
      this.pageTouchStartY = event.touches && event.touches[0] ? event.touches[0].clientY : 0;
      this.isPullingDown = false;
    },
    onPageTouchMove(event) {
      const currentY = event.touches && event.touches[0] ? event.touches[0].clientY : 0;
      this.isPullingDown = currentY - this.pageTouchStartY > 12;
      this.expandTopPanelAtTop(this.lastScrollTop);
    },
    onPageTouchEnd() {
      if (this.touchingId) {
        this.resetSwipeState();
      }
    },
    expandTopPanelAtTop(scrollTop) {
      if (scrollTop <= 0 && this.isTopCollapsed && this.isPullingDown) {
        this.isTopCollapsed = false;
        this.isPullingDown = false;
      }
    },
    expandTopPanel() {
      this.isTopCollapsed = false;
    },
    openImportForm() {
      this.showShareMenu = false;
      this.showImportForm = true;
    },
    checkHomeworkReminders() {
      utils_notification.checkAndSetReminders(this.homeworkList);
    },
    startHomeworkLoading(reset = false) {
      this.clearHomeworkLoadTimer();
      const total = this.sortedHomework.length;
      if (!total) {
        this.visibleHomeworkCount = 0;
        this.loadBatchTarget = 0;
        this.isLoadingHomework = false;
        return;
      }
      if (reset) {
        this.visibleHomeworkCount = 0;
      }
      const nextTarget = Math.min(total, this.visibleHomeworkCount + HOMEWORK_LOAD_BATCH_SIZE);
      this.loadBatchTarget = nextTarget;
      this.isLoadingHomework = this.visibleHomeworkCount < this.loadBatchTarget;
      this.loadNextHomeworkItem();
    },
    loadNextHomeworkItem() {
      if (this.visibleHomeworkCount >= this.loadBatchTarget || this.visibleHomeworkCount >= this.sortedHomework.length) {
        this.isLoadingHomework = false;
        this.clearHomeworkLoadTimer();
        return;
      }
      this.visibleHomeworkCount += 1;
      this.homeworkLoadTimer = setTimeout(() => {
        this.loadNextHomeworkItem();
      }, HOMEWORK_LOAD_INTERVAL);
    },
    loadMoreHomework() {
      if (this.isLoadingHomework || !this.hasMoreHomework)
        return;
      this.startHomeworkLoading(false);
    },
    resetHomeworkLoading() {
      this.startHomeworkLoading(true);
    },
    clearHomeworkLoadTimer() {
      if (this.homeworkLoadTimer) {
        clearTimeout(this.homeworkLoadTimer);
        this.homeworkLoadTimer = null;
      }
    },
    playCardEnterAnimation() {
      this.clearCardEnterTimer();
      this.cardEnterActive = false;
      this.$nextTick(() => {
        if (!this.visibleHomework.length)
          return;
        this.cardEnterActive = true;
        const visibleCount = Math.min(this.visibleHomework.length, 8);
        this.cardEnterTimer = setTimeout(() => {
          this.cardEnterActive = false;
          this.cardEnterTimer = null;
        }, 520 + visibleCount * 70);
      });
    },
    clearCardEnterTimer() {
      if (this.cardEnterTimer) {
        clearTimeout(this.cardEnterTimer);
        this.cardEnterTimer = null;
      }
    },
    getCardStyle(item, index) {
      const styles = [];
      if (this.cardEnterActive) {
        const delay = Math.min(index, 8) * 70;
        styles.push(`animation-delay: ${delay}ms`);
      }
      if (this.touchingId === item.id && this.swipeOffsetX) {
        const progress = Math.min(Math.abs(this.swipeOffsetX) / 120, 1);
        const rotate = Math.max(Math.min(this.swipeOffsetX / 28, 4), -4);
        styles.push(`transform: translateX(${this.swipeOffsetX}px) scale(${1 + progress * 0.015}) rotate(${rotate}deg)`);
        styles.push(`--swipe-progress: ${progress}`);
      }
      return styles.join(";");
    },
    getSwipeActionClass(item) {
      if (this.touchingId !== item.id || !this.swipeOffsetX)
        return "";
      const isActionable = !item.completed && this.swipeOffsetX > 0 || item.completed && this.swipeOffsetX < 0;
      return [this.swipeOffsetX > 0 ? "swipe-right" : "swipe-left", Math.abs(this.swipeOffsetX) >= 80 ? "swipe-ready" : "", isActionable ? "swipe-actionable" : "swipe-disabled"].filter(Boolean).join(" ");
    },
    getSwipeActionIcon(item) {
      if (!item.completed && this.swipeOffsetX > 0)
        return Math.abs(this.swipeOffsetX) >= 80 ? "✓" : "→";
      if (item.completed && this.swipeOffsetX < 0)
        return Math.abs(this.swipeOffsetX) >= 80 ? "↺" : "←";
      return "·";
    },
    getSwipeActionText(item) {
      if (!item.completed && this.swipeOffsetX > 0)
        return Math.abs(this.swipeOffsetX) >= 80 ? "松手完成" : "右滑完成";
      if (item.completed && this.swipeOffsetX < 0)
        return Math.abs(this.swipeOffsetX) >= 80 ? "松手恢复" : "左滑恢复";
      return item.completed ? "已完成，左滑恢复" : "未完成，右滑完成";
    },
    initRecorder() {
      if (this.recorderManager || typeof common_vendor.index.getRecorderManager !== "function")
        return;
      this.recorderManager = common_vendor.index.getRecorderManager();
      this.recorderManager.onStop(async (res) => {
        const duration = Math.max(1, Math.round((res.duration || 0) / 1e3 || (Date.now() - this.recordStartTime) / 1e3));
        const canceled = this.recordCanceled;
        this.isRecording = false;
        this.recordCanceled = false;
        if (!canceled && res.tempFilePath) {
          const audioPath = await this.saveAudioFile(res.tempFilePath);
          if (!audioPath)
            return;
          this.form.audios.push({
            path: audioPath,
            duration
          });
          this.syncLegacyAttachmentFields();
          common_vendor.index.showToast({ title: "录音已添加", icon: "success" });
        }
      });
      this.recorderManager.onError(() => {
        this.isRecording = false;
        this.recordCanceled = false;
        common_vendor.index.showToast({ title: "录音失败，请重试", icon: "none" });
      });
    },
    chooseFormImage() {
      common_vendor.index.chooseImage({
        count: 9,
        sourceType: ["album", "camera"],
        success: (res) => {
          this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || []);
          this.syncLegacyAttachmentFields();
        },
        fail: () => {
          common_vendor.index.showToast({ title: "未选择图片", icon: "none" });
        }
      });
    },
    startFormRecord() {
      this.initRecorder();
      if (!this.recorderManager || this.isRecording)
        return;
      this.isRecording = true;
      this.recordCanceled = false;
      this.recordStartTime = Date.now();
      this.recorderManager.start({
        duration: 6e4,
        format: "mp3"
      });
    },
    stopFormRecord() {
      if (!this.recorderManager || !this.isRecording)
        return;
      this.recorderManager.stop();
    },
    toggleFormRecord() {
      if (this.isRecording) {
        this.stopFormRecord();
        return;
      }
      this.startFormRecord();
    },
    cancelFormRecord() {
      if (this.recorderManager && this.isRecording) {
        this.recordCanceled = true;
        this.recorderManager.stop();
      }
      this.isRecording = false;
    },
    async saveAudioFile(tempFilePath) {
      if (!tempFilePath) {
        common_vendor.index.showToast({ title: "录音文件无效，请重试", icon: "none" });
        return "";
      }
      if (typeof common_vendor.index.saveFile !== "function") {
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
        if (!savedFilePath)
          throw new Error("empty savedFilePath");
        return savedFilePath;
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages/view/view.vue:608", "录音文件保存失败：", e);
        common_vendor.index.showToast({ title: "录音保存失败，请重试", icon: "none" });
        return "";
      }
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
      this.homeworkList = Array.isArray(saved) ? saved.map(this.normalizeHomeworkItem) : [];
      this.ensureSelectedSubject();
      this.resetHomeworkLoading();
    },
    ensureSelectedSubject() {
      if (this.selectedSubject === "全部")
        return;
      if (!this.subjectFilterOptions.includes(this.selectedSubject)) {
        this.selectedSubject = "全部";
      }
    },
    selectSubject(subject) {
      this.selectedSubject = subject;
      this.resetHomeworkLoading();
    },
    selectStatus(status) {
      this.selectedStatus = this.selectedStatus === status ? "all" : status;
      this.resetHomeworkLoading();
    },
    normalizeHomeworkItem(item) {
      const imagePaths = Array.isArray(item.imagePaths) ? item.imagePaths : item.imagePath ? [item.imagePath] : [];
      const audios = Array.isArray(item.audios) ? item.audios : item.audioPath ? [{ path: item.audioPath, duration: item.audioDuration || 1 }] : [];
      const firstAudio = audios[0] || {};
      return {
        ...item,
        imagePaths,
        audios,
        imagePath: imagePaths[0] || "",
        audioPath: firstAudio.path || "",
        audioDuration: firstAudio.duration || 0
      };
    },
    getImagePaths(item) {
      return Array.isArray(item.imagePaths) ? item.imagePaths : item.imagePath ? [item.imagePath] : [];
    },
    getAudios(item) {
      return Array.isArray(item.audios) ? item.audios : item.audioPath ? [{ path: item.audioPath, duration: item.audioDuration || 1 }] : [];
    },
    syncLegacyAttachmentFields() {
      const firstAudio = this.form.audios[0] || {};
      this.form.imagePath = this.form.imagePaths[0] || "";
      this.form.audioPath = firstAudio.path || "";
      this.form.audioDuration = firstAudio.duration || 0;
    },
    removeFormImageAttachment(index) {
      this.form.imagePaths.splice(index, 1);
      this.syncLegacyAttachmentFields();
    },
    removeFormAudioAttachment(index) {
      this.form.audios.splice(index, 1);
      this.syncLegacyAttachmentFields();
    },
    saveSubjects() {
      common_vendor.index.setStorageSync(SUBJECT_KEY, this.subjectList);
    },
    saveHomeworkList() {
      common_vendor.index.setStorageSync(HOMEWORK_KEY, this.homeworkList);
    },
    buildSharePayload() {
      return {
        version: 1,
        sharedAt: (/* @__PURE__ */ new Date()).toISOString(),
        items: this.homeworkList.map((item) => this.createShareableHomework(item))
      };
    },
    buildShareCode() {
      return encodeURIComponent(JSON.stringify(this.buildSharePayload()));
    },
    safeDecodeShareCode(code) {
      const raw = `${code || ""}`.trim();
      try {
        return decodeURIComponent(raw);
      } catch (e) {
        return raw;
      }
    },
    createShareableHomework(item) {
      return {
        id: item.id,
        subject: item.subject,
        deadline: item.deadline,
        deadlineDate: item.deadlineDate,
        deadlineTime: item.deadlineTime,
        reminderOffsetHours: item.reminderOffsetHours || DEFAULT_REMINDER_OFFSET_HOURS,
        note: item.note || "",
        completed: !!item.completed,
        completedAt: item.completedAt || null,
        createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
    },
    getShareItemsFromCode(code) {
      const decoded = this.safeDecodeShareCode(code);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed))
        return parsed;
      if (parsed && Array.isArray(parsed.items))
        return parsed.items;
      return [];
    },
    createImportedHomework(item) {
      const normalized = this.normalizeHomeworkItem({
        ...item,
        id: item.id || this.createId(),
        reminderOffsetHours: Number(item.reminderOffsetHours) || DEFAULT_REMINDER_OFFSET_HOURS,
        imagePaths: [],
        audios: [],
        imagePath: "",
        audioPath: "",
        audioDuration: 0,
        completed: !!item.completed,
        completedAt: item.completedAt || null,
        createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      });
      if (!normalized.deadline && normalized.deadlineDate && normalized.deadlineTime) {
        normalized.deadline = `${normalized.deadlineDate}T${normalized.deadlineTime}:00`;
      }
      return normalized;
    },
    isHomeworkImportable(item) {
      return item && item.subject && item.deadline && (item.note || item.subject);
    },
    syncImportedSubjects(items) {
      let changed = false;
      items.forEach((item) => {
        const name = item && item.subject ? `${item.subject}`.trim() : "";
        if (!name || this.subjectList.some((subject) => subject.name === name))
          return;
        this.subjectList.unshift({
          id: this.createId(),
          name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        changed = true;
      });
      if (changed)
        this.saveSubjects();
    },
    handleSharedHomeworkOptions(options = {}) {
      const shareCode = options.shareCode || "";
      if (!shareCode)
        return;
      setTimeout(() => {
        this.importShareCode(shareCode, { fromNativeShare: true });
      }, 300);
    },
    copyShareCode() {
      const shareCode = this.buildShareCode();
      common_vendor.index.setClipboardData({
        data: shareCode,
        success: () => {
          this.showShareMenu = false;
          this.lastCopiedCode = shareCode;
          common_vendor.index.showToast({ title: "分享码已复制", icon: "success" });
        }
      });
    },
    isValidShareCode(code) {
      try {
        return this.getShareItemsFromCode(code).some((item) => this.isHomeworkImportable(item));
      } catch (e) {
        return false;
      }
    },
    manualImport() {
      if (!this.importCode.trim()) {
        common_vendor.index.showToast({ title: "请输入分享码", icon: "none" });
        return;
      }
      this.importShareCode(this.importCode.trim());
    },
    async pasteFromClipboard() {
      var _a;
      try {
        const res = await common_vendor.index.getClipboardData();
        const data = res.data || ((_a = res[1]) == null ? void 0 : _a.data) || "";
        if (!data) {
          common_vendor.index.showToast({ title: "剪贴板为空", icon: "none" });
          return;
        }
        if (this.isValidShareCode(data)) {
          this.importShareCode(data);
        } else {
          this.importCode = data;
          common_vendor.index.showToast({ title: "已粘贴，请确认分享码", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "读取剪贴板失败", icon: "none" });
      }
    },
    importShareCode(code, options = {}) {
      try {
        const importedList = this.getShareItemsFromCode(code);
        if (!Array.isArray(importedList) || !importedList.length) {
          common_vendor.index.showToast({ title: "无效的分享内容", icon: "none" });
          return;
        }
        const existingKeys = new Set(this.homeworkList.map((item) => `${item.subject}|${item.deadline}|${item.note || ""}`));
        let newCount = 0;
        importedList.forEach((item) => {
          if (!this.isHomeworkImportable(item))
            return;
          const imported = this.createImportedHomework(item);
          const key = `${imported.subject}|${imported.deadline}|${imported.note || ""}`;
          if (!existingKeys.has(key)) {
            imported.id = this.createId();
            existingKeys.add(key);
            this.homeworkList.push(imported);
            newCount++;
          }
        });
        if (newCount > 0) {
          this.syncImportedSubjects(importedList);
          this.saveHomeworkList();
          this.homeworkList.forEach((item) => {
            if (!item.completed)
              utils_notification.resetNotificationStatus(item.id);
          });
          this.checkHomeworkReminders();
          this.resetHomeworkLoading();
          this.showImportForm = false;
          this.importCode = "";
          common_vendor.index.showToast({ title: `成功导入 ${newCount} 条作业`, icon: "success" });
        } else {
          common_vendor.index.showToast({ title: options.fromNativeShare ? "分享作业已存在" : "没有新作业可导入", icon: "none" });
        }
      } catch (e) {
        common_vendor.index.showToast({ title: "分享内容格式错误", icon: "none" });
      }
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
    editHomework(item) {
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
      if (this.completingId)
        return;
      const normalized = this.normalizeHomeworkItem(item);
      this.editingId = normalized.id;
      this.form = {
        subject: normalized.subject,
        deadlineDate: normalized.deadlineDate || "",
        deadlineTime: normalized.deadlineTime || "",
        imagePaths: [...normalized.imagePaths],
        audios: normalized.audios.map((audio) => ({ ...audio })),
        imagePath: normalized.imagePath || "",
        audioPath: normalized.audioPath || "",
        audioDuration: normalized.audioDuration || 0,
        note: normalized.note || ""
      };
      this.showForm = true;
    },
    async saveHomework() {
      if (!this.hasFormAttachment && !this.form.note.trim()) {
        common_vendor.index.showToast({ title: "请输入作业内容", icon: "none" });
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
            audios: this.form.audios.map((audio) => ({ ...audio })),
            imagePath: this.form.imagePath,
            audioPath: this.form.audioPath,
            audioDuration: this.form.audioDuration,
            note: this.form.note.trim()
          };
          this.saveHomeworkList();
          this.resetHomeworkLoading();
          utils_notification.resetNotificationStatus(this.homeworkList[index].id);
          utils_notification.setHomeworkReminder(this.homeworkList[index]);
        }
      }
      this.resetForm();
      common_vendor.index.showToast({ title: "已更新", icon: "success" });
    },
    resetForm() {
      if (this.isRecording) {
        this.cancelFormRecord();
      }
      this.showForm = false;
      this.editingId = "";
      this.newSubjectName = "";
      this.form = this.createEmptyForm();
    },
    onTouchStart(event, id) {
      if (this.completingId)
        return;
      const touch = event.changedTouches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchingId = id;
      this.swipeOffsetX = 0;
      this.isHorizontalSwiping = false;
      this.longPressTriggered = false;
    },
    onTouchMove(event, id) {
      if (this.completingId || this.touchingId !== id || this.longPressTriggered)
        return;
      const touch = event.changedTouches[0];
      const distanceX = touch.clientX - this.touchStartX;
      const distanceY = touch.clientY - this.touchStartY;
      if (!this.isHorizontalSwiping && Math.abs(distanceX) < 10)
        return;
      if (!this.isHorizontalSwiping && Math.abs(distanceY) > Math.abs(distanceX))
        return;
      this.isHorizontalSwiping = true;
      const maxOffset = 150;
      const absDistance = Math.abs(distanceX);
      const dampedDistance = absDistance > maxOffset ? maxOffset + (absDistance - maxOffset) * 0.25 : absDistance;
      this.swipeOffsetX = Math.round((distanceX < 0 ? -1 : 1) * dampedDistance);
    },
    onTouchEnd(event, item) {
      if (this.completingId || this.touchingId !== item.id || this.longPressTriggered) {
        this.resetSwipeState();
        return;
      }
      const endX = event.changedTouches[0].clientX;
      const distanceX = endX - this.touchStartX;
      const shouldComplete = !item.completed && distanceX > 80;
      const shouldRestore = item.completed && distanceX < -80;
      if (this.isHorizontalSwiping || Math.abs(distanceX) > 10) {
        this.suppressNextClick = true;
        setTimeout(() => {
          this.suppressNextClick = false;
        }, 260);
      }
      this.resetSwipeState(() => {
        if (shouldComplete) {
          this.playCompleteAnimation(item.id);
        } else if (shouldRestore) {
          this.restoreHomework(item.id);
        }
      });
    },
    onTouchCancel() {
      this.resetSwipeState();
    },
    resetSwipeState(callback) {
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchingId = "";
      this.swipeOffsetX = 0;
      this.isHorizontalSwiping = false;
      if (typeof callback === "function") {
        setTimeout(callback, 220);
      }
    },
    onLongPress(item) {
      this.longPressTriggered = true;
      this.confirmDeleteHomework(item);
    },
    playCompleteAnimation(id) {
      this.completingId = id;
      if (this.completeTimer) {
        clearTimeout(this.completeTimer);
      }
      this.completeTimer = setTimeout(() => {
        this.markCompleted(id);
        this.completingId = "";
        this.completeTimer = null;
      }, 420);
    },
    markCompleted(id) {
      this.homeworkList = this.homeworkList.map((item) => {
        if (item.id !== id)
          return item;
        return {
          ...item,
          completed: true,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      this.saveHomeworkList();
      this.resetHomeworkLoading();
      common_vendor.index.showToast({ title: "已标记完成", icon: "success" });
    },
    restoreHomework(id) {
      this.homeworkList = this.homeworkList.map((item) => {
        if (item.id !== id)
          return item;
        const restoredItem = {
          ...item,
          completed: false,
          completedAt: null
        };
        utils_notification.resetNotificationStatus(restoredItem.id);
        utils_notification.setHomeworkReminder(restoredItem);
        return restoredItem;
      });
      this.saveHomeworkList();
      this.resetHomeworkLoading();
      common_vendor.index.showToast({ title: "已恢复未完成", icon: "none" });
    },
    confirmDeleteHomework(item) {
      common_vendor.index.showModal({
        title: "删除作业",
        content: `确定删除"${item.subject}"这条作业吗？`,
        confirmText: "删除",
        confirmColor: "#ef4444",
        success: (res) => {
          if (res.confirm) {
            this.deleteHomework(item.id);
          }
        }
      });
    },
    deleteHomework(id) {
      this.homeworkList = this.homeworkList.filter((item) => item.id !== id);
      this.saveHomeworkList();
      this.resetHomeworkLoading();
      common_vendor.index.showToast({ title: "已删除", icon: "success" });
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
    previewImage(path, paths) {
      if (!path)
        return;
      common_vendor.index.previewImage({ urls: paths && paths.length ? paths : [path], current: path });
    },
    getStatusText(item) {
      if (item.completed)
        return "已完成";
      if (this.isOverdue(item))
        return "已逾期";
      if (this.isUrgent(item))
        return "即将截止";
      return "未完成";
    },
    getDeadlineClass(item) {
      if (this.isOverdue(item))
        return "status-overdue";
      if (this.isUrgent(item))
        return "status-urgent";
      return "";
    },
    isUrgent(item) {
      const diff = new Date(item.deadline).getTime() - Date.now();
      return diff > 0 && diff <= 24 * 60 * 60 * 1e3;
    },
    isOverdue(item) {
      return new Date(item.deadline).getTime() < Date.now();
    },
    formatDeadline(value) {
      if (!value)
        return "未设置";
      return value.replace("T", " ").slice(0, 16);
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
    a: common_assets._imports_0,
    b: common_vendor.o((...args) => $options.expandTopPanel && $options.expandTopPanel(...args)),
    c: common_vendor.o(($event) => _ctx.showShareMenu = !_ctx.showShareMenu),
    d: _ctx.showShareMenu
  }, _ctx.showShareMenu ? {
    e: common_vendor.o(($event) => _ctx.showShareMenu = false),
    f: common_vendor.o((...args) => $options.copyShareCode && $options.copyShareCode(...args)),
    g: common_vendor.o((...args) => $options.openImportForm && $options.openImportForm(...args))
  } : {}, {
    h: $data.showImportForm
  }, $data.showImportForm ? {
    i: common_vendor.o(($event) => $data.showImportForm = false),
    j: $data.importCode,
    k: common_vendor.o(($event) => $data.importCode = $event.detail.value),
    l: common_vendor.o((...args) => $options.pasteFromClipboard && $options.pasteFromClipboard(...args)),
    m: common_vendor.o((...args) => $options.manualImport && $options.manualImport(...args))
  } : {}, {
    n: common_vendor.t($options.pendingCount),
    o: common_vendor.n($data.selectedStatus === "pending" ? "active" : ""),
    p: common_vendor.o(($event) => $options.selectStatus("pending")),
    q: common_vendor.t($options.urgentCount),
    r: common_vendor.n($data.selectedStatus === "urgent" ? "active" : ""),
    s: common_vendor.o(($event) => $options.selectStatus("urgent")),
    t: common_vendor.t($options.completedCount),
    v: common_vendor.n($data.selectedStatus === "completed" ? "active" : ""),
    w: common_vendor.o(($event) => $options.selectStatus("completed")),
    x: common_vendor.t($options.filterSummary),
    y: common_vendor.f($options.subjectFilterOptions, (subject, k0, i0) => {
      return {
        a: common_vendor.t(subject),
        b: subject,
        c: common_vendor.n($data.selectedSubject === subject ? "active" : ""),
        d: common_vendor.o(($event) => $options.selectSubject(subject), subject)
      };
    }),
    z: common_vendor.n($data.isTopCollapsed ? "is-collapsed" : ""),
    A: $data.selectedSubject !== "全部"
  }, $data.selectedSubject !== "全部" ? {
    B: common_vendor.t($data.selectedSubject)
  } : {}, {
    C: $options.visibleHomework.length
  }, $options.visibleHomework.length ? {
    D: common_vendor.f($options.visibleHomework, (item, index, i0) => {
      return common_vendor.e({
        a: $data.touchingId === item.id && $data.swipeOffsetX
      }, $data.touchingId === item.id && $data.swipeOffsetX ? {
        b: common_vendor.t($options.getSwipeActionIcon(item)),
        c: common_vendor.t($options.getSwipeActionText(item))
      } : {}, {
        d: item.id === $data.completingId
      }, item.id === $data.completingId ? {} : {}, {
        e: $options.getImagePaths(item).length || $options.getAudios(item).length
      }, $options.getImagePaths(item).length || $options.getAudios(item).length ? {
        f: common_vendor.f($options.getImagePaths(item), (path, index2, i1) => {
          return {
            a: `card-image-${item.id}-${index2}`,
            b: path,
            c: common_vendor.o(($event) => $options.previewImage(path, $options.getImagePaths(item)), `card-image-${item.id}-${index2}`)
          };
        }),
        g: common_vendor.f($options.getAudios(item), (audio, index2, i1) => {
          return {
            a: common_vendor.t(audio.duration || 1),
            b: `card-audio-${item.id}-${index2}`,
            c: common_vendor.o(($event) => $options.playAudio(audio.path), `card-audio-${item.id}-${index2}`)
          };
        }),
        h: common_assets._imports_1,
        i: common_vendor.o(() => {
        }, item.id)
      } : {}, {
        j: common_vendor.t(item.subject),
        k: common_vendor.t($options.getStatusText(item)),
        l: common_vendor.n(item.completed ? "status-done" : $options.getDeadlineClass(item)),
        m: common_vendor.t($options.formatDeadline(item.deadline)),
        n: $options.getAudios(item).length
      }, $options.getAudios(item).length ? {
        o: common_vendor.t($options.getAudios(item).length),
        p: common_vendor.o(($event) => $options.playAudio($options.getAudios(item)[0].path), item.id)
      } : {}, {
        q: item.note
      }, item.note ? {
        r: common_vendor.t(item.note)
      } : {}, {
        s: item.id,
        t: common_vendor.n($data.touchingId === item.id && $data.swipeOffsetX ? "is-swiping" : ""),
        v: common_vendor.n($options.getSwipeActionClass(item)),
        w: common_vendor.n(item.completed ? "is-done" : ""),
        x: common_vendor.n(item.id === $data.completingId ? "is-completing" : ""),
        y: common_vendor.s($options.getCardStyle(item, index)),
        z: common_vendor.o(($event) => $options.onTouchStart($event, item.id), item.id),
        A: common_vendor.o(($event) => $options.onTouchMove($event, item.id), item.id),
        B: common_vendor.o(($event) => $options.onTouchEnd($event, item), item.id),
        C: common_vendor.o((...args) => $options.onTouchCancel && $options.onTouchCancel(...args), item.id),
        D: common_vendor.o(($event) => $options.onLongPress(item), item.id),
        E: common_vendor.o(($event) => $options.editHomework(item), item.id)
      });
    }),
    E: common_vendor.n($data.cardEnterActive ? "is-entering" : "")
  } : {}, {
    F: $data.isLoadingHomework
  }, $data.isLoadingHomework ? {} : $options.visibleHomework.length && !$options.hasMoreHomework ? {
    H: common_vendor.t($options.sortedHomework.length)
  } : $options.sortedHomework.length && $options.hasMoreHomework ? {} : {
    J: common_vendor.t($options.emptyTitle),
    K: common_vendor.t($options.emptyTip)
  }, {
    G: $options.visibleHomework.length && !$options.hasMoreHomework,
    I: $options.sortedHomework.length && $options.hasMoreHomework,
    L: $data.showForm
  }, $data.showForm ? common_vendor.e({
    M: common_vendor.o((...args) => $options.resetForm && $options.resetForm(...args)),
    N: common_vendor.o((...args) => $options.chooseFormImage && $options.chooseFormImage(...args)),
    O: common_vendor.t($data.isRecording ? "停止录音" : "添加录音"),
    P: common_vendor.n($data.isRecording ? "recording" : ""),
    Q: common_vendor.o((...args) => $options.toggleFormRecord && $options.toggleFormRecord(...args)),
    R: $data.form.imagePaths.length || $data.form.audios.length
  }, $data.form.imagePaths.length || $data.form.audios.length ? {
    S: common_vendor.f($data.form.imagePaths, (path, index, i0) => {
      return {
        a: path,
        b: common_vendor.o(($event) => $options.previewImage(path, $data.form.imagePaths), `edit-image-${index}-${path}`),
        c: common_vendor.o(($event) => $options.removeFormImageAttachment(index), `edit-image-${index}-${path}`),
        d: `edit-image-${index}-${path}`
      };
    }),
    T: common_assets._imports_2,
    U: common_vendor.f($data.form.audios, (audio, index, i0) => {
      return {
        a: common_vendor.t(audio.duration || 1),
        b: common_vendor.o(($event) => $options.removeFormAudioAttachment(index), `edit-audio-${index}-${audio.path}`),
        c: `edit-audio-${index}-${audio.path}`,
        d: common_vendor.o(($event) => $options.playAudio(audio.path), `edit-audio-${index}-${audio.path}`)
      };
    }),
    V: common_assets._imports_1,
    W: common_assets._imports_2
  } : {}, {
    X: common_vendor.t($data.form.subject || "从已建学科中选择"),
    Y: $options.subjectNames,
    Z: common_vendor.o((...args) => $options.onSubjectChange && $options.onSubjectChange(...args)),
    aa: $data.newSubjectName,
    ab: common_vendor.o(($event) => $data.newSubjectName = $event.detail.value),
    ac: common_vendor.o((...args) => $options.addSubject && $options.addSubject(...args)),
    ad: common_vendor.t($data.form.deadlineDate || "选择日期"),
    ae: $data.form.deadlineDate,
    af: common_vendor.o((...args) => $options.onDateChange && $options.onDateChange(...args)),
    ag: common_vendor.t($data.form.deadlineTime || "选择时间"),
    ah: $data.form.deadlineTime,
    ai: common_vendor.o((...args) => $options.onTimeChange && $options.onTimeChange(...args)),
    aj: $data.form.reminderOffsetHours,
    ak: common_vendor.o(($event) => $data.form.reminderOffsetHours = $event.detail.value),
    al: common_vendor.t($options.hasFormAttachment ? "备注" : "作业内容"),
    am: $options.hasFormAttachment ? "例如：第 3 章习题、需要提交实验报告" : "请输入老师布置的作业内容",
    an: $data.form.note,
    ao: common_vendor.o(($event) => $data.form.note = $event.detail.value),
    ap: common_vendor.o((...args) => $options.saveHomework && $options.saveHomework(...args)),
    aq: common_vendor.o(() => {
    }),
    ar: common_vendor.o((...args) => $options.resetForm && $options.resetForm(...args))
  }) : {}, {
    as: common_vendor.o((...args) => $options.onPageTouchStart && $options.onPageTouchStart(...args)),
    at: common_vendor.o((...args) => $options.onPageTouchMove && $options.onPageTouchMove(...args)),
    av: common_vendor.o((...args) => $options.onPageTouchEnd && $options.onPageTouchEnd(...args)),
    aw: common_vendor.o((...args) => $options.onPageTouchEnd && $options.onPageTouchEnd(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
_sfc_main.__runtimeHooks = 3;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/view/view.js.map
