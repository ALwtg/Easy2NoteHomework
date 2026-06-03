if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const SCHEDULE_KEY = "schedule_courses";
  const SCHEDULE_META_KEY = "schedule_meta";
  const SEMESTER_START_KEY = "semester_start_date";
  const PERIOD_CONFIG_KEY = "schedule_period_config";
  const IMPORT_CLEAR_MANUAL_KEY = "schedule_import_clear_manual";
  const COURSE_COLOR_KEY = "schedule_course_colors";
  const APPEARANCE_KEY = "schedule_appearance";
  const DEFAULT_PERIOD_CONFIG = {
    classMinutes: 45,
    breakMinutes: 10,
    morningStart: "08:00",
    morningCount: 4,
    afternoonStart: "13:40",
    afternoonCount: 4,
    eveningStart: "18:30",
    eveningCount: 4
  };
  buildPeriodTimes(DEFAULT_PERIOD_CONFIG);
  const COLOR_POOL = [
    "#3b82f6",
    "#22c55e",
    "#f97316",
    "#a855f7",
    "#ec4899",
    "#0ea5e9",
    "#14b8a6",
    "#ef4444",
    "#eab308",
    "#6366f1",
    "#84cc16",
    "#06b6d4",
    "#f43f5e",
    "#10b981",
    "#8b5cf6"
  ];
  function pickCourseColor(name) {
    const text = `${name || ""}`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = hash * 31 + text.charCodeAt(i) >>> 0;
    }
    return COLOR_POOL[hash % COLOR_POOL.length];
  }
  function normalizeCourseFromZf(item) {
    if (!item)
      return null;
    const xqj = parseInt(item.xqj, 10);
    const jcsRange = parseJcs(item.jcs);
    if (!xqj || !jcsRange)
      return null;
    const weeks = parseZcd(item.zcd);
    const subject = `${item.kcmc || ""}`.trim() || "未命名课程";
    return {
      id: `${item.kch_id || item.kch || ""}_${item.jxbmc || item.jxb_id || ""}_${xqj}_${jcsRange.start}`,
      subject,
      teacher: `${item.xm || item.jsxm || ""}`.trim(),
      location: `${item.cdmc || ""}`.trim(),
      dayOfWeek: xqj,
      startPeriod: jcsRange.start,
      endPeriod: jcsRange.end,
      weeks,
      weekText: `${item.zcd || ""}`.trim(),
      jcText: `${item.jc || item.jcs || ""}`.trim(),
      note: `${item.kkbzsmc || ""}`.trim(),
      color: pickCourseColor(subject)
    };
  }
  function parseJcs(jcs) {
    if (!jcs)
      return null;
    const text = `${jcs}`;
    const match = text.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (match) {
      return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
    }
    const single = parseInt(text, 10);
    if (single > 0)
      return { start: single, end: single };
    return null;
  }
  function parseZcd(zcd) {
    const result = /* @__PURE__ */ new Set();
    const text = `${zcd || ""}`.replace(/[周\s]/g, "");
    if (!text)
      return [];
    text.split(/[,、]/).forEach((part) => {
      if (!part)
        return;
      const single = part.match(/^(\d+)$/);
      if (single) {
        result.add(parseInt(single[1], 10));
        return;
      }
      const range = part.match(/^(\d+)[-–](\d+)(单|双)?$/);
      if (range) {
        const from = parseInt(range[1], 10);
        const to = parseInt(range[2], 10);
        const filter = range[3];
        for (let i = from; i <= to; i++) {
          if (filter === "单" && i % 2 === 0)
            continue;
          if (filter === "双" && i % 2 !== 0)
            continue;
          result.add(i);
        }
      }
    });
    return Array.from(result).sort((a, b) => a - b);
  }
  function loadCourses() {
    const data = uni.getStorageSync(SCHEDULE_KEY);
    return Array.isArray(data) ? data : [];
  }
  function saveCourses(list) {
    uni.setStorageSync(SCHEDULE_KEY, list);
  }
  function loadScheduleMeta() {
    const data = uni.getStorageSync(SCHEDULE_META_KEY);
    return data && typeof data === "object" ? data : {};
  }
  function saveScheduleMeta(meta) {
    uni.setStorageSync(SCHEDULE_META_KEY, meta || {});
  }
  function loadSemesterStartDate() {
    const value = uni.getStorageSync(SEMESTER_START_KEY);
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return value;
    return "";
  }
  function saveSemesterStartDate(value) {
    uni.setStorageSync(SEMESTER_START_KEY, value || "");
  }
  function calcCurrentWeek(startDate, today = /* @__PURE__ */ new Date()) {
    if (!startDate)
      return 1;
    const start = /* @__PURE__ */ new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime()))
      return 1;
    const startMonday = mondayOf(start);
    const todayMonday = mondayOf(today);
    const diffDays = Math.round((todayMonday.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1e3));
    return Math.max(1, Math.floor(diffDays / 7) + 1);
  }
  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + offset);
    return d;
  }
  function getDateOfWeek(startDate, week, dayOfWeek) {
    if (!startDate)
      return "";
    const start = /* @__PURE__ */ new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime()))
      return "";
    const startMonday = mondayOf(start);
    const target = new Date(startMonday);
    target.setDate(target.getDate() + (week - 1) * 7 + (dayOfWeek - 1));
    const y = target.getFullYear();
    const m = `${target.getMonth() + 1}`.padStart(2, "0");
    const d = `${target.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function buildWeekTable(courses, week) {
    const table = {};
    for (let i = 1; i <= 7; i++)
      table[i] = [];
    courses.forEach((course) => {
      if (!Array.isArray(course.weeks) || !course.weeks.includes(week))
        return;
      table[course.dayOfWeek].push(course);
    });
    Object.keys(table).forEach((key) => {
      table[key].sort((a, b) => a.startPeriod - b.startPeriod);
    });
    return table;
  }
  function loadPeriodConfig() {
    const data = uni.getStorageSync(PERIOD_CONFIG_KEY);
    return mergePeriodConfig(data);
  }
  function savePeriodConfig(config) {
    const merged = mergePeriodConfig(config);
    uni.setStorageSync(PERIOD_CONFIG_KEY, merged);
    return merged;
  }
  function mergePeriodConfig(config) {
    const base = { ...DEFAULT_PERIOD_CONFIG };
    if (!config || typeof config !== "object")
      return base;
    const next = { ...base };
    if (isPositiveInt(config.classMinutes))
      next.classMinutes = Number(config.classMinutes);
    if (isNonNegativeInt(config.breakMinutes))
      next.breakMinutes = Number(config.breakMinutes);
    if (isTimeStr(config.morningStart))
      next.morningStart = padTime(config.morningStart);
    if (isNonNegativeInt(config.morningCount))
      next.morningCount = Number(config.morningCount);
    if (isTimeStr(config.afternoonStart))
      next.afternoonStart = padTime(config.afternoonStart);
    if (isNonNegativeInt(config.afternoonCount))
      next.afternoonCount = Number(config.afternoonCount);
    if (isTimeStr(config.eveningStart))
      next.eveningStart = padTime(config.eveningStart);
    if (isNonNegativeInt(config.eveningCount))
      next.eveningCount = Number(config.eveningCount);
    return next;
  }
  function buildPeriodTimes(config) {
    const cfg = mergePeriodConfig(config);
    const list = [];
    pushSession(list, cfg.morningStart, cfg.morningCount, cfg.classMinutes, cfg.breakMinutes);
    pushSession(list, cfg.afternoonStart, cfg.afternoonCount, cfg.classMinutes, cfg.breakMinutes);
    pushSession(list, cfg.eveningStart, cfg.eveningCount, cfg.classMinutes, cfg.breakMinutes);
    return list;
  }
  function getTotalPeriodCount(config) {
    const cfg = mergePeriodConfig(config);
    return cfg.morningCount + cfg.afternoonCount + cfg.eveningCount;
  }
  function pushSession(list, startTime, count, classMinutes, breakMinutes) {
    if (!count || count <= 0)
      return;
    let cursor = parseTimeMinutes(startTime);
    if (cursor === null)
      return;
    for (let i = 0; i < count; i++) {
      const start = cursor;
      const end = start + classMinutes;
      list.push({ start: minutesToTime(start), end: minutesToTime(end) });
      cursor = end + breakMinutes;
    }
  }
  function parseTimeMinutes(text) {
    const match = `${text || ""}`.match(/^(\d{1,2}):(\d{2})$/);
    if (!match)
      return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59)
      return null;
    return h * 60 + m;
  }
  function minutesToTime(total) {
    const wrap = (total % (24 * 60) + 24 * 60) % (24 * 60);
    const h = `${Math.floor(wrap / 60)}`.padStart(2, "0");
    const m = `${wrap % 60}`.padStart(2, "0");
    return `${h}:${m}`;
  }
  function padTime(text) {
    const match = `${text}`.match(/^(\d{1,2}):(\d{2})$/);
    if (!match)
      return text;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  function isPositiveInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
  }
  function isNonNegativeInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0;
  }
  function isTimeStr(value) {
    return typeof value === "string" && /^(\d{1,2}):(\d{2})$/.test(value);
  }
  function loadClearManualOnImport() {
    const value = uni.getStorageSync(IMPORT_CLEAR_MANUAL_KEY);
    return value === true;
  }
  function saveClearManualOnImport(value) {
    uni.setStorageSync(IMPORT_CLEAR_MANUAL_KEY, value === true);
  }
  const COURSE_COLOR_PRESETS = [
    "#3b82f6",
    "#22c55e",
    "#f97316",
    "#a855f7",
    "#ec4899",
    "#0ea5e9",
    "#14b8a6",
    "#ef4444",
    "#eab308",
    "#6366f1",
    "#84cc16",
    "#06b6d4",
    "#f43f5e",
    "#10b981",
    "#8b5cf6",
    "#0d9488",
    "#7c3aed",
    "#d946ef",
    "#f59e0b",
    "#64748b"
  ];
  function loadCourseColorMap() {
    const data = uni.getStorageSync(COURSE_COLOR_KEY);
    if (!data || typeof data !== "object" || Array.isArray(data))
      return {};
    const map = {};
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
        map[key] = value;
      }
    });
    return map;
  }
  function saveCourseColorMap(map) {
    const safe = map && typeof map === "object" && !Array.isArray(map) ? map : {};
    uni.setStorageSync(COURSE_COLOR_KEY, safe);
    return safe;
  }
  function setCourseColor(subject, color) {
    const map = loadCourseColorMap();
    const key = `${subject || ""}`.trim();
    if (!key)
      return map;
    if (color) {
      map[key] = color;
    } else {
      delete map[key];
    }
    return saveCourseColorMap(map);
  }
  function resolveCourseColor(subject, fallback, colorMap) {
    const map = colorMap || loadCourseColorMap();
    const key = `${subject || ""}`.trim();
    if (key && map[key])
      return map[key];
    if (fallback)
      return fallback;
    return pickCourseColor(subject);
  }
  const DEFAULT_APPEARANCE = {
    backgroundImage: "",
    // 背景图透明度（0-1，越小越透）
    backgroundOpacity: 1,
    // 课程卡片透明度（0.3-1，整体卡片含色块）
    cardOpacity: 1
  };
  function loadAppearance() {
    const data = uni.getStorageSync(APPEARANCE_KEY);
    return mergeAppearance(data);
  }
  function saveAppearance(config) {
    const merged = mergeAppearance(config);
    uni.setStorageSync(APPEARANCE_KEY, merged);
    return merged;
  }
  function mergeAppearance(config) {
    const base = { ...DEFAULT_APPEARANCE };
    if (!config || typeof config !== "object")
      return base;
    const next = { ...base };
    if (typeof config.backgroundImage === "string")
      next.backgroundImage = config.backgroundImage;
    if (typeof config.backgroundOpacity === "number" && config.backgroundOpacity >= 0 && config.backgroundOpacity <= 1) {
      next.backgroundOpacity = round2(config.backgroundOpacity);
    }
    if (typeof config.cardOpacity === "number" && config.cardOpacity >= 0.3 && config.cardOpacity <= 1) {
      next.cardOpacity = round2(config.cardOpacity);
    }
    return next;
  }
  function round2(value) {
    return Math.round(value * 100) / 100;
  }
  function mergeWithManualCourses(importedCourses) {
    const list = Array.isArray(importedCourses) ? importedCourses.slice() : [];
    if (loadClearManualOnImport())
      return list;
    const existing = loadCourses();
    const manualCourses = existing.filter((item) => item && item.manual);
    return list.concat(manualCourses);
  }
  const ZF_LOGIN_URL = "http://ehall.njit.edu.cn/new/index.html";
  const STORAGE_DATA_KEY = "zf_schedule_data";
  const STORAGE_DONE_KEY = "zf_schedule_done";
  const STORAGE_ERR_KEY = "zf_schedule_error";
  const FETCH_SCRIPT = `
(function() {
	if (window.__zfHwFetching) return;
	window.__zfHwFetching = true;
	try {
		if (typeof plus === 'undefined' || !plus.storage) {
			alert('plus 对象未注入，无法回传数据，请重试');
			window.__zfHwFetching = false;
			return;
		}
		var $ = window.jQuery || window.$;
		if (!$ || !$.ajax) {
			plus.storage.setItem('${STORAGE_ERR_KEY}', '当前页面缺少 jQuery，请确认已进入"个人课表查询"页');
			plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
			window.__zfHwFetching = false;
			return;
		}
		function pickValue(id) {
			var el = document.getElementById(id);
			if (!el) return '';
			if (el.value) return el.value;
			var sel = el.querySelector('option[selected]');
			return sel ? sel.value : '';
		}
		var xnm = pickValue('xnm');
		var xqm = pickValue('xqm');
		if (!xnm || !xqm) {
			plus.storage.setItem('${STORAGE_ERR_KEY}', '未读取到学年学期，请先在课表查询页选择学年学期');
			plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
			window.__zfHwFetching = false;
			return;
		}
		$.ajax({
			url: '/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151',
			type: 'POST',
			dataType: 'json',
			data: { xnm: xnm, xqm: xqm, kblx: '1' },
			success: function(data) {
				try {
					plus.storage.setItem('${STORAGE_DATA_KEY}', JSON.stringify({ data: data, xnm: xnm, xqm: xqm }));
					plus.storage.setItem('${STORAGE_DONE_KEY}', 'success');
				} catch (e) {
					plus.storage.setItem('${STORAGE_ERR_KEY}', '数据写入失败：' + (e && e.message));
					plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
				}
				window.__zfHwFetching = false;
			},
			error: function(xhr) {
				plus.storage.setItem('${STORAGE_ERR_KEY}', '请求课表接口失败 ' + (xhr && xhr.status));
				plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
				window.__zfHwFetching = false;
			}
		});
	} catch (e) {
		try {
			plus.storage.setItem('${STORAGE_ERR_KEY}', '注入异常：' + (e && e.message));
			plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
		} catch (e2) {}
		window.__zfHwFetching = false;
	}
})();
`;
  function clearStorageKeys() {
    try {
      plus.storage.removeItem(STORAGE_DATA_KEY);
      plus.storage.removeItem(STORAGE_DONE_KEY);
      plus.storage.removeItem(STORAGE_ERR_KEY);
    } catch (e) {
    }
  }
  function pickSchedulePayload(parsed) {
    if (Array.isArray(parsed))
      return { list: parsed, metaSource: {} };
    if (!parsed || typeof parsed !== "object")
      return { list: [], metaSource: {} };
    if (Array.isArray(parsed.kbList))
      return { list: parsed.kbList, metaSource: parsed };
    if (parsed.data && Array.isArray(parsed.data.kbList))
      return { list: parsed.data.kbList, metaSource: { ...parsed.data, ...parsed } };
    if (parsed.datas && Array.isArray(parsed.datas.kbList))
      return { list: parsed.datas.kbList, metaSource: { ...parsed.datas, ...parsed } };
    if (parsed.result && Array.isArray(parsed.result.kbList))
      return { list: parsed.result.kbList, metaSource: { ...parsed.result, ...parsed } };
    return { list: [], metaSource: parsed };
  }
  function parseJsonLikeText(rawText) {
    const text = `${rawText || ""}`.trim();
    if (!text)
      throw new Error("请先粘贴课表 JSON 或页面源码");
    try {
      return JSON.parse(text);
    } catch (e) {
    }
    const jsonMatch = text.match(/\{[\s\S]*"kbList"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
      }
    }
    const arrayMatch = text.match(/"kbList"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    if (arrayMatch) {
      try {
        return { kbList: JSON.parse(arrayMatch[1]) };
      } catch (e) {
      }
    }
    throw new Error("未识别到课表数据。网页端请粘贴接口返回 JSON，或包含 kbList 的页面源码。");
  }
  function parseScheduleImportText(rawText) {
    const parsed = parseJsonLikeText(rawText);
    const payload = pickSchedulePayload(parsed);
    const courses = payload.list.map(normalizeCourseFromZf).filter(Boolean);
    if (!courses.length) {
      throw new Error("未解析到有效课程，请确认粘贴的是课表接口 JSON 数据");
    }
    return {
      courses,
      meta: {
        xnm: payload.metaSource.xnm || "",
        xqm: payload.metaSource.xqm || "",
        xqmmc: payload.metaSource.xqmmc || "",
        xnmc: payload.metaSource.xnmc || "",
        importMode: "web-paste",
        importedAt: (/* @__PURE__ */ new Date()).toISOString(),
        courseCount: courses.length
      }
    };
  }
  function importScheduleFromText(rawText) {
    const result = parseScheduleImportText(rawText);
    saveCourses(mergeWithManualCourses(result.courses));
    saveScheduleMeta(result.meta);
    return result;
  }
  function isOnCoursePage(url) {
    return /xskbcx/i.test(`${url || ""}`);
  }
  function importScheduleFromZf({ onSuccess, onCancel, onError } = {}) {
    clearStorageKeys();
    const BACK_BTN_TEXT = "返回课表页面";
    const EXTRACT_BTN_TEXT = "提取课表";
    let statusBarHeight = 24;
    try {
      const sysInfo = uni.getSystemInfoSync();
      statusBarHeight = Number(sysInfo && sysInfo.statusBarHeight) || 24;
    } catch (e) {
    }
    const webviewTop = `${statusBarHeight}px`;
    const buttonTop = statusBarHeight + 8;
    const buttonGap = 8;
    const buttonHeight = 34;
    const buttonLeft = "10px";
    const buttonWidth = "118px";
    const bgWv = plus.webview.create("about:blank", "zfScheduleImportBg", {
      top: "0px",
      bottom: "0px",
      background: "#ffffff",
      scrollIndicator: "none"
    });
    const wv = plus.webview.create(ZF_LOGIN_URL, "zfScheduleImport", {
      top: webviewTop,
      bottom: "0px",
      plusrequire: "ahead",
      scrollIndicator: "none",
      popGesture: "close",
      scalable: true
    });
    let backHomeBtn = null;
    let extractBtn = null;
    try {
      backHomeBtn = new plus.nativeObj.View("zfBackHomeBtn", {
        top: `${buttonTop}px`,
        left: buttonLeft,
        width: buttonWidth,
        height: `${buttonHeight}px`
      }, [
        {
          tag: "rect",
          color: "rgba(41,121,255,0.92)",
          rectStyles: { radius: "17px" },
          position: { top: "0px", left: "0px", width: "100%", height: "100%" }
        },
        {
          tag: "font",
          text: BACK_BTN_TEXT,
          textStyles: { color: "#ffffff", size: "13px", weight: "bold" },
          position: { top: "0px", left: "0px", width: "100%", height: "100%" }
        }
      ]);
      backHomeBtn.setStyle({ mask: "rgba(0,0,0,0)" });
    } catch (e) {
      backHomeBtn = null;
    }
    try {
      extractBtn = new plus.nativeObj.View("zfExtractBtn", {
        top: `${buttonTop + buttonHeight + buttonGap}px`,
        left: buttonLeft,
        width: buttonWidth,
        height: `${buttonHeight}px`
      }, [
        {
          tag: "rect",
          color: "rgba(41,121,255,0.92)",
          rectStyles: { radius: "17px" },
          position: { top: "0px", left: "0px", width: "100%", height: "100%" }
        },
        {
          tag: "font",
          text: EXTRACT_BTN_TEXT,
          textStyles: { color: "#ffffff", size: "13px", weight: "bold" },
          position: { top: "0px", left: "0px", width: "100%", height: "100%" }
        }
      ]);
      extractBtn.setStyle({ mask: "rgba(0,0,0,0)" });
    } catch (e) {
      extractBtn = null;
    }
    let pollTimer = null;
    let closed = false;
    let succeed = false;
    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
    function goHome() {
      setTimeout(() => {
        uni.switchTab({ url: "/pages/record/record" });
      }, 120);
    }
    function closeNativeButtons() {
      try {
        if (backHomeBtn)
          backHomeBtn.close();
      } catch (e) {
      }
      try {
        if (extractBtn)
          extractBtn.close();
      } catch (e) {
      }
      backHomeBtn = null;
      extractBtn = null;
    }
    function closeImportWebviews() {
      try {
        wv.close("auto");
      } catch (e) {
      }
      try {
        bgWv.close("none");
      } catch (e) {
      }
    }
    function safeCloseWebview(redirectHome = false) {
      if (closed)
        return;
      closed = true;
      stopPolling();
      closeNativeButtons();
      closeImportWebviews();
      if (redirectHome)
        goHome();
    }
    wv.addEventListener("close", () => {
      stopPolling();
      closeNativeButtons();
      try {
        bgWv.close("none");
      } catch (e) {
      }
      const wasClosedBySelf = closed;
      closed = true;
      if (!succeed) {
        if (!wasClosedBySelf)
          onCancel && onCancel();
        goHome();
      }
    });
    function handleExtractClick() {
      let url = "";
      try {
        url = typeof wv.getURL === "function" ? wv.getURL() : "";
      } catch (e) {
        url = "";
      }
      if (!isOnCoursePage(url)) {
        plus.nativeUI.toast('请先登录并进入"个人课表查询"页面');
        return;
      }
      clearStorageKeys();
      plus.nativeUI.showWaiting("正在提取课表...");
      try {
        wv.evalJS(FETCH_SCRIPT);
      } catch (e) {
        plus.nativeUI.closeWaiting();
        plus.nativeUI.toast("注入脚本失败");
        return;
      }
      stopPolling();
      let elapsed = 0;
      pollTimer = setInterval(() => {
        elapsed += 400;
        let status = "";
        try {
          status = plus.storage.getItem(STORAGE_DONE_KEY) || "";
        } catch (e) {
        }
        if (status === "success") {
          stopPolling();
          let raw = "";
          try {
            raw = plus.storage.getItem(STORAGE_DATA_KEY) || "";
          } catch (e) {
          }
          plus.nativeUI.closeWaiting();
          try {
            const parsed = JSON.parse(raw || "{}");
            const data = parsed.data || {};
            const list = data.kbList || [];
            const courses = list.map(normalizeCourseFromZf).filter(Boolean);
            if (!courses.length) {
              plus.nativeUI.toast("该学期暂无课表数据");
              return;
            }
            saveCourses(mergeWithManualCourses(courses));
            saveScheduleMeta({
              xnm: parsed.xnm,
              xqm: parsed.xqm,
              xqmmc: data.xqmmc || "",
              xnmc: data.xnmc || "",
              importedAt: (/* @__PURE__ */ new Date()).toISOString(),
              courseCount: courses.length
            });
            succeed = true;
            safeCloseWebview();
            setTimeout(() => {
              onSuccess && onSuccess({
                courses,
                xnm: parsed.xnm,
                xqm: parsed.xqm,
                xnmc: data.xnmc,
                xqmmc: data.xqmmc
              });
            }, 220);
          } catch (e) {
            plus.nativeUI.toast("解析课表失败：" + (e && e.message));
            onError && onError(e);
          }
        } else if (status === "error") {
          stopPolling();
          let err = "";
          try {
            err = plus.storage.getItem(STORAGE_ERR_KEY) || "";
          } catch (e) {
          }
          plus.nativeUI.closeWaiting();
          plus.nativeUI.toast(err || "提取失败，请重试");
          onError && onError(new Error(err || "extract failed"));
        } else if (elapsed > 45e3) {
          stopPolling();
          plus.nativeUI.closeWaiting();
          plus.nativeUI.toast("提取超时，请重试");
          onError && onError(new Error("timeout"));
        }
      }, 400);
    }
    try {
      bgWv.show("none");
    } catch (e) {
    }
    if (backHomeBtn) {
      backHomeBtn.addEventListener("click", () => {
        safeCloseWebview();
      });
      try {
        wv.append(backHomeBtn);
      } catch (e) {
        try {
          plus.webview.currentWebview().append(backHomeBtn);
        } catch (e2) {
        }
      }
      try {
        backHomeBtn.show();
      } catch (e) {
      }
    }
    if (extractBtn) {
      extractBtn.addEventListener("click", handleExtractClick);
      try {
        wv.append(extractBtn);
      } catch (e) {
        try {
          plus.webview.currentWebview().append(extractBtn);
        } catch (e2) {
        }
      }
      try {
        extractBtn.show();
      } catch (e) {
      }
    }
    wv.show("slide-in-right");
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const TOTAL_WEEKS = 25;
  const WEEK_NAMES = ["一", "二", "三", "四", "五", "六", "日"];
  const _sfc_main$a = {
    data() {
      const periodConfig = loadPeriodConfig();
      return {
        courses: [],
        meta: {},
        semesterStart: "",
        selectedWeek: 1,
        currentWeek: 1,
        activeCourse: null,
        showWeekPicker: false,
        periodConfig,
        totalPeriods: getTotalPeriodCount(periodConfig),
        totalWeeks: TOTAL_WEEKS,
        periodTimes: buildPeriodTimes(periodConfig),
        courseColorMap: {},
        appearance: loadAppearance(),
        showWebImport: false,
        webImportUrl: ZF_LOGIN_URL,
        webImportStatus: "",
        webImportError: "",
        webAutoBusy: false,
        // 点击空格子后出现的"待新增"标记
        pendingSlot: null,
        // { dayIndex(0-6), startPeriod, endPeriod }
        // + 号弹出的"添加课程"面板
        showAddPanel: false,
        addPanelMode: "pick",
        // 'pick' | 'create'
        courseSearch: "",
        createForm: {
          subject: "",
          teacher: "",
          location: "",
          applyAllWeeks: true
        },
        // 重新导入时是否清除手动添加的课程
        clearManualOnImport: loadClearManualOnImport()
      };
    },
    computed: {
      hasCourses() {
        return this.courses.length > 0;
      },
      coursesByDay() {
        return buildWeekTable(this.courses, this.selectedWeek);
      },
      weekDays() {
        const todayStr = this.formatDate(/* @__PURE__ */ new Date());
        return WEEK_NAMES.map((name, idx) => {
          const date = getDateOfWeek(this.semesterStart, this.selectedWeek, idx + 1);
          return {
            label: `周${name}`,
            date: this.shortDate(date),
            isToday: !!date && date === todayStr
          };
        });
      },
      weekTitle() {
        return `第 ${this.selectedWeek} 周`;
      },
      semesterTitle() {
        if (this.meta && this.meta.xnmc && this.meta.xqmmc) {
          return `${this.meta.xnmc} 学年 第${this.meta.xqmmc}学期`;
        }
        if (this.meta && this.meta.xnm && this.meta.xqm) {
          return `${this.meta.xnm}学年 学期${this.meta.xqm}`;
        }
        return this.semesterStart ? `开学：${this.semesterStart}` : "尚未设置开学日期";
      },
      // 当前周每个 (day, period) 是否被占用，用于扩展时判断
      occupancyMap() {
        const map = {};
        for (let d = 1; d <= 7; d++) {
          map[d] = {};
          const list = this.coursesByDay[d] || [];
          list.forEach((course) => {
            for (let p = course.startPeriod; p <= course.endPeriod; p++) {
              map[d][p] = true;
            }
          });
        }
        return map;
      },
      // + 号弹窗里"已添加的课程"去重列表
      uniqueCourseOptions() {
        const seen = /* @__PURE__ */ new Map();
        this.courses.forEach((c) => {
          const key = `${c.subject}|${c.teacher || ""}|${c.location || ""}`;
          if (!seen.has(key)) {
            seen.set(key, {
              subject: c.subject,
              teacher: c.teacher || "",
              location: c.location || "",
              color: c.color
            });
          }
        });
        const kw = `${this.courseSearch || ""}`.trim().toLowerCase();
        const list = Array.from(seen.values());
        if (!kw)
          return list;
        return list.filter((item) => {
          return item.subject.toLowerCase().includes(kw) || (item.teacher || "").toLowerCase().includes(kw) || (item.location || "").toLowerCase().includes(kw);
        });
      },
      // 待新增区段的悬浮按钮位置（按 day 列内 absolute 定位）
      pendingStyle() {
        if (!this.pendingSlot)
          return "";
        const top = (this.pendingSlot.startPeriod - 1) * 110;
        const span = this.pendingSlot.endPeriod - this.pendingSlot.startPeriod + 1;
        const height = span * 110 - 8;
        return `top:${top}rpx;height:${height}rpx;`;
      },
      canExpandUp() {
        if (!this.pendingSlot)
          return false;
        const { dayIndex, startPeriod } = this.pendingSlot;
        if (startPeriod <= 1)
          return false;
        const day = dayIndex + 1;
        return !this.occupancyMap[day][startPeriod - 1];
      },
      canExpandDown() {
        if (!this.pendingSlot)
          return false;
        const { dayIndex, endPeriod } = this.pendingSlot;
        if (endPeriod >= this.totalPeriods)
          return false;
        const day = dayIndex + 1;
        return !this.occupancyMap[day][endPeriod + 1];
      }
    },
    onShow() {
      this.refresh();
    },
    mounted() {
    },
    beforeUnmount() {
    },
    onBackPress(options) {
      if (this.showAddPanel) {
        this.closeAddPanel();
        return true;
      }
      if (this.pendingSlot) {
        this.pendingSlot = null;
        return true;
      }
      if (this.showWeekPicker) {
        this.showWeekPicker = false;
        return true;
      }
      if (this.activeCourse) {
        this.activeCourse = null;
        return true;
      }
      if (this.showWebImport) {
        this.closeWebImport();
        return true;
      }
      if (options && options.from === "backbutton") {
        uni.switchTab({ url: "/pages/record/record" });
        return true;
      }
      return false;
    },
    methods: {
      refresh() {
        this.courses = loadCourses();
        this.meta = loadScheduleMeta();
        this.semesterStart = loadSemesterStartDate();
        this.periodConfig = loadPeriodConfig();
        this.periodTimes = buildPeriodTimes(this.periodConfig);
        this.totalPeriods = getTotalPeriodCount(this.periodConfig);
        this.courseColorMap = loadCourseColorMap();
        this.appearance = loadAppearance();
        this.clearManualOnImport = loadClearManualOnImport();
        this.currentWeek = calcCurrentWeek(this.semesterStart);
        if (!this.selectedWeek || this.selectedWeek < 1 || this.selectedWeek > this.totalWeeks) {
          this.selectedWeek = this.currentWeek;
        }
        if (this.semesterStart && this.selectedWeek === 1 && this.currentWeek > 1) {
          this.selectedWeek = this.currentWeek;
        }
      },
      toggleClearManual() {
        const next = !this.clearManualOnImport;
        this.clearManualOnImport = next;
        saveClearManualOnImport(next);
        uni.showToast({
          title: next ? "已开启：重新导入会清除手动课" : "已关闭：手动课会保留",
          icon: "none"
        });
      },
      periodTimeText(period) {
        const time = this.periodTimes[period - 1];
        if (!time)
          return "";
        return `${time.start}
${time.end}`;
      },
      getCourseStyle(course) {
        const span = course.endPeriod - course.startPeriod + 1;
        const top = (course.startPeriod - 1) * 110;
        const height = span * 110 - 8;
        const color = resolveCourseColor(course.subject, course.color, this.courseColorMap);
        const opacity = this.appearance.cardOpacity;
        return `top:${top}rpx;height:${height}rpx;background:${color};opacity:${opacity};`;
      },
      resolveColor(course) {
        if (!course)
          return "";
        return resolveCourseColor(course.subject, course.color, this.courseColorMap);
      },
      openCourse(course) {
        this.activeCourse = course;
      },
      // 点击空白格子：先判断是否真的为空，再设置/取消"待新增"标记
      onCellTap(dayIndex, period) {
        const day = dayIndex + 1;
        if (this.occupancyMap[day] && this.occupancyMap[day][period])
          return;
        if (this.pendingSlot && this.pendingSlot.dayIndex === dayIndex && period >= this.pendingSlot.startPeriod && period <= this.pendingSlot.endPeriod) {
          this.pendingSlot = null;
          return;
        }
        this.pendingSlot = { dayIndex, startPeriod: period, endPeriod: period };
      },
      expandPendingUp() {
        if (!this.canExpandUp)
          return;
        this.pendingSlot = {
          ...this.pendingSlot,
          startPeriod: this.pendingSlot.startPeriod - 1
        };
      },
      expandPendingDown() {
        if (!this.canExpandDown)
          return;
        this.pendingSlot = {
          ...this.pendingSlot,
          endPeriod: this.pendingSlot.endPeriod + 1
        };
      },
      closePending() {
        this.pendingSlot = null;
      },
      openAddPanel() {
        if (!this.pendingSlot)
          return;
        this.addPanelMode = "pick";
        this.courseSearch = "";
        this.createForm = { subject: "", teacher: "", location: "", applyAllWeeks: true };
        this.showAddPanel = true;
      },
      closeAddPanel() {
        this.showAddPanel = false;
      },
      switchAddMode(mode) {
        this.addPanelMode = mode;
      },
      // 选择"已有课程"作为模板新增
      pickExistingCourse(item) {
        this.commitNewCourse({
          subject: item.subject,
          teacher: item.teacher,
          location: item.location,
          color: item.color || pickCourseColor(item.subject),
          applyAllWeeks: false
        });
      },
      // 提交"快捷新建"
      submitCreateForm() {
        const subject = `${this.createForm.subject || ""}`.trim();
        if (!subject) {
          uni.showToast({ title: "请输入课程名称", icon: "none" });
          return;
        }
        this.commitNewCourse({
          subject,
          teacher: `${this.createForm.teacher || ""}`.trim(),
          location: `${this.createForm.location || ""}`.trim(),
          color: pickCourseColor(subject),
          applyAllWeeks: !!this.createForm.applyAllWeeks
        });
      },
      commitNewCourse({ subject, teacher, location, color, applyAllWeeks }) {
        if (!this.pendingSlot)
          return;
        const { dayIndex, startPeriod, endPeriod } = this.pendingSlot;
        const dayOfWeek = dayIndex + 1;
        const weeks = applyAllWeeks ? Array.from({ length: this.totalWeeks }, (_, i) => i + 1) : [this.selectedWeek];
        const weekText = applyAllWeeks ? `1-${this.totalWeeks}周` : `${this.selectedWeek}周`;
        const id = `manual_${Date.now()}_${dayOfWeek}_${startPeriod}`;
        const newCourse = {
          id,
          subject,
          teacher: teacher || "",
          location: location || "",
          dayOfWeek,
          startPeriod,
          endPeriod,
          weeks,
          weekText,
          jcText: `${startPeriod}-${endPeriod}`,
          note: "",
          color: color || pickCourseColor(subject),
          manual: true
        };
        const list = loadCourses();
        list.push(newCourse);
        saveCourses(list);
        this.courses = list;
        this.showAddPanel = false;
        this.pendingSlot = null;
        uni.showToast({ title: "已添加", icon: "success" });
      },
      prevWeek() {
        if (this.selectedWeek > 1)
          this.selectedWeek -= 1;
      },
      nextWeek() {
        if (this.selectedWeek < this.totalWeeks)
          this.selectedWeek += 1;
      },
      selectWeek(week) {
        this.selectedWeek = week;
        this.showWeekPicker = false;
      },
      goToCurrentWeek() {
        this.selectedWeek = this.currentWeek;
        this.showWeekPicker = false;
      },
      startImport() {
        if (!this.semesterStart) {
          uni.showModal({
            title: "请先设置开学日期",
            content: '设置开学日期后再导入课表，便于按周次查看。是否前往"设置"？',
            confirmText: "去设置",
            success: (res) => {
              if (res.confirm) {
                uni.switchTab({ url: "/pages/settings/settings" });
              }
            }
          });
          return;
        }
        uni.showModal({
          title: "从教务系统导入",
          content: '将打开学校教务网站，请登录并进入"个人课表查询"，再点击底部"提取课表"按钮。',
          confirmText: "继续",
          success: (res) => {
            if (!res.confirm)
              return;
            importScheduleFromZf({
              onSuccess: (result) => {
                this.refresh();
                uni.showToast({ title: `成功导入 ${result.courses.length} 门课程`, icon: "success" });
              },
              onError: (err) => {
                formatAppLog("warn", "at pages/schedule/schedule.vue:710", "课表导入失败：", err);
              },
              onCancel: () => {
              }
            });
          }
        });
      },
      closeWebImport() {
        this.showWebImport = false;
        this.webAutoBusy = false;
      },
      reloadWebImport() {
      },
      webFrameLoaded() {
        this.webImportStatus = '页面已载入。登录并进入"个人课表查询"后，点击"自动抓取课表"。';
      },
      runWebAutoImport() {
      },
      handleWebImportMessage(event) {
        if (!event || !event.data || event.data.type !== "schedule-import-data")
          return;
        try {
          const result = importScheduleFromText(event.data.payload);
          this.showWebImport = false;
          this.refresh();
          uni.showToast({ title: `成功导入 ${result.courses.length} 门课程`, icon: "success" });
        } catch (e) {
          uni.showModal({
            title: "导入失败",
            content: e && e.message || "课表数据解析失败",
            showCancel: false
          });
        }
      },
      formatImportTime(value) {
        if (!value)
          return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
          return "";
        const m = `${date.getMonth() + 1}`.padStart(2, "0");
        const d = `${date.getDate()}`.padStart(2, "0");
        const h = `${date.getHours()}`.padStart(2, "0");
        const min = `${date.getMinutes()}`.padStart(2, "0");
        return `${m}-${d} ${h}:${min}`;
      },
      formatDate(date) {
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, "0");
        const d = `${date.getDate()}`.padStart(2, "0");
        return `${y}-${m}-${d}`;
      },
      shortDate(value) {
        if (!value)
          return "";
        const parts = value.split("-");
        if (parts.length !== 3)
          return value;
        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      },
      weekDayName(num) {
        return WEEK_NAMES[(num - 1) % 7];
      }
    }
  };
  function _sfc_render$9(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      $data.appearance.backgroundImage ? (vue.openBlock(), vue.createElementBlock(
        "view",
        {
          key: 0,
          class: "page-bg",
          style: vue.normalizeStyle({ backgroundImage: `url('${$data.appearance.backgroundImage}')`, opacity: $data.appearance.backgroundOpacity })
        },
        null,
        4
        /* STYLE */
      )) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("view", {
          class: "nav-left",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.prevWeek && $options.prevWeek(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "‹")
        ]),
        vue.createElementVNode("view", {
          class: "nav-center",
          onClick: _cache[1] || (_cache[1] = ($event) => $data.showWeekPicker = !$data.showWeekPicker)
        }, [
          vue.createElementVNode(
            "text",
            { class: "nav-title" },
            vue.toDisplayString($options.weekTitle),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "nav-subtitle" },
            vue.toDisplayString($options.semesterTitle),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", {
          class: "nav-right",
          onClick: _cache[2] || (_cache[2] = (...args) => $options.nextWeek && $options.nextWeek(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "›")
        ])
      ]),
      $data.showWeekPicker ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "week-picker-mask",
        onClick: _cache[6] || (_cache[6] = ($event) => $data.showWeekPicker = false)
      }, [
        vue.createElementVNode("view", {
          class: "week-picker-card",
          onClick: _cache[5] || (_cache[5] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("view", { class: "week-picker-header" }, [
            vue.createElementVNode("text", { class: "week-picker-title" }, "选择周次"),
            vue.createElementVNode("text", {
              class: "week-picker-close",
              onClick: _cache[3] || (_cache[3] = ($event) => $data.showWeekPicker = false)
            }, "关闭")
          ]),
          vue.createElementVNode("scroll-view", {
            "scroll-y": "",
            class: "week-picker-list"
          }, [
            vue.createElementVNode("view", { class: "week-picker-grid" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.totalWeeks, (week) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: week,
                    class: vue.normalizeClass(["week-picker-item", $data.selectedWeek === week ? "active" : "", $data.currentWeek === week ? "is-now" : ""]),
                    onClick: ($event) => $options.selectWeek(week)
                  }, [
                    vue.createElementVNode(
                      "text",
                      { class: "week-picker-num" },
                      vue.toDisplayString(week),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "week-picker-tag" },
                      vue.toDisplayString($data.currentWeek === week ? "本周" : ""),
                      1
                      /* TEXT */
                    )
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ]),
          vue.createElementVNode("view", {
            class: "week-picker-footer",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.goToCurrentWeek && $options.goToCurrentWeek(...args))
          }, [
            vue.createElementVNode("text", null, "跳到本周")
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true),
      !$options.hasCourses ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "empty-state"
      }, [
        vue.createElementVNode("view", { class: "empty-illu" }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📅")
        ]),
        vue.createElementVNode("text", { class: "empty-title" }, "还没有课表"),
        vue.createElementVNode("text", { class: "empty-tip" }, "从学校教务系统导入，自动同步本学期所有课程"),
        vue.createElementVNode("button", {
          class: "empty-btn",
          onClick: _cache[7] || (_cache[7] = (...args) => $options.startImport && $options.startImport(...args))
        }, "从教务系统导入"),
        vue.createElementVNode("text", { class: "empty-help" }, "网页端和 App 端都可打开教务系统导入")
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 3,
        class: "schedule-wrap"
      }, [
        vue.createElementVNode("view", { class: "schedule-toolbar" }, [
          vue.createElementVNode("view", { class: "toolbar-info" }, [
            vue.createElementVNode(
              "text",
              { class: "info-count" },
              "共 " + vue.toDisplayString($data.courses.length) + " 门课",
              1
              /* TEXT */
            ),
            $data.meta.importedAt ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "info-time"
              },
              vue.toDisplayString($options.formatImportTime($data.meta.importedAt)) + " 同步",
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", { class: "toolbar-actions" }, [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["manual-toggle", $data.clearManualOnImport ? "is-on" : ""]),
                onClick: _cache[8] || (_cache[8] = (...args) => $options.toggleClearManual && $options.toggleClearManual(...args))
              },
              [
                vue.createElementVNode("view", { class: "manual-toggle-track" }, [
                  vue.createElementVNode("view", { class: "manual-toggle-thumb" })
                ]),
                vue.createElementVNode("text", { class: "manual-toggle-label" }, "重新导入清除手动课")
              ],
              2
              /* CLASS */
            ),
            vue.createElementVNode("button", {
              class: "ghost-btn",
              onClick: _cache[9] || (_cache[9] = (...args) => $options.startImport && $options.startImport(...args))
            }, "重新导入")
          ])
        ]),
        vue.createElementVNode("scroll-view", {
          "scroll-y": "",
          class: "schedule-scroll"
        }, [
          vue.createElementVNode("view", { class: "header-row" }, [
            vue.createElementVNode("view", { class: "time-col header-time" }, [
              vue.createElementVNode("text", { class: "header-label" }, "节次")
            ]),
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($options.weekDays, (day, index) => {
                return vue.openBlock(), vue.createElementBlock(
                  "view",
                  {
                    key: day.label,
                    class: vue.normalizeClass(["day-col", day.isToday ? "is-today" : ""])
                  },
                  [
                    vue.createElementVNode(
                      "text",
                      { class: "day-name" },
                      vue.toDisplayString(day.label),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "day-date" },
                      vue.toDisplayString(day.date),
                      1
                      /* TEXT */
                    )
                  ],
                  2
                  /* CLASS */
                );
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          vue.createElementVNode("view", { class: "grid-body" }, [
            vue.createElementVNode("view", { class: "time-col body-time" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.totalPeriods, (period) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: period,
                    class: "time-cell"
                  }, [
                    vue.createElementVNode(
                      "text",
                      { class: "time-num" },
                      vue.toDisplayString(period),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "time-range" },
                      vue.toDisplayString($options.periodTimeText(period)),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($options.weekDays, (day, dayIndex) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: `col-${day.label}`,
                  class: "day-col body-col"
                }, [
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList($data.totalPeriods, (period) => {
                      return vue.openBlock(), vue.createElementBlock("view", {
                        key: `cell-${dayIndex}-${period}`,
                        class: "grid-cell",
                        onClick: ($event) => $options.onCellTap(dayIndex, period)
                      }, null, 8, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList($options.coursesByDay[dayIndex + 1], (course) => {
                      return vue.openBlock(), vue.createElementBlock("view", {
                        key: course.id + "_" + dayIndex,
                        class: "course-block",
                        style: vue.normalizeStyle($options.getCourseStyle(course)),
                        onClick: vue.withModifiers(($event) => $options.openCourse(course), ["stop"])
                      }, [
                        vue.createElementVNode(
                          "text",
                          { class: "course-name" },
                          vue.toDisplayString(course.subject),
                          1
                          /* TEXT */
                        ),
                        course.location ? (vue.openBlock(), vue.createElementBlock(
                          "text",
                          {
                            key: 0,
                            class: "course-location"
                          },
                          "@" + vue.toDisplayString(course.location),
                          1
                          /* TEXT */
                        )) : vue.createCommentVNode("v-if", true),
                        course.teacher ? (vue.openBlock(), vue.createElementBlock(
                          "text",
                          {
                            key: 1,
                            class: "course-teacher"
                          },
                          vue.toDisplayString(course.teacher),
                          1
                          /* TEXT */
                        )) : vue.createCommentVNode("v-if", true)
                      ], 12, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  $data.pendingSlot && $data.pendingSlot.dayIndex === dayIndex ? (vue.openBlock(), vue.createElementBlock(
                    "view",
                    {
                      key: 0,
                      class: "pending-block",
                      style: vue.normalizeStyle($options.pendingStyle),
                      onClick: _cache[13] || (_cache[13] = vue.withModifiers(() => {
                      }, ["stop"]))
                    },
                    [
                      vue.createElementVNode("view", { class: "pending-actions" }, [
                        vue.createElementVNode(
                          "view",
                          {
                            class: vue.normalizeClass(["pending-arrow", $options.canExpandUp ? "" : "is-disabled"]),
                            onClick: _cache[10] || (_cache[10] = vue.withModifiers((...args) => $options.expandPendingUp && $options.expandPendingUp(...args), ["stop"]))
                          },
                          [
                            vue.createElementVNode("text", { class: "pending-arrow-text" }, "▲")
                          ],
                          2
                          /* CLASS */
                        ),
                        vue.createElementVNode("view", {
                          class: "pending-add",
                          onClick: _cache[11] || (_cache[11] = vue.withModifiers((...args) => $options.openAddPanel && $options.openAddPanel(...args), ["stop"]))
                        }, [
                          vue.createElementVNode("text", { class: "pending-add-text" }, "+")
                        ]),
                        vue.createElementVNode(
                          "view",
                          {
                            class: vue.normalizeClass(["pending-arrow", $options.canExpandDown ? "" : "is-disabled"]),
                            onClick: _cache[12] || (_cache[12] = vue.withModifiers((...args) => $options.expandPendingDown && $options.expandPendingDown(...args), ["stop"]))
                          },
                          [
                            vue.createElementVNode("text", { class: "pending-arrow-text" }, "▼")
                          ],
                          2
                          /* CLASS */
                        )
                      ])
                    ],
                    4
                    /* STYLE */
                  )) : vue.createCommentVNode("v-if", true)
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ])),
      $data.activeCourse ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 4,
        class: "course-mask",
        onClick: _cache[16] || (_cache[16] = ($event) => $data.activeCourse = null)
      }, [
        vue.createElementVNode("view", {
          class: "course-card",
          onClick: _cache[15] || (_cache[15] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode(
            "view",
            {
              class: "course-card-head",
              style: vue.normalizeStyle({ background: $options.resolveColor($data.activeCourse) })
            },
            [
              vue.createElementVNode(
                "text",
                { class: "course-card-title" },
                vue.toDisplayString($data.activeCourse.subject),
                1
                /* TEXT */
              ),
              vue.createElementVNode("text", {
                class: "course-card-close",
                onClick: _cache[14] || (_cache[14] = ($event) => $data.activeCourse = null)
              }, "×")
            ],
            4
            /* STYLE */
          ),
          vue.createElementVNode("view", { class: "course-card-body" }, [
            vue.createElementVNode("view", { class: "course-row" }, [
              vue.createElementVNode("text", { class: "course-label" }, "教师"),
              vue.createElementVNode(
                "text",
                { class: "course-value" },
                vue.toDisplayString($data.activeCourse.teacher || "未知"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "course-row" }, [
              vue.createElementVNode("text", { class: "course-label" }, "教室"),
              vue.createElementVNode(
                "text",
                { class: "course-value" },
                vue.toDisplayString($data.activeCourse.location || "未知"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "course-row" }, [
              vue.createElementVNode("text", { class: "course-label" }, "星期"),
              vue.createElementVNode(
                "text",
                { class: "course-value" },
                "星期" + vue.toDisplayString($options.weekDayName($data.activeCourse.dayOfWeek)) + " 第" + vue.toDisplayString($data.activeCourse.startPeriod) + "-" + vue.toDisplayString($data.activeCourse.endPeriod) + "节",
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "course-row" }, [
              vue.createElementVNode("text", { class: "course-label" }, "周次"),
              vue.createElementVNode(
                "text",
                { class: "course-value" },
                vue.toDisplayString($data.activeCourse.weekText || $data.activeCourse.weeks.join(",") + "周"),
                1
                /* TEXT */
              )
            ]),
            $data.activeCourse.note ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "course-row"
            }, [
              vue.createElementVNode("text", { class: "course-label" }, "备注"),
              vue.createElementVNode(
                "text",
                { class: "course-value" },
                vue.toDisplayString($data.activeCourse.note),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true),
      $data.showAddPanel ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 5,
        class: "add-mask",
        onClick: _cache[27] || (_cache[27] = (...args) => $options.closeAddPanel && $options.closeAddPanel(...args))
      }, [
        vue.createElementVNode("view", {
          class: "add-card",
          onClick: _cache[26] || (_cache[26] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("view", { class: "add-head" }, [
            vue.createElementVNode("view", null, [
              vue.createElementVNode("text", { class: "add-title" }, "添加课程"),
              vue.createElementVNode(
                "text",
                { class: "add-subtitle" },
                vue.toDisplayString($data.pendingSlot ? `周${$options.weekDayName($data.pendingSlot.dayIndex + 1)} 第${$data.pendingSlot.startPeriod}-${$data.pendingSlot.endPeriod}节` : ""),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("text", {
              class: "add-close",
              onClick: _cache[17] || (_cache[17] = (...args) => $options.closeAddPanel && $options.closeAddPanel(...args))
            }, "×")
          ]),
          vue.createElementVNode("view", { class: "add-tabs" }, [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["add-tab", $data.addPanelMode === "pick" ? "active" : ""]),
                onClick: _cache[18] || (_cache[18] = ($event) => $options.switchAddMode("pick"))
              },
              [
                vue.createElementVNode("text", null, "选择已有课程")
              ],
              2
              /* CLASS */
            ),
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["add-tab", $data.addPanelMode === "create" ? "active" : ""]),
                onClick: _cache[19] || (_cache[19] = ($event) => $options.switchAddMode("create"))
              },
              [
                vue.createElementVNode("text", null, "快捷新建")
              ],
              2
              /* CLASS */
            )
          ]),
          $data.addPanelMode === "pick" ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "add-body"
          }, [
            vue.withDirectives(vue.createElementVNode(
              "input",
              {
                class: "add-search",
                type: "text",
                "onUpdate:modelValue": _cache[20] || (_cache[20] = ($event) => $data.courseSearch = $event),
                placeholder: "搜索课程名 / 老师 / 教室"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [vue.vModelText, $data.courseSearch]
            ]),
            vue.createElementVNode("scroll-view", {
              "scroll-y": "",
              class: "add-pick-list"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($options.uniqueCourseOptions, (item, idx) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `opt-${idx}`,
                    class: "add-pick-item",
                    onClick: ($event) => $options.pickExistingCourse(item)
                  }, [
                    vue.createElementVNode(
                      "view",
                      {
                        class: "add-pick-color",
                        style: vue.normalizeStyle({ background: item.color || "#2979ff" })
                      },
                      null,
                      4
                      /* STYLE */
                    ),
                    vue.createElementVNode("view", { class: "add-pick-info" }, [
                      vue.createElementVNode(
                        "text",
                        { class: "add-pick-name" },
                        vue.toDisplayString(item.subject),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode("text", { class: "add-pick-meta" }, [
                        item.teacher ? (vue.openBlock(), vue.createElementBlock(
                          "text",
                          { key: 0 },
                          vue.toDisplayString(item.teacher),
                          1
                          /* TEXT */
                        )) : vue.createCommentVNode("v-if", true),
                        item.teacher && item.location ? (vue.openBlock(), vue.createElementBlock("text", { key: 1 }, " · ")) : vue.createCommentVNode("v-if", true),
                        item.location ? (vue.openBlock(), vue.createElementBlock(
                          "text",
                          { key: 2 },
                          vue.toDisplayString(item.location),
                          1
                          /* TEXT */
                        )) : vue.createCommentVNode("v-if", true),
                        !item.teacher && !item.location ? (vue.openBlock(), vue.createElementBlock("text", { key: 3 }, "仅本周该节次添加")) : vue.createCommentVNode("v-if", true)
                      ])
                    ]),
                    vue.createElementVNode("text", { class: "add-pick-arrow" }, "›")
                  ], 8, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              $options.uniqueCourseOptions.length === 0 ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "add-pick-empty"
              }, [
                vue.createElementVNode("text", null, '暂无可选课程，去"快捷新建"页吧')
              ])) : vue.createCommentVNode("v-if", true)
            ]),
            vue.createElementVNode("view", { class: "add-pick-tip" }, [
              vue.createElementVNode("text", null, "选择后会按本周该节次新增一节课")
            ])
          ])) : (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "add-body"
          }, [
            vue.createElementVNode("view", { class: "add-form-row" }, [
              vue.createElementVNode("text", { class: "add-form-label" }, "课程名"),
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "add-form-input",
                  type: "text",
                  "onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => $data.createForm.subject = $event),
                  placeholder: "必填，例如：高等数学"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.createForm.subject]
              ])
            ]),
            vue.createElementVNode("view", { class: "add-form-row" }, [
              vue.createElementVNode("text", { class: "add-form-label" }, "教师"),
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "add-form-input",
                  type: "text",
                  "onUpdate:modelValue": _cache[22] || (_cache[22] = ($event) => $data.createForm.teacher = $event),
                  placeholder: "可选"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.createForm.teacher]
              ])
            ]),
            vue.createElementVNode("view", { class: "add-form-row" }, [
              vue.createElementVNode("text", { class: "add-form-label" }, "教室"),
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "add-form-input",
                  type: "text",
                  "onUpdate:modelValue": _cache[23] || (_cache[23] = ($event) => $data.createForm.location = $event),
                  placeholder: "可选"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.createForm.location]
              ])
            ]),
            vue.createElementVNode("view", {
              class: "add-form-toggle",
              onClick: _cache[24] || (_cache[24] = ($event) => $data.createForm.applyAllWeeks = !$data.createForm.applyAllWeeks)
            }, [
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["add-form-checkbox", $data.createForm.applyAllWeeks ? "checked" : ""])
                },
                [
                  $data.createForm.applyAllWeeks ? (vue.openBlock(), vue.createElementBlock("text", {
                    key: 0,
                    class: "add-form-check"
                  }, "✓")) : vue.createCommentVNode("v-if", true)
                ],
                2
                /* CLASS */
              ),
              vue.createElementVNode("text", { class: "add-form-toggle-text" }, "每周该节次都加上（不勾选则只加本周）")
            ]),
            vue.createElementVNode("button", {
              class: "add-form-submit",
              onClick: _cache[25] || (_cache[25] = (...args) => $options.submitCreateForm && $options.submitCreateForm(...args))
            }, "添加到课表")
          ]))
        ])
      ])) : vue.createCommentVNode("v-if", true),
      $data.showWebImport ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 6,
        class: "web-import-mask"
      }, [
        vue.createElementVNode("view", {
          class: "web-import-card",
          onClick: _cache[31] || (_cache[31] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("view", { class: "web-import-head" }, [
            vue.createElementVNode("view", null, [
              vue.createElementVNode("text", { class: "web-import-title" }, "从教务系统导入"),
              vue.createElementVNode("text", { class: "web-import-subtitle" }, "登录学校官网后进入个人课表查询，再点击自动抓取")
            ]),
            vue.createElementVNode("text", {
              class: "web-import-close",
              onClick: _cache[28] || (_cache[28] = (...args) => $options.closeWebImport && $options.closeWebImport(...args))
            }, "×")
          ]),
          vue.createElementVNode("view", { class: "web-import-body" }, [
            $data.webImportStatus ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "web-import-status"
            }, [
              vue.createElementVNode(
                "text",
                null,
                vue.toDisplayString($data.webImportStatus),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true),
            $data.webImportError ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "web-import-error"
            }, [
              vue.createElementVNode(
                "text",
                null,
                vue.toDisplayString($data.webImportError),
                1
                /* TEXT */
              )
            ])) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", { class: "web-import-actions" }, [
            vue.createElementVNode("button", {
              class: "web-cancel-btn",
              onClick: _cache[29] || (_cache[29] = (...args) => $options.reloadWebImport && $options.reloadWebImport(...args))
            }, "重载网页"),
            vue.createElementVNode("button", {
              class: "web-submit-btn",
              disabled: $data.webAutoBusy,
              onClick: _cache[30] || (_cache[30] = (...args) => $options.runWebAutoImport && $options.runWebAutoImport(...args))
            }, vue.toDisplayString($data.webAutoBusy ? "抓取中..." : "自动抓取课表"), 9, ["disabled"])
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesScheduleSchedule = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["render", _sfc_render$9], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/schedule/schedule.vue"]]);
  const _sfc_main$9 = {
    onLoad() {
      uni.switchTab({
        url: "/pages/record/record"
      });
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("text", { class: "redirect-text" }, "正在跳转...")
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/index/index.vue"]]);
  const NOTIFIED_KEY = "notified_homework_ids";
  const NOTICE_STATUS_KEY = "homework_notice_enabled";
  const NOTICE_FIRST_REQUEST_KEY = "homework_notice_first_requested";
  const NOTICE_TEMPLATE_ID = "_VTD5RnbyzssDWFq7RhAuOavo1BZB8FUro6mNNwODfc";
  let notificationPermission = false;
  function getNotifiedIds() {
    try {
      return uni.getStorageSync(NOTIFIED_KEY) || [];
    } catch (e) {
      return [];
    }
  }
  function markAsNotified(homeworkId) {
    const ids = getNotifiedIds();
    if (!ids.includes(homeworkId)) {
      ids.push(homeworkId);
      uni.setStorageSync(NOTIFIED_KEY, ids);
    }
  }
  function isNotified(homeworkId) {
    return getNotifiedIds().includes(homeworkId);
  }
  function setNoticeStatus(enabled) {
    notificationPermission = enabled;
    uni.setStorageSync(NOTICE_STATUS_KEY, enabled);
  }
  function getWechatSubscribeApi() {
    if (typeof uni.requestSubscribeMessage === "function")
      return uni.requestSubscribeMessage;
    return null;
  }
  function isTemplateReady() {
    return !NOTICE_TEMPLATE_ID.includes("请替换");
  }
  function getNotificationPermissionStatus() {
    try {
      notificationPermission = !!uni.getStorageSync(NOTICE_STATUS_KEY);
      return notificationPermission;
    } catch (e) {
      return notificationPermission;
    }
  }
  function shouldRequestNotificationOnFirstLaunch() {
    return !uni.getStorageSync(NOTICE_FIRST_REQUEST_KEY);
  }
  function resetNotificationStatus(homeworkId) {
    const ids = getNotifiedIds();
    const index = ids.indexOf(homeworkId);
    if (index !== -1) {
      ids.splice(index, 1);
      uni.setStorageSync(NOTIFIED_KEY, ids);
    }
  }
  function getPlatform() {
    if (uni.getSystemInfoSync().platform === "android") {
      return "app-android";
    } else if (uni.getSystemInfoSync().platform === "ios") {
      return "app-ios";
    }
    return "unknown";
  }
  async function requestNotificationPermission(options = {}) {
    const { silent = false, showToast = false } = options;
    const platform = getPlatform();
    uni.setStorageSync(NOTICE_FIRST_REQUEST_KEY, true);
    try {
      if (platform === "mp-weixin") {
        const requestSubscribeMessage = getWechatSubscribeApi();
        if (!requestSubscribeMessage) {
          if (!silent)
            uni.showToast({ title: "当前环境不支持服务通知", icon: "none" });
          setNoticeStatus(false);
          return false;
        }
        if (!isTemplateReady()) {
          if (!silent)
            uni.showToast({ title: "请先配置订阅消息模板ID", icon: "none" });
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
          uni.showToast({ title: enabled ? "通知已开启" : "未开启通知", icon: "none" });
        }
        return enabled;
      }
      if (platform === "app-android" || platform === "app-ios") {
        setNoticeStatus(true);
        if (showToast)
          uni.showToast({ title: "通知已开启", icon: "success" });
        return true;
      }
    } catch (e) {
      formatAppLog("error", "at utils/notification.js:157", "请求通知权限失败：", e);
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
      sendWechatServiceNotification(title, content);
    } else if (platform === "app-android") {
      sendAndroidNotification(title, content, delay, id);
    } else if (platform === "app-ios") {
      sendIOSNotification(title, content, delay, id);
    }
  }
  function sendWechatServiceNotification(title, content, id, homework) {
    uni.showModal({
      title,
      content,
      showCancel: false
    });
  }
  function sendAndroidNotification(title, content, delay, id) {
    try {
      const main = plus.android.runtimeMainActivity();
      const NotificationManager = plus.android.importClass("android.app.NotificationManager");
      const Context = plus.android.importClass("android.content.Context");
      const nm = main.getSystemService(Context.NOTIFICATION_SERVICE);
      const builder = plus.android.newObject("androidx.core.app.NotificationCompat$Builder", main, "homework_reminder");
      plus.android.invoke(builder, "setSmallIcon", main.getApplicationInfo().icon);
      plus.android.invoke(builder, "setContentTitle", title);
      plus.android.invoke(builder, "setContentText", content);
      plus.android.invoke(builder, "setAutoCancel", true);
      plus.android.invoke(builder, "setPriority", 1);
      const notification = plus.android.invoke(builder, "build");
      nm.notify(parseInt(id) || Date.now(), notification);
    } catch (e) {
      formatAppLog("error", "at utils/notification.js:230", "Android 通知发送失败：", e);
    }
  }
  function sendIOSNotification(title, content, delay, id) {
    try {
      const UIApplication = plus.ios.importClass("UIApplication");
      const UILocalNotification = plus.ios.importClass("UILocalNotification");
      const NSDate = plus.ios.importClass("NSDate");
      const notification = plus.ios.newObject("UILocalNotification");
      notification.setFireDate(NSDate.dateWithTimeIntervalSinceNow(delay / 1e3));
      notification.setAlertTitle(title);
      notification.setAlertBody(content);
      notification.setAlertAction("查看");
      notification.setSoundName("UILocalNotificationDefaultSoundName");
      notification.setApplicationIconBadgeNumber(1);
      notification.setUserInfo({ id: id || Date.now().toString() });
      UIApplication.sharedApplication().scheduleLocalNotification(notification);
      plus.ios.deleteObject(notification);
    } catch (e) {
      formatAppLog("error", "at utils/notification.js:252", "iOS 通知发送失败：", e);
    }
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
  function cancelHomeworkReminder(homeworkId) {
    const platform = getPlatform();
    if (platform === "app-android") {
      try {
        const main = plus.android.runtimeMainActivity();
        const NotificationManager = plus.android.importClass("android.app.NotificationManager");
        const Context = plus.android.importClass("android.content.Context");
        const nm = main.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(parseInt(homeworkId) || 0);
      } catch (e) {
        formatAppLog("error", "at utils/notification.js:291", "取消 Android 通知失败：", e);
      }
    } else if (platform === "app-ios") {
      try {
        const UIApplication = plus.ios.importClass("UIApplication");
        const app = UIApplication.sharedApplication();
        const notifications = app.scheduledLocalNotifications();
        const count = plus.ios.invoke(notifications, "count");
        for (let i = 0; i < count; i++) {
          const notification = plus.ios.invoke(notifications, "objectAtIndex:", i);
          const userInfo = plus.ios.invoke(notification, "userInfo");
          const id = plus.ios.invoke(userInfo, "objectForKey:", "id");
          if (id === homeworkId) {
            app.cancelLocalNotification(notification);
            break;
          }
        }
      } catch (e) {
        formatAppLog("error", "at utils/notification.js:311", "取消 iOS 通知失败：", e);
      }
    }
  }
  function checkAndSetReminders(homeworkList) {
    homeworkList.forEach((homework) => {
      if (!homework.completed) {
        setHomeworkReminder(homework);
      }
    });
  }
  const _imports_2$1 = "/static/delete.png";
  const _imports_1 = "/static/audio.png";
  const _imports_2 = "/static/camera.png";
  const _imports_3 = "/static/plus.png";
  const _imports_4 = "/static/send.png";
  const HOMEWORK_KEY$3 = "homework_list";
  const SUBJECT_KEY$2 = "subject_list";
  const DEFAULT_DEADLINE_OFFSET_KEY$2 = "default_deadline_offset_hours";
  const DEFAULT_DEADLINE_OFFSET_HOURS$2 = 24;
  const DEFAULT_REMINDER_OFFSET_KEY$2 = "default_reminder_offset_hours";
  const DEFAULT_REMINDER_OFFSET_HOURS$2 = 23;
  const DEFAULT_SUBJECTS$2 = ["高等数学", "大学英语", "程序设计", "数据结构", "线性代数"];
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
    "/static/tab-schedule-active.png",
    "/static/tab-schedule.png",
    "/static/tab-view-active.png",
    "/static/tab-view.png"
  ];
  let viewPagePreloaded = false;
  let iconImagesPreloaded = false;
  const _sfc_main$8 = {
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
          uni.getImageInfo({
            src,
            complete: () => preloadNext(index + 1)
          });
        };
        preloadNext(0);
      },
      preloadViewPage() {
        if (viewPagePreloaded || typeof uni.preloadPage !== "function")
          return;
        viewPagePreloaded = true;
        uni.preloadPage({
          url: "/pages/view/view",
          fail: () => {
            viewPagePreloaded = false;
          }
        });
        uni.preloadPage({
          url: "/pages/settings/settings"
        });
        uni.preloadPage({
          url: "/pages/schedule/schedule"
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
        formatAppLog("log", "at pages/record/record.vue:286", `[作业助手][录音] ${step}`, {
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
        if (typeof uni.getRecorderManager !== "function") {
          this.logAudioRecord("当前运行环境不支持 uni.getRecorderManager");
          uni.showToast({ title: "当前环境不支持录音", icon: "none" });
          return;
        }
        this.recorderManager = uni.getRecorderManager();
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
            uni.showToast({ title: "录音时间太短，请重试", icon: "none" });
            return;
          }
          if (!res || !res.tempFilePath) {
            this.resetRecordingRuntimeState("onStop empty tempFilePath");
            this.logAudioRecord("录音停止但没有返回 tempFilePath", { res });
            uni.showToast({ title: "录音文件无效，请重试", icon: "none" });
            return;
          }
          try {
            await this.attachAudioHomework(res.tempFilePath, duration);
            this.resetRecordingRuntimeState("onStop attachAudioHomework done");
            this.resetRecordingUiState("onStop attachAudioHomework done");
          } catch (e) {
            this.resetRecordingRuntimeState("onStop attachAudioHomework error");
            this.logAudioRecord("添加录音附件异常", { error: e });
            uni.showToast({ title: "录音保存失败，请重试", icon: "none" });
          }
        });
        this.recorderManager.onError((err) => {
          this.logAudioRecord("录音错误回调触发", { err });
          this.resetRecordingUiState("onError");
          this.resetRecordingRuntimeState("onError");
          uni.showToast({ title: "录音失败，请重试", icon: "none" });
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
          uni.showToast({ title: "录音处理中，请稍候", icon: "none" });
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
          uni.showToast({ title: "录音启动失败", icon: "none" });
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
          uni.showToast({ title: "停止录音失败", icon: "none" });
        }
      },
      toggleVoiceRecord() {
        this.logAudioRecord("切换录音状态");
        if (this.isRecordStopping) {
          this.logAudioRecord("切换录音状态被忽略：录音正在停止中");
          uni.showToast({ title: "录音处理中，请稍候", icon: "none" });
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
        this.logAudioRecord("准备保存录音文件", { tempFilePath, hasSaveFile: typeof uni.saveFile === "function" });
        if (!tempFilePath) {
          this.logAudioRecord("保存录音失败：tempFilePath 为空");
          uni.showToast({ title: "录音文件无效，请重试", icon: "none" });
          return "";
        }
        if (typeof uni.saveFile !== "function") {
          this.logAudioRecord("当前环境不支持 uni.saveFile，使用临时路径作为录音附件", { tempFilePath });
          return tempFilePath;
        }
        try {
          const res = await new Promise((resolve, reject) => {
            uni.saveFile({
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
        uni.showToast({ title: "录音已添加", icon: "success" });
      },
      loadSubjects() {
        const saved = uni.getStorageSync(SUBJECT_KEY$2);
        if (Array.isArray(saved) && saved.length) {
          this.subjectList = saved;
          return;
        }
        this.subjectList = DEFAULT_SUBJECTS$2.map((name) => ({
          id: this.createId(),
          name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }));
        this.saveSubjects();
      },
      loadHomework() {
        const saved = uni.getStorageSync(HOMEWORK_KEY$3);
        this.homeworkList = Array.isArray(saved) ? saved : [];
      },
      saveSubjects() {
        uni.setStorageSync(SUBJECT_KEY$2, this.subjectList);
      },
      saveHomeworkList() {
        uni.setStorageSync(HOMEWORK_KEY$3, this.homeworkList);
      },
      takePhoto() {
        uni.chooseImage({
          count: 1,
          sourceType: ["camera"],
          success: (res) => {
            this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || []);
            this.syncLegacyAttachmentFields();
            this.form.subject = this.subjectNames[0] || "";
            this.showPhotoAction = true;
          },
          fail: () => {
            uni.showToast({ title: "未完成拍照", icon: "none" });
          }
        });
      },
      chooseImage() {
        uni.chooseImage({
          count: 9,
          sourceType: ["album", "camera"],
          success: (res) => {
            this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || []);
            this.syncLegacyAttachmentFields();
            this.form.subject = this.subjectNames[0] || "";
            this.showPhotoAction = !this.showForm;
          },
          fail: () => {
            uni.showToast({ title: "未选择图片", icon: "none" });
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
          uni.showToast({ title: "请输入作业内容或添加附件", icon: "none" });
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
          uni.showToast({ title: "请输入学科名称", icon: "none" });
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
        uni.showToast({ title: exists ? "已选择该学科" : "学科已新建", icon: "none" });
      },
      async saveHomework() {
        if (!this.hasAttachment && !this.form.note.trim()) {
          uni.showToast({ title: "请输入作业内容或添加附件", icon: "none" });
          return;
        }
        if (!this.form.subject) {
          uni.showToast({ title: "请选择学科", icon: "none" });
          return;
        }
        if (!this.form.deadlineDate || !this.form.deadlineTime) {
          uni.showToast({ title: "请选择截止时间", icon: "none" });
          return;
        }
        const deadline = `${this.form.deadlineDate}T${this.form.deadlineTime}:00`;
        const reminderOffsetHours = Number(this.form.reminderOffsetHours);
        if (!Number.isInteger(reminderOffsetHours) || reminderOffsetHours <= 0 || reminderOffsetHours > 168) {
          uni.showToast({ title: "提醒时间需为 1-168 小时", icon: "none" });
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
            resetNotificationStatus(this.homeworkList[index].id);
            setHomeworkReminder(this.homeworkList[index]);
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
            noticeEnabled = await requestNotificationPermission();
          } catch (e) {
            formatAppLog("warn", "at pages/record/record.vue:722", "通知权限请求失败：", e);
          }
          if (noticeEnabled) {
            setHomeworkReminder(newHomework);
          }
        }
        this.resetForm();
        uni.showToast({ title: this.editingId ? "已更新" : "已保存", icon: "success" });
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
        const audio = uni.createInnerAudioContext();
        audio.src = path;
        audio.onEnded(() => audio.destroy());
        audio.onError(() => {
          audio.destroy();
          uni.showToast({ title: "语音播放失败", icon: "none" });
        });
        audio.play();
      },
      previewImage(path) {
        if (!path)
          return;
        uni.previewImage({ urls: this.form.imagePaths.length ? this.form.imagePaths : [path], current: path });
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
        const saved = Number(uni.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY$2));
        return saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS$2;
      },
      getDefaultReminderOffsetHours() {
        const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY$2));
        return saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS$2;
      },
      getDefaultReminderOffsetHours() {
        const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY$2));
        return saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS$2;
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
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("text", { class: "nav-title" }, "记录作业")
      ]),
      vue.createElementVNode("view", { class: "camera-panel" }, [
        vue.createElementVNode("button", {
          class: "camera-circle",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.takePhoto && $options.takePhoto(...args))
        }, [
          vue.createElementVNode("view", { class: "camera-icon" }, [
            vue.createElementVNode("view", { class: "camera-lens" })
          ])
        ]),
        vue.createElementVNode("text", { class: "camera-title" }, "拍照记录作业"),
        vue.createElementVNode("text", { class: "camera-subtitle" }, "拍下黑板或作业内容，快速保存提醒")
      ]),
      vue.createElementVNode("view", { class: "input-section" }, [
        $data.showPhotoAction ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "photo-action-mask",
          onClick: _cache[2] || (_cache[2] = (...args) => $options.closePhotoAction && $options.closePhotoAction(...args))
        }, [
          vue.createElementVNode("scroll-view", {
            "scroll-x": "",
            class: "photo-action-scroll",
            onClick: _cache[1] || (_cache[1] = vue.withModifiers(() => {
            }, ["stop"]))
          }, [
            vue.createElementVNode("view", { class: "photo-action-card" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.form.imagePaths, (path, index) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `image-${index}-${path}`,
                    class: "attachment-tile image-attachment-tile"
                  }, [
                    vue.createElementVNode("image", {
                      class: "attachment-thumb",
                      src: path,
                      mode: "aspectFill",
                      onClick: ($event) => $options.previewImage(path)
                    }, null, 8, ["src", "onClick"]),
                    vue.createElementVNode("image", {
                      class: "remove-attachment",
                      src: _imports_2$1,
                      mode: "aspectFit",
                      onClick: vue.withModifiers(($event) => $options.removeImageAttachment(index), ["stop"])
                    }, null, 8, ["onClick"])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.form.audios, (audio, index) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `audio-${index}-${audio.path}`,
                    class: "attachment-tile audio-attachment-tile",
                    onClick: ($event) => $options.playAudio(audio.path)
                  }, [
                    vue.createElementVNode("image", {
                      class: "audio-attachment-img",
                      src: _imports_1,
                      mode: "aspectFit"
                    }),
                    vue.createElementVNode(
                      "text",
                      { class: "audio-attachment-text" },
                      vue.toDisplayString(audio.duration || 1) + "秒",
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode("image", {
                      class: "remove-attachment",
                      src: _imports_2$1,
                      mode: "aspectFit",
                      onClick: vue.withModifiers(($event) => $options.removeAudioAttachment(index), ["stop"])
                    }, null, 8, ["onClick"])
                  ], 8, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        !$data.isRecording ? (vue.openBlock(), vue.createElementBlock(
          "view",
          {
            key: 1,
            class: vue.normalizeClass(["message-input-bar", $data.inputFocused || $data.form.note.trim() || $options.hasAttachment ? "expanded" : ""]),
            style: vue.normalizeStyle($options.inputBarStyle)
          },
          [
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["voice-btn", $data.isRecording ? "recording" : ""]),
                onClick: _cache[3] || (_cache[3] = (...args) => $options.toggleVoiceRecord && $options.toggleVoiceRecord(...args))
              },
              [
                vue.createElementVNode("image", {
                  class: "bar-icon",
                  src: $data.isRecording ? "/static/stop.png" : "/static/audio.png",
                  mode: "aspectFit"
                }, null, 8, ["src"])
              ],
              2
              /* CLASS */
            ),
            vue.withDirectives(vue.createElementVNode("textarea", {
              class: "message-input",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.note = $event),
              style: vue.normalizeStyle($options.messageInputStyle),
              placeholder: $data.isRecording ? "正在录音，再点一次停止..." : "文字记录",
              maxlength: "200",
              "auto-height": false,
              "show-confirm-bar": false,
              onFocus: _cache[5] || (_cache[5] = ($event) => $data.inputFocused = true),
              onBlur: _cache[6] || (_cache[6] = ($event) => $data.inputFocused = false)
            }, null, 44, ["placeholder"]), [
              [vue.vModelText, $data.form.note]
            ]),
            vue.createElementVNode("view", { class: "right-actions" }, [
              vue.createElementVNode("view", {
                class: "bar-camera",
                onClick: _cache[7] || (_cache[7] = ($event) => $options.hasAttachment || $data.form.note.trim() ? $options.chooseImage() : $options.takePhoto())
              }, [
                !$options.hasAttachment && !$data.form.note.trim() ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  class: "bar-icon camera-bar-icon",
                  src: _imports_2,
                  mode: "aspectFit"
                })) : (vue.openBlock(), vue.createElementBlock("image", {
                  key: 1,
                  class: "bar-icon",
                  src: _imports_3,
                  mode: "aspectFit"
                }))
              ]),
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["bar-plus", $options.hasAttachment || $data.form.note.trim() ? "next" : ""]),
                  onClick: _cache[8] || (_cache[8] = ($event) => $options.hasAttachment || $data.form.note.trim() ? $options.openForm() : $options.chooseImage())
                },
                [
                  !$options.hasAttachment && !$data.form.note.trim() ? (vue.openBlock(), vue.createElementBlock("image", {
                    key: 0,
                    class: "bar-icon",
                    src: _imports_3,
                    mode: "aspectFit"
                  })) : (vue.openBlock(), vue.createElementBlock("image", {
                    key: 1,
                    class: "bar-icon send-icon",
                    src: _imports_4,
                    mode: "aspectFit"
                  }))
                ],
                2
                /* CLASS */
              )
            ])
          ],
          6
          /* CLASS, STYLE */
        )) : vue.createCommentVNode("v-if", true),
        $data.isRecording ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "recording-card",
          onClick: _cache[9] || (_cache[9] = (...args) => $options.stopVoiceRecord && $options.stopVoiceRecord(...args))
        }, [
          vue.createElementVNode("view", { class: "recording-pulse" }, [
            vue.createElementVNode("view", { class: "pulse-ring" }),
            vue.createElementVNode("view", { class: "pulse-dot" })
          ]),
          vue.createElementVNode("view", { class: "recording-info" }, [
            vue.createElementVNode("text", { class: "recording-title" }, "正在录音"),
            vue.createElementVNode("text", { class: "recording-subtitle" }, "再次点击麦克风或点此停止，录音会作为附件保存")
          ]),
          vue.createElementVNode("view", { class: "recording-wave" }, [
            vue.createElementVNode("view"),
            vue.createElementVNode("view"),
            vue.createElementVNode("view"),
            vue.createElementVNode("view")
          ])
        ])) : vue.createCommentVNode("v-if", true)
      ]),
      $data.showForm ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "form-mask",
        onClick: _cache[22] || (_cache[22] = (...args) => $options.closeForm && $options.closeForm(...args))
      }, [
        vue.createElementVNode("scroll-view", {
          "scroll-y": "",
          class: "form-card",
          onClick: _cache[21] || (_cache[21] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("view", { class: "form-title-row" }, [
            vue.createElementVNode(
              "text",
              { class: "form-title" },
              vue.toDisplayString($data.editingId ? "编辑作业" : $options.hasAttachment ? "保存作业" : "保存文字作业"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", {
              class: "form-close",
              onClick: _cache[10] || (_cache[10] = (...args) => $options.closeForm && $options.closeForm(...args))
            }, "取消")
          ]),
          vue.createElementVNode("view", { class: "attachment-edit-actions" }, [
            vue.createElementVNode("view", {
              class: "attachment-add-btn",
              onClick: _cache[11] || (_cache[11] = (...args) => $options.chooseImage && $options.chooseImage(...args))
            }, "添加图片"),
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["attachment-add-btn", $data.isRecording ? "recording" : ""]),
                onClick: _cache[12] || (_cache[12] = (...args) => $options.toggleVoiceRecord && $options.toggleVoiceRecord(...args))
              },
              vue.toDisplayString($data.isRecording ? "停止录音" : "添加录音"),
              3
              /* TEXT, CLASS */
            )
          ]),
          $data.form.imagePaths.length || $data.form.audios.length ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "form-preview-grid"
          }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.form.imagePaths, (path, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: `form-image-${index}-${path}`,
                  class: "preview-tile"
                }, [
                  vue.createElementVNode("image", {
                    class: "preview",
                    src: path,
                    mode: "aspectFill",
                    onClick: ($event) => $options.previewImage(path)
                  }, null, 8, ["src", "onClick"]),
                  vue.createElementVNode("image", {
                    class: "remove-attachment preview-remove",
                    src: _imports_2$1,
                    mode: "aspectFit",
                    onClick: vue.withModifiers(($event) => $options.removeImageAttachment(index), ["stop"])
                  }, null, 8, ["onClick"])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.form.audios, (audio, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: `form-audio-${index}-${audio.path}`,
                  class: "preview-tile audio-preview-tile",
                  onClick: ($event) => $options.playAudio(audio.path)
                }, [
                  vue.createElementVNode("image", {
                    class: "audio-attachment-img",
                    src: _imports_1,
                    mode: "aspectFit"
                  }),
                  vue.createElementVNode(
                    "text",
                    { class: "audio-attachment-text" },
                    vue.toDisplayString(audio.duration || 1) + "秒",
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("image", {
                    class: "remove-attachment preview-remove",
                    src: _imports_2$1,
                    mode: "aspectFit",
                    onClick: vue.withModifiers(($event) => $options.removeAudioAttachment(index), ["stop"])
                  }, null, 8, ["onClick"])
                ], 8, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", { class: "field" }, [
            vue.createElementVNode("text", { class: "label" }, "选择学科"),
            vue.createElementVNode("picker", {
              range: $options.subjectNames,
              onChange: _cache[13] || (_cache[13] = (...args) => $options.onSubjectChange && $options.onSubjectChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-box" },
                vue.toDisplayString($data.form.subject || "从已建学科中选择"),
                1
                /* TEXT */
              )
            ], 40, ["range"])
          ]),
          vue.createElementVNode("view", { class: "quick-subject" }, [
            vue.withDirectives(vue.createElementVNode(
              "input",
              {
                class: "subject-input",
                "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => $data.newSubjectName = $event),
                placeholder: "快捷新建学科",
                maxlength: "20"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [vue.vModelText, $data.newSubjectName]
            ]),
            vue.createElementVNode("button", {
              class: "small-btn",
              onClick: _cache[15] || (_cache[15] = (...args) => $options.addSubject && $options.addSubject(...args))
            }, "新建")
          ]),
          vue.createElementVNode("view", { class: "date-row" }, [
            vue.createElementVNode("view", { class: "field half" }, [
              vue.createElementVNode("text", { class: "label" }, "截止日期"),
              vue.createElementVNode("picker", {
                mode: "date",
                value: $data.form.deadlineDate,
                onChange: _cache[16] || (_cache[16] = (...args) => $options.onDateChange && $options.onDateChange(...args))
              }, [
                vue.createElementVNode(
                  "view",
                  { class: "picker-box" },
                  vue.toDisplayString($data.form.deadlineDate || "选择日期"),
                  1
                  /* TEXT */
                )
              ], 40, ["value"])
            ]),
            vue.createElementVNode("view", { class: "field half" }, [
              vue.createElementVNode("text", { class: "label" }, "截止时间"),
              vue.createElementVNode("picker", {
                mode: "time",
                value: $data.form.deadlineTime,
                onChange: _cache[17] || (_cache[17] = (...args) => $options.onTimeChange && $options.onTimeChange(...args))
              }, [
                vue.createElementVNode(
                  "view",
                  { class: "picker-box" },
                  vue.toDisplayString($data.form.deadlineTime || "选择时间"),
                  1
                  /* TEXT */
                )
              ], 40, ["value"])
            ])
          ]),
          vue.createElementVNode("view", { class: "field" }, [
            vue.createElementVNode("text", { class: "label" }, "提醒时间"),
            vue.createElementVNode("view", { class: "reminder-row" }, [
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "reminder-input",
                  type: "number",
                  "onUpdate:modelValue": _cache[18] || (_cache[18] = ($event) => $data.form.reminderOffsetHours = $event),
                  placeholder: "23",
                  maxlength: "3"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.form.reminderOffsetHours]
              ]),
              vue.createElementVNode("text", { class: "reminder-unit" }, "截止前小时提醒")
            ])
          ]),
          vue.createElementVNode("view", { class: "field" }, [
            vue.createElementVNode(
              "text",
              { class: "label" },
              vue.toDisplayString($options.hasAttachment ? "备注" : "作业内容"),
              1
              /* TEXT */
            ),
            vue.withDirectives(vue.createElementVNode("textarea", {
              class: "note",
              "onUpdate:modelValue": _cache[19] || (_cache[19] = ($event) => $data.form.note = $event),
              placeholder: $options.hasAttachment ? "例如：第 3 章习题、需要提交实验报告" : "请输入老师布置的作业内容",
              maxlength: "200"
            }, null, 8, ["placeholder"]), [
              [vue.vModelText, $data.form.note]
            ])
          ]),
          vue.createElementVNode(
            "button",
            {
              class: "save-btn",
              onClick: _cache[20] || (_cache[20] = (...args) => $options.saveHomework && $options.saveHomework(...args))
            },
            vue.toDisplayString($data.editingId ? "保存修改" : $options.hasAttachment ? "保存到看板" : "保存文字作业"),
            1
            /* TEXT */
          )
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesRecordRecord = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/record/record.vue"]]);
  const _imports_0 = "/static/more.png";
  const HOMEWORK_KEY$2 = "homework_list";
  const SUBJECT_KEY$1 = "subject_list";
  const DEFAULT_DEADLINE_OFFSET_KEY$1 = "default_deadline_offset_hours";
  const DEFAULT_DEADLINE_OFFSET_HOURS$1 = 24;
  const DEFAULT_REMINDER_OFFSET_KEY$1 = "default_reminder_offset_hours";
  const DEFAULT_REMINDER_OFFSET_HOURS$1 = 23;
  const DEFAULT_SUBJECTS$1 = ["高等数学", "大学英语", "程序设计", "数据结构", "线性代数"];
  const HOMEWORK_LOAD_BATCH_SIZE = 30;
  const HOMEWORK_LOAD_INTERVAL = 90;
  const _sfc_main$7 = {
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
        showShareMenu: false,
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
        checkAndSetReminders(this.homeworkList);
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
        if (this.recorderManager || typeof uni.getRecorderManager !== "function")
          return;
        this.recorderManager = uni.getRecorderManager();
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
            uni.showToast({ title: "录音已添加", icon: "success" });
          }
        });
        this.recorderManager.onError(() => {
          this.isRecording = false;
          this.recordCanceled = false;
          uni.showToast({ title: "录音失败，请重试", icon: "none" });
        });
      },
      chooseFormImage() {
        uni.chooseImage({
          count: 9,
          sourceType: ["album", "camera"],
          success: (res) => {
            this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || []);
            this.syncLegacyAttachmentFields();
          },
          fail: () => {
            uni.showToast({ title: "未选择图片", icon: "none" });
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
          uni.showToast({ title: "录音文件无效，请重试", icon: "none" });
          return "";
        }
        if (typeof uni.saveFile !== "function") {
          return tempFilePath;
        }
        try {
          const res = await new Promise((resolve, reject) => {
            uni.saveFile({
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
          formatAppLog("warn", "at pages/view/view.vue:609", "录音文件保存失败：", e);
          uni.showToast({ title: "录音保存失败，请重试", icon: "none" });
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
        const saved = uni.getStorageSync(SUBJECT_KEY$1);
        if (Array.isArray(saved) && saved.length) {
          this.subjectList = saved;
          return;
        }
        this.subjectList = DEFAULT_SUBJECTS$1.map((name) => ({
          id: this.createId(),
          name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }));
        this.saveSubjects();
      },
      loadHomework() {
        const saved = uni.getStorageSync(HOMEWORK_KEY$2);
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
        uni.setStorageSync(SUBJECT_KEY$1, this.subjectList);
      },
      saveHomeworkList() {
        uni.setStorageSync(HOMEWORK_KEY$2, this.homeworkList);
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
          reminderOffsetHours: item.reminderOffsetHours || DEFAULT_REMINDER_OFFSET_HOURS$1,
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
          reminderOffsetHours: Number(item.reminderOffsetHours) || DEFAULT_REMINDER_OFFSET_HOURS$1,
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
        uni.setClipboardData({
          data: shareCode,
          success: () => {
            this.showShareMenu = false;
            this.lastCopiedCode = shareCode;
            uni.showToast({ title: "分享码已复制", icon: "success" });
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
          uni.showToast({ title: "请输入分享码", icon: "none" });
          return;
        }
        this.importShareCode(this.importCode.trim());
      },
      async pasteFromClipboard() {
        var _a;
        try {
          const res = await uni.getClipboardData();
          const data = res.data || ((_a = res[1]) == null ? void 0 : _a.data) || "";
          if (!data) {
            uni.showToast({ title: "剪贴板为空", icon: "none" });
            return;
          }
          if (this.isValidShareCode(data)) {
            this.importShareCode(data);
          } else {
            this.importCode = data;
            uni.showToast({ title: "已粘贴，请确认分享码", icon: "none" });
          }
        } catch (e) {
          uni.showToast({ title: "读取剪贴板失败", icon: "none" });
        }
      },
      importShareCode(code, options = {}) {
        try {
          const importedList = this.getShareItemsFromCode(code);
          if (!Array.isArray(importedList) || !importedList.length) {
            uni.showToast({ title: "无效的分享内容", icon: "none" });
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
                resetNotificationStatus(item.id);
            });
            this.checkHomeworkReminders();
            this.resetHomeworkLoading();
            this.showImportForm = false;
            this.importCode = "";
            uni.showToast({ title: `成功导入 ${newCount} 条作业`, icon: "success" });
          } else {
            uni.showToast({ title: options.fromNativeShare ? "分享作业已存在" : "没有新作业可导入", icon: "none" });
          }
        } catch (e) {
          uni.showToast({ title: "分享内容格式错误", icon: "none" });
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
          uni.showToast({ title: "请输入学科名称", icon: "none" });
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
        uni.showToast({ title: exists ? "已选择该学科" : "学科已新建", icon: "none" });
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
          uni.showToast({ title: "请输入作业内容", icon: "none" });
          return;
        }
        if (!this.form.subject) {
          uni.showToast({ title: "请选择学科", icon: "none" });
          return;
        }
        if (!this.form.deadlineDate || !this.form.deadlineTime) {
          uni.showToast({ title: "请选择截止时间", icon: "none" });
          return;
        }
        const deadline = `${this.form.deadlineDate}T${this.form.deadlineTime}:00`;
        const reminderOffsetHours = Number(this.form.reminderOffsetHours);
        if (!Number.isInteger(reminderOffsetHours) || reminderOffsetHours <= 0 || reminderOffsetHours > 168) {
          uni.showToast({ title: "提醒时间需为 1-168 小时", icon: "none" });
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
            resetNotificationStatus(this.homeworkList[index].id);
            setHomeworkReminder(this.homeworkList[index]);
          }
        }
        this.resetForm();
        uni.showToast({ title: "已更新", icon: "success" });
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
          cancelHomeworkReminder(id);
          return {
            ...item,
            completed: true,
            completedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        });
        this.saveHomeworkList();
        this.resetHomeworkLoading();
        uni.showToast({ title: "已标记完成", icon: "success" });
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
          resetNotificationStatus(restoredItem.id);
          setHomeworkReminder(restoredItem);
          return restoredItem;
        });
        this.saveHomeworkList();
        this.resetHomeworkLoading();
        uni.showToast({ title: "已恢复未完成", icon: "none" });
      },
      confirmDeleteHomework(item) {
        uni.showModal({
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
        cancelHomeworkReminder(id);
        this.homeworkList = this.homeworkList.filter((item) => item.id !== id);
        this.saveHomeworkList();
        this.resetHomeworkLoading();
        uni.showToast({ title: "已删除", icon: "success" });
      },
      playAudio(path) {
        if (!path)
          return;
        const audio = uni.createInnerAudioContext();
        audio.src = path;
        audio.onEnded(() => audio.destroy());
        audio.onError(() => {
          audio.destroy();
          uni.showToast({ title: "语音播放失败", icon: "none" });
        });
        audio.play();
      },
      previewImage(path, paths) {
        if (!path)
          return;
        uni.previewImage({ urls: paths && paths.length ? paths : [path], current: path });
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
        const saved = Number(uni.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY$1));
        return saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS$1;
      },
      getDefaultReminderOffsetHours() {
        const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY$1));
        return saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS$1;
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
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "page",
        onTouchstart: _cache[27] || (_cache[27] = (...args) => $options.onPageTouchStart && $options.onPageTouchStart(...args)),
        onTouchmove: _cache[28] || (_cache[28] = (...args) => $options.onPageTouchMove && $options.onPageTouchMove(...args)),
        onTouchend: _cache[29] || (_cache[29] = (...args) => $options.onPageTouchEnd && $options.onPageTouchEnd(...args)),
        onTouchcancel: _cache[30] || (_cache[30] = (...args) => $options.onPageTouchEnd && $options.onPageTouchEnd(...args))
      },
      [
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["top-panel", $data.isTopCollapsed ? "is-collapsed" : ""])
          },
          [
            vue.createElementVNode("view", {
              class: "collapsed-bar",
              onClick: _cache[0] || (_cache[0] = (...args) => $options.expandTopPanel && $options.expandTopPanel(...args))
            }, [
              vue.createElementVNode("image", {
                class: "expand-icon",
                src: _imports_0,
                mode: "aspectFit"
              }),
              vue.createElementVNode("text", { class: "collapsed-title" }, "展开功能栏")
            ]),
            vue.createElementVNode("view", { class: "custom-nav" }, [
              vue.createElementVNode("text", { class: "nav-title" }, "查看作业"),
              vue.createElementVNode("view", { class: "nav-share-wrap" }, [
                vue.createElementVNode("button", {
                  class: "nav-share-btn",
                  onClick: _cache[1] || (_cache[1] = ($event) => $data.showShareMenu = !$data.showShareMenu)
                }, "分享"),
                $data.showShareMenu ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "share-menu"
                }, [
                  vue.createElementVNode("text", { class: "share-menu-tip" }, "选择分享方式"),
                  vue.createElementVNode("button", {
                    class: "share-menu-item primary",
                    "open-type": "share",
                    onClick: _cache[2] || (_cache[2] = ($event) => $data.showShareMenu = false)
                  }, "微信分享"),
                  vue.createElementVNode("button", {
                    class: "share-menu-item",
                    onClick: _cache[3] || (_cache[3] = (...args) => $options.copyShareCode && $options.copyShareCode(...args))
                  }, "复制分享码"),
                  vue.createElementVNode("button", {
                    class: "share-menu-item",
                    onClick: _cache[4] || (_cache[4] = (...args) => $options.openImportForm && $options.openImportForm(...args))
                  }, "导入分享码")
                ])) : vue.createCommentVNode("v-if", true)
              ])
            ]),
            $data.showImportForm ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "form-card import-form"
            }, [
              vue.createElementVNode("view", { class: "form-title-row" }, [
                vue.createElementVNode("text", { class: "form-title" }, "导入分享码"),
                vue.createElementVNode("text", {
                  class: "form-close",
                  onClick: _cache[5] || (_cache[5] = ($event) => $data.showImportForm = false)
                }, "取消")
              ]),
              vue.withDirectives(vue.createElementVNode(
                "textarea",
                {
                  class: "import-textarea",
                  "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.importCode = $event),
                  placeholder: "粘贴好友的分享码",
                  maxlength: "10000"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.importCode]
              ]),
              vue.createElementVNode("view", { class: "import-btns" }, [
                vue.createElementVNode("button", {
                  class: "paste-btn",
                  onClick: _cache[7] || (_cache[7] = (...args) => $options.pasteFromClipboard && $options.pasteFromClipboard(...args))
                }, "从剪贴板导入"),
                vue.createElementVNode("button", {
                  class: "save-btn",
                  onClick: _cache[8] || (_cache[8] = (...args) => $options.manualImport && $options.manualImport(...args))
                }, "导入作业")
              ])
            ])) : vue.createCommentVNode("v-if", true),
            vue.createElementVNode("view", { class: "stats" }, [
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["stat-card", $data.selectedStatus === "pending" ? "active" : ""]),
                  onClick: _cache[9] || (_cache[9] = ($event) => $options.selectStatus("pending"))
                },
                [
                  vue.createElementVNode(
                    "text",
                    { class: "stat-num" },
                    vue.toDisplayString($options.pendingCount),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", { class: "stat-label" }, "未完成")
                ],
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["stat-card", "warn", $data.selectedStatus === "urgent" ? "active" : ""]),
                  onClick: _cache[10] || (_cache[10] = ($event) => $options.selectStatus("urgent"))
                },
                [
                  vue.createElementVNode(
                    "text",
                    { class: "stat-num" },
                    vue.toDisplayString($options.urgentCount),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", { class: "stat-label" }, "临近截止")
                ],
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["stat-card", "done", $data.selectedStatus === "completed" ? "active" : ""]),
                  onClick: _cache[11] || (_cache[11] = ($event) => $options.selectStatus("completed"))
                },
                [
                  vue.createElementVNode(
                    "text",
                    { class: "stat-num" },
                    vue.toDisplayString($options.completedCount),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", { class: "stat-label" }, "已完成")
                ],
                2
                /* CLASS */
              )
            ]),
            vue.createElementVNode("view", { class: "filter-card" }, [
              vue.createElementVNode("view", { class: "filter-head" }, [
                vue.createElementVNode("text", { class: "filter-title" }, "按学科筛选"),
                vue.createElementVNode(
                  "text",
                  { class: "filter-count" },
                  vue.toDisplayString($options.filterSummary),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("scroll-view", {
                class: "subject-filter-scroll",
                "scroll-x": "",
                "show-scrollbar": "false"
              }, [
                vue.createElementVNode("view", { class: "subject-filter-list" }, [
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList($options.subjectFilterOptions, (subject) => {
                      return vue.openBlock(), vue.createElementBlock("view", {
                        key: subject,
                        class: vue.normalizeClass(["filter-chip", $data.selectedSubject === subject ? "active" : ""]),
                        onClick: ($event) => $options.selectSubject(subject)
                      }, [
                        vue.createElementVNode(
                          "text",
                          null,
                          vue.toDisplayString(subject),
                          1
                          /* TEXT */
                        )
                      ], 10, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])
            ])
          ],
          2
          /* CLASS */
        ),
        vue.createElementVNode("view", { class: "section-title-row" }, [
          vue.createElementVNode("view", null, [
            vue.createElementVNode("text", { class: "section-title" }, "作业看板"),
            $data.selectedSubject !== "全部" ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "section-subtitle"
              },
              "当前：" + vue.toDisplayString($data.selectedSubject),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("text", { class: "section-tip" }, "点击编辑 · 右划完成 · 左滑恢复 · 长按删除")
        ]),
        $options.visibleHomework.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "homework-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($options.visibleHomework, (item, index) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.id,
                class: vue.normalizeClass(["homework-card", $data.cardEnterActive ? "is-entering" : "", $data.touchingId === item.id && $data.swipeOffsetX ? "is-swiping" : "", $options.getSwipeActionClass(item), item.completed ? "is-done" : "", item.id === $data.completingId ? "is-completing" : ""]),
                style: vue.normalizeStyle($options.getCardStyle(item, index)),
                onTouchstart: ($event) => $options.onTouchStart($event, item.id),
                onTouchmove: ($event) => $options.onTouchMove($event, item.id),
                onTouchend: ($event) => $options.onTouchEnd($event, item),
                onTouchcancel: _cache[13] || (_cache[13] = (...args) => $options.onTouchCancel && $options.onTouchCancel(...args)),
                onLongpress: ($event) => $options.onLongPress(item),
                onClick: ($event) => $options.editHomework(item)
              }, [
                $data.touchingId === item.id && $data.swipeOffsetX ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "swipe-action"
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "swipe-action-icon" },
                    vue.toDisplayString($options.getSwipeActionIcon(item)),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "swipe-action-text" },
                    vue.toDisplayString($options.getSwipeActionText(item)),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true),
                item.id === $data.completingId ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 1,
                  class: "complete-badge"
                }, [
                  vue.createElementVNode("text", { class: "complete-check" }, "✓"),
                  vue.createElementVNode("text", { class: "complete-text" }, "已完成")
                ])) : vue.createCommentVNode("v-if", true),
                $options.getImagePaths(item).length || $options.getAudios(item).length ? (vue.openBlock(), vue.createElementBlock("scroll-view", {
                  key: 2,
                  "scroll-x": "",
                  class: "card-attachment-scroll",
                  onClick: _cache[12] || (_cache[12] = vue.withModifiers(() => {
                  }, ["stop"]))
                }, [
                  vue.createElementVNode("view", { class: "card-attachment-row" }, [
                    (vue.openBlock(true), vue.createElementBlock(
                      vue.Fragment,
                      null,
                      vue.renderList($options.getImagePaths(item), (path, index2) => {
                        return vue.openBlock(), vue.createElementBlock("image", {
                          key: `card-image-${item.id}-${index2}`,
                          class: "thumb",
                          src: path,
                          mode: "aspectFill",
                          onClick: vue.withModifiers(($event) => $options.previewImage(path, $options.getImagePaths(item)), ["stop"])
                        }, null, 8, ["src", "onClick"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    (vue.openBlock(true), vue.createElementBlock(
                      vue.Fragment,
                      null,
                      vue.renderList($options.getAudios(item), (audio, index2) => {
                        return vue.openBlock(), vue.createElementBlock("view", {
                          key: `card-audio-${item.id}-${index2}`,
                          class: "thumb audio-thumb",
                          onClick: vue.withModifiers(($event) => $options.playAudio(audio.path), ["stop"])
                        }, [
                          vue.createElementVNode("image", {
                            class: "audio-thumb-icon",
                            src: _imports_1,
                            mode: "aspectFit"
                          }),
                          vue.createElementVNode(
                            "text",
                            { class: "audio-thumb-text" },
                            vue.toDisplayString(audio.duration || 1) + "秒",
                            1
                            /* TEXT */
                          )
                        ], 8, ["onClick"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])) : (vue.openBlock(), vue.createElementBlock("view", {
                  key: 3,
                  class: "thumb text-thumb"
                }, [
                  vue.createElementVNode("text", null, "文")
                ])),
                vue.createElementVNode("view", { class: "card-body" }, [
                  vue.createElementVNode("view", { class: "card-top" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "subject-tag" },
                      vue.toDisplayString(item.subject),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      {
                        class: vue.normalizeClass(["status", item.completed ? "status-done" : $options.getDeadlineClass(item)])
                      },
                      vue.toDisplayString($options.getStatusText(item)),
                      3
                      /* TEXT, CLASS */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    { class: "deadline" },
                    "截止：" + vue.toDisplayString($options.formatDeadline(item.deadline)),
                    1
                    /* TEXT */
                  ),
                  $options.getAudios(item).length ? (vue.openBlock(), vue.createElementBlock("text", {
                    key: 0,
                    class: "audio-note",
                    onClick: vue.withModifiers(($event) => $options.playAudio($options.getAudios(item)[0].path), ["stop"])
                  }, "点击播放语音 · " + vue.toDisplayString($options.getAudios(item).length) + " 条", 9, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  item.note ? (vue.openBlock(), vue.createElementBlock(
                    "text",
                    {
                      key: 1,
                      class: "card-note"
                    },
                    vue.toDisplayString(item.note),
                    1
                    /* TEXT */
                  )) : (vue.openBlock(), vue.createElementBlock("text", {
                    key: 2,
                    class: "card-note muted"
                  }, "暂无备注"))
                ])
              ], 46, ["onTouchstart", "onTouchmove", "onTouchend", "onLongpress", "onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : vue.createCommentVNode("v-if", true),
        $data.isLoadingHomework ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "load-more-row"
        }, [
          vue.createElementVNode("view", { class: "load-spinner" }),
          vue.createElementVNode("text", null, "正在逐个加载作业...")
        ])) : $options.visibleHomework.length && !$options.hasMoreHomework ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "load-more-row is-end"
        }, [
          vue.createElementVNode(
            "text",
            null,
            "已显示全部 " + vue.toDisplayString($options.sortedHomework.length) + " 条作业",
            1
            /* TEXT */
          )
        ])) : $options.sortedHomework.length && $options.hasMoreHomework ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 3,
          class: "load-more-row"
        }, [
          vue.createElementVNode("text", null, "继续上滑加载更多")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 4,
          class: "empty"
        }, [
          vue.createElementVNode(
            "text",
            { class: "empty-title" },
            vue.toDisplayString($options.emptyTitle),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "empty-tip" },
            vue.toDisplayString($options.emptyTip),
            1
            /* TEXT */
          )
        ])),
        $data.showForm ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 5,
          class: "modal-mask",
          onClick: _cache[26] || (_cache[26] = (...args) => $options.resetForm && $options.resetForm(...args))
        }, [
          vue.createElementVNode("view", {
            class: "form-card edit-modal-card",
            onClick: _cache[25] || (_cache[25] = vue.withModifiers(() => {
            }, ["stop"]))
          }, [
            vue.createElementVNode("view", { class: "form-title-row" }, [
              vue.createElementVNode("text", { class: "form-title" }, "编辑作业"),
              vue.createElementVNode("text", {
                class: "form-close",
                onClick: _cache[14] || (_cache[14] = (...args) => $options.resetForm && $options.resetForm(...args))
              }, "取消")
            ]),
            vue.createElementVNode("view", { class: "attachment-edit-actions" }, [
              vue.createElementVNode("view", {
                class: "attachment-add-btn",
                onClick: _cache[15] || (_cache[15] = (...args) => $options.chooseFormImage && $options.chooseFormImage(...args))
              }, "添加图片"),
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["attachment-add-btn", $data.isRecording ? "recording" : ""]),
                  onClick: _cache[16] || (_cache[16] = (...args) => $options.toggleFormRecord && $options.toggleFormRecord(...args))
                },
                vue.toDisplayString($data.isRecording ? "停止录音" : "添加录音"),
                3
                /* TEXT, CLASS */
              )
            ]),
            $data.form.imagePaths.length || $data.form.audios.length ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "form-preview-grid"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.form.imagePaths, (path, index) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `edit-image-${index}-${path}`,
                    class: "preview-tile"
                  }, [
                    vue.createElementVNode("image", {
                      class: "preview",
                      src: path,
                      mode: "aspectFill",
                      onClick: ($event) => $options.previewImage(path, $data.form.imagePaths)
                    }, null, 8, ["src", "onClick"]),
                    vue.createElementVNode("image", {
                      class: "remove-attachment preview-remove",
                      src: _imports_2$1,
                      mode: "aspectFit",
                      onClick: vue.withModifiers(($event) => $options.removeFormImageAttachment(index), ["stop"])
                    }, null, 8, ["onClick"])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.form.audios, (audio, index) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `edit-audio-${index}-${audio.path}`,
                    class: "preview-tile audio-preview-tile",
                    onClick: ($event) => $options.playAudio(audio.path)
                  }, [
                    vue.createElementVNode("image", {
                      class: "audio-thumb-icon",
                      src: _imports_1,
                      mode: "aspectFit"
                    }),
                    vue.createElementVNode(
                      "text",
                      { class: "audio-thumb-text" },
                      vue.toDisplayString(audio.duration || 1) + "秒",
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode("image", {
                      class: "remove-attachment preview-remove",
                      src: _imports_2$1,
                      mode: "aspectFit",
                      onClick: vue.withModifiers(($event) => $options.removeFormAudioAttachment(index), ["stop"])
                    }, null, 8, ["onClick"])
                  ], 8, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : vue.createCommentVNode("v-if", true),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "选择学科"),
              vue.createElementVNode("picker", {
                range: $options.subjectNames,
                onChange: _cache[17] || (_cache[17] = (...args) => $options.onSubjectChange && $options.onSubjectChange(...args))
              }, [
                vue.createElementVNode(
                  "view",
                  { class: "picker-box" },
                  vue.toDisplayString($data.form.subject || "从已建学科中选择"),
                  1
                  /* TEXT */
                )
              ], 40, ["range"])
            ]),
            vue.createElementVNode("view", { class: "quick-subject" }, [
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "subject-input",
                  "onUpdate:modelValue": _cache[18] || (_cache[18] = ($event) => $data.newSubjectName = $event),
                  placeholder: "快捷新建学科",
                  maxlength: "20"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.newSubjectName]
              ]),
              vue.createElementVNode("button", {
                class: "small-btn",
                onClick: _cache[19] || (_cache[19] = (...args) => $options.addSubject && $options.addSubject(...args))
              }, "新建")
            ]),
            vue.createElementVNode("view", { class: "date-row" }, [
              vue.createElementVNode("view", { class: "field half" }, [
                vue.createElementVNode("text", { class: "label" }, "截止日期"),
                vue.createElementVNode("picker", {
                  mode: "date",
                  value: $data.form.deadlineDate,
                  onChange: _cache[20] || (_cache[20] = (...args) => $options.onDateChange && $options.onDateChange(...args))
                }, [
                  vue.createElementVNode(
                    "view",
                    { class: "picker-box" },
                    vue.toDisplayString($data.form.deadlineDate || "选择日期"),
                    1
                    /* TEXT */
                  )
                ], 40, ["value"])
              ]),
              vue.createElementVNode("view", { class: "field half" }, [
                vue.createElementVNode("text", { class: "label" }, "截止时间"),
                vue.createElementVNode("picker", {
                  mode: "time",
                  value: $data.form.deadlineTime,
                  onChange: _cache[21] || (_cache[21] = (...args) => $options.onTimeChange && $options.onTimeChange(...args))
                }, [
                  vue.createElementVNode(
                    "view",
                    { class: "picker-box" },
                    vue.toDisplayString($data.form.deadlineTime || "选择时间"),
                    1
                    /* TEXT */
                  )
                ], 40, ["value"])
              ])
            ]),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "提醒时间"),
              vue.createElementVNode("view", { class: "reminder-row" }, [
                vue.withDirectives(vue.createElementVNode(
                  "input",
                  {
                    class: "reminder-input",
                    type: "number",
                    "onUpdate:modelValue": _cache[22] || (_cache[22] = ($event) => $data.form.reminderOffsetHours = $event),
                    placeholder: "23",
                    maxlength: "3"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vue.vModelText, $data.form.reminderOffsetHours]
                ]),
                vue.createElementVNode("text", { class: "reminder-unit" }, "截止前小时提醒")
              ])
            ]),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode(
                "text",
                { class: "label" },
                vue.toDisplayString($options.hasFormAttachment ? "备注" : "作业内容"),
                1
                /* TEXT */
              ),
              vue.withDirectives(vue.createElementVNode("textarea", {
                class: "note",
                "onUpdate:modelValue": _cache[23] || (_cache[23] = ($event) => $data.form.note = $event),
                placeholder: $options.hasFormAttachment ? "例如：第 3 章习题、需要提交实验报告" : "请输入老师布置的作业内容",
                maxlength: "200"
              }, null, 8, ["placeholder"]), [
                [vue.vModelText, $data.form.note]
              ])
            ]),
            vue.createElementVNode("button", {
              class: "save-btn",
              onClick: _cache[24] || (_cache[24] = (...args) => $options.saveHomework && $options.saveHomework(...args))
            }, "保存修改")
          ])
        ])) : vue.createCommentVNode("v-if", true)
      ],
      32
      /* NEED_HYDRATION */
    );
  }
  const PagesViewView = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/view/view.vue"]]);
  const ROUTE_MAP = {
    reminder: "/pages/settings/reminder/reminder",
    semester: "/pages/settings/semester/semester",
    appearance: "/pages/settings/appearance/appearance",
    subjects: "/pages/settings/subjects/subjects",
    data: "/pages/settings/data/data"
  };
  const _sfc_main$6 = {
    methods: {
      goTo(key) {
        const url = ROUTE_MAP[key];
        if (!url)
          return;
        uni.navigateTo({ url });
      }
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("text", { class: "nav-title" }, "设置")
      ]),
      vue.createElementVNode("view", { class: "group-card" }, [
        vue.createElementVNode("view", { class: "group-title" }, "提醒与时间"),
        vue.createElementVNode("view", {
          class: "entry-item",
          "hover-class": "entry-item-hover",
          onClick: _cache[0] || (_cache[0] = ($event) => $options.goTo("reminder"))
        }, [
          vue.createElementVNode("view", { class: "entry-icon entry-icon-blue" }, [
            vue.createElementVNode("text", { class: "entry-emoji" }, "🔔")
          ]),
          vue.createElementVNode("view", { class: "entry-main" }, [
            vue.createElementVNode("text", { class: "entry-title" }, "提醒设置"),
            vue.createElementVNode("text", { class: "entry-desc" }, "微信服务通知 · 默认提醒/截止时间")
          ]),
          vue.createElementVNode("text", { class: "entry-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "entry-item",
          "hover-class": "entry-item-hover",
          onClick: _cache[1] || (_cache[1] = ($event) => $options.goTo("semester"))
        }, [
          vue.createElementVNode("view", { class: "entry-icon entry-icon-purple" }, [
            vue.createElementVNode("text", { class: "entry-emoji" }, "📅")
          ]),
          vue.createElementVNode("view", { class: "entry-main" }, [
            vue.createElementVNode("text", { class: "entry-title" }, "课表设置"),
            vue.createElementVNode("text", { class: "entry-desc" }, "开学日期 · 节次时间")
          ]),
          vue.createElementVNode("text", { class: "entry-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "entry-item",
          "hover-class": "entry-item-hover",
          onClick: _cache[2] || (_cache[2] = ($event) => $options.goTo("appearance"))
        }, [
          vue.createElementVNode("view", { class: "entry-icon entry-icon-pink" }, [
            vue.createElementVNode("text", { class: "entry-emoji" }, "🎨")
          ]),
          vue.createElementVNode("view", { class: "entry-main" }, [
            vue.createElementVNode("text", { class: "entry-title" }, "课表外观"),
            vue.createElementVNode("text", { class: "entry-desc" }, "背景图片 · 透明度 · 课程配色")
          ]),
          vue.createElementVNode("text", { class: "entry-arrow" }, "›")
        ])
      ]),
      vue.createElementVNode("view", { class: "group-card" }, [
        vue.createElementVNode("view", { class: "group-title" }, "作业内容"),
        vue.createElementVNode("view", {
          class: "entry-item",
          "hover-class": "entry-item-hover",
          onClick: _cache[3] || (_cache[3] = ($event) => $options.goTo("subjects"))
        }, [
          vue.createElementVNode("view", { class: "entry-icon entry-icon-green" }, [
            vue.createElementVNode("text", { class: "entry-emoji" }, "📚")
          ]),
          vue.createElementVNode("view", { class: "entry-main" }, [
            vue.createElementVNode("text", { class: "entry-title" }, "学科管理"),
            vue.createElementVNode("text", { class: "entry-desc" }, "新增、改名或删除学科")
          ]),
          vue.createElementVNode("text", { class: "entry-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "entry-item",
          "hover-class": "entry-item-hover",
          onClick: _cache[4] || (_cache[4] = ($event) => $options.goTo("data"))
        }, [
          vue.createElementVNode("view", { class: "entry-icon entry-icon-red" }, [
            vue.createElementVNode("text", { class: "entry-emoji" }, "🧹")
          ]),
          vue.createElementVNode("view", { class: "entry-main" }, [
            vue.createElementVNode("text", { class: "entry-title" }, "数据清理"),
            vue.createElementVNode("text", { class: "entry-desc" }, "一键清除已完成作业")
          ]),
          vue.createElementVNode("text", { class: "entry-arrow" }, "›")
        ])
      ]),
      vue.createElementVNode("view", { class: "footer" }, [
        vue.createElementVNode("text", { class: "footer-text" }, "联系开发者 QQ：3383623610")
      ])
    ]);
  }
  const PagesSettingsSettings = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/settings/settings.vue"]]);
  const DEFAULT_DEADLINE_OFFSET_KEY = "default_deadline_offset_hours";
  const DEFAULT_DEADLINE_OFFSET_HOURS = 24;
  const DEFAULT_REMINDER_OFFSET_KEY = "default_reminder_offset_hours";
  const DEFAULT_REMINDER_OFFSET_HOURS = 23;
  const _sfc_main$5 = {
    data() {
      return {
        noticeEnabled: false,
        defaultDeadlineOffsetHours: `${DEFAULT_DEADLINE_OFFSET_HOURS}`,
        defaultReminderOffsetHours: `${DEFAULT_REMINDER_OFFSET_HOURS}`
      };
    },
    onShow() {
      this.loadNoticeStatus();
      this.loadDefaultDeadlineOffset();
      this.loadDefaultReminderOffset();
    },
    methods: {
      goBack() {
        uni.navigateBack({ delta: 1 });
      },
      loadNoticeStatus() {
        this.noticeEnabled = getNotificationPermissionStatus();
      },
      async requestNoticePermission() {
        const enabled = await requestNotificationPermission({ showToast: true });
        this.noticeEnabled = enabled;
      },
      loadDefaultDeadlineOffset() {
        const saved = Number(uni.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY));
        this.defaultDeadlineOffsetHours = `${saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS}`;
      },
      loadDefaultReminderOffset() {
        const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY));
        this.defaultReminderOffsetHours = `${saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS}`;
      },
      saveDefaultReminderOffset() {
        const hours = Number(this.defaultReminderOffsetHours);
        if (!Number.isInteger(hours) || hours <= 0 || hours > 168) {
          uni.showToast({ title: "请输入 1-168 小时", icon: "none" });
          this.loadDefaultReminderOffset();
          return;
        }
        uni.setStorageSync(DEFAULT_REMINDER_OFFSET_KEY, hours);
        this.defaultReminderOffsetHours = `${hours}`;
        uni.showToast({ title: "已保存", icon: "success" });
      },
      saveDefaultDeadlineOffset() {
        const hours = Number(this.defaultDeadlineOffsetHours);
        if (!Number.isInteger(hours) || hours <= 0 || hours > 168) {
          uni.showToast({ title: "请输入 1-168 小时", icon: "none" });
          this.loadDefaultDeadlineOffset();
          return;
        }
        uni.setStorageSync(DEFAULT_DEADLINE_OFFSET_KEY, hours);
        this.defaultDeadlineOffsetHours = `${hours}`;
        uni.showToast({ title: "已保存", icon: "success" });
      }
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("view", {
          class: "nav-back",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "‹")
        ]),
        vue.createElementVNode("text", { class: "nav-title" }, "提醒设置"),
        vue.createElementVNode("view", { class: "nav-placeholder" })
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell cell-block" }, [
          vue.createElementVNode("view", { class: "cell-main" }, [
            vue.createElementVNode("text", { class: "cell-title" }, "微信服务通知"),
            vue.createElementVNode("text", { class: "cell-desc" }, "开启后，作业临近截止时会通过微信服务通知提醒你。")
          ]),
          vue.createElementVNode(
            "button",
            {
              class: "primary-btn",
              onClick: _cache[1] || (_cache[1] = (...args) => $options.requestNoticePermission && $options.requestNoticePermission(...args))
            },
            vue.toDisplayString($data.noticeEnabled ? "已开启" : "去授权"),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell cell-block" }, [
          vue.createElementVNode("view", { class: "cell-main" }, [
            vue.createElementVNode("text", { class: "cell-title" }, "默认提醒时间"),
            vue.createElementVNode("text", { class: "cell-desc" }, "新作业默认在截止前 N 小时提醒")
          ]),
          vue.createElementVNode("view", { class: "input-row" }, [
            vue.withDirectives(vue.createElementVNode(
              "input",
              {
                class: "num-input",
                type: "number",
                "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.defaultReminderOffsetHours = $event),
                placeholder: "23",
                maxlength: "3"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [vue.vModelText, $data.defaultReminderOffsetHours]
            ]),
            vue.createElementVNode("text", { class: "input-unit" }, "小时前提醒"),
            vue.createElementVNode("button", {
              class: "primary-btn",
              onClick: _cache[3] || (_cache[3] = (...args) => $options.saveDefaultReminderOffset && $options.saveDefaultReminderOffset(...args))
            }, "保存")
          ])
        ]),
        vue.createElementVNode("view", { class: "divider" }),
        vue.createElementVNode("view", { class: "cell cell-block" }, [
          vue.createElementVNode("view", { class: "cell-main" }, [
            vue.createElementVNode("text", { class: "cell-title" }, "默认截止时间"),
            vue.createElementVNode("text", { class: "cell-desc" }, "新作业默认设为当前时间后 N 小时")
          ]),
          vue.createElementVNode("view", { class: "input-row" }, [
            vue.withDirectives(vue.createElementVNode(
              "input",
              {
                class: "num-input",
                type: "number",
                "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.defaultDeadlineOffsetHours = $event),
                placeholder: "24",
                maxlength: "3"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [vue.vModelText, $data.defaultDeadlineOffsetHours]
            ]),
            vue.createElementVNode("text", { class: "input-unit" }, "小时后"),
            vue.createElementVNode("button", {
              class: "primary-btn",
              onClick: _cache[5] || (_cache[5] = (...args) => $options.saveDefaultDeadlineOffset && $options.saveDefaultDeadlineOffset(...args))
            }, "保存")
          ])
        ])
      ])
    ]);
  }
  const PagesSettingsReminderReminder = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/settings/reminder/reminder.vue"]]);
  function toForm(config) {
    const cfg = mergePeriodConfig(config);
    return {
      classMinutes: `${cfg.classMinutes}`,
      breakMinutes: `${cfg.breakMinutes}`,
      morningStart: cfg.morningStart,
      morningCount: `${cfg.morningCount}`,
      afternoonStart: cfg.afternoonStart,
      afternoonCount: `${cfg.afternoonCount}`,
      eveningStart: cfg.eveningStart,
      eveningCount: `${cfg.eveningCount}`
    };
  }
  const _sfc_main$4 = {
    data() {
      return {
        semesterStart: "",
        form: toForm(DEFAULT_PERIOD_CONFIG)
      };
    },
    computed: {
      previewTimes() {
        return buildPeriodTimes({
          classMinutes: Number(this.form.classMinutes),
          breakMinutes: Number(this.form.breakMinutes),
          morningStart: this.form.morningStart,
          morningCount: Number(this.form.morningCount),
          afternoonStart: this.form.afternoonStart,
          afternoonCount: Number(this.form.afternoonCount),
          eveningStart: this.form.eveningStart,
          eveningCount: Number(this.form.eveningCount)
        });
      }
    },
    onShow() {
      this.semesterStart = loadSemesterStartDate();
      this.form = toForm(loadPeriodConfig());
    },
    methods: {
      goBack() {
        uni.navigateBack({ delta: 1 });
      },
      onSemesterStartChange(event) {
        const value = event.detail.value || "";
        this.semesterStart = value;
        saveSemesterStartDate(value);
        uni.showToast({ title: "已保存开学日期", icon: "success" });
      },
      clearSemesterStart() {
        this.semesterStart = "";
        saveSemesterStartDate("");
        uni.showToast({ title: "已清除", icon: "none" });
      },
      onTimeChange(field, event) {
        this.form[field] = event.detail.value;
      },
      validateForm() {
        const classMinutes = Number(this.form.classMinutes);
        if (!Number.isInteger(classMinutes) || classMinutes <= 0 || classMinutes > 240) {
          uni.showToast({ title: "每节课时长应为 1-240 分钟", icon: "none" });
          return null;
        }
        const breakMinutes = Number(this.form.breakMinutes);
        if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) {
          uni.showToast({ title: "课间休息应为 0-240 分钟", icon: "none" });
          return null;
        }
        const checks = [
          ["morningCount", "上午"],
          ["afternoonCount", "下午"],
          ["eveningCount", "晚上"]
        ];
        for (const [key, label] of checks) {
          const n = Number(this.form[key]);
          if (!Number.isInteger(n) || n < 0 || n > 12) {
            uni.showToast({ title: `${label}节数应为 0-12`, icon: "none" });
            return null;
          }
        }
        return {
          classMinutes,
          breakMinutes,
          morningStart: this.form.morningStart,
          morningCount: Number(this.form.morningCount),
          afternoonStart: this.form.afternoonStart,
          afternoonCount: Number(this.form.afternoonCount),
          eveningStart: this.form.eveningStart,
          eveningCount: Number(this.form.eveningCount)
        };
      },
      savePeriodConfigForm() {
        const valid = this.validateForm();
        if (!valid)
          return;
        const total = valid.morningCount + valid.afternoonCount + valid.eveningCount;
        if (total <= 0) {
          uni.showToast({ title: "至少配置一个时段", icon: "none" });
          return;
        }
        const saved = savePeriodConfig(valid);
        this.form = toForm(saved);
        uni.showToast({ title: "已保存", icon: "success" });
      },
      resetPeriodConfig() {
        uni.showModal({
          title: "恢复默认",
          content: "确定恢复节次时间为默认配置吗？",
          confirmText: "恢复",
          success: (res) => {
            if (!res.confirm)
              return;
            const saved = savePeriodConfig(DEFAULT_PERIOD_CONFIG);
            this.form = toForm(saved);
            uni.showToast({ title: "已恢复", icon: "success" });
          }
        });
      }
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("view", {
          class: "nav-back",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "‹")
        ]),
        vue.createElementVNode("text", { class: "nav-title" }, "课表设置"),
        vue.createElementVNode("view", { class: "nav-placeholder" })
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell cell-block" }, [
          vue.createElementVNode("view", { class: "cell-main" }, [
            vue.createElementVNode("text", { class: "cell-title" }, "开学日期"),
            vue.createElementVNode("text", { class: "cell-desc" }, "用于课表周次计算，选择本学期第 1 周的周一")
          ]),
          vue.createElementVNode("view", { class: "input-row" }, [
            vue.createElementVNode("picker", {
              mode: "date",
              value: $data.semesterStart,
              onChange: _cache[1] || (_cache[1] = (...args) => $options.onSemesterStartChange && $options.onSemesterStartChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-box" },
                vue.toDisplayString($data.semesterStart || "选择开学日期"),
                1
                /* TEXT */
              )
            ], 40, ["value"]),
            $data.semesterStart ? (vue.openBlock(), vue.createElementBlock("button", {
              key: 0,
              class: "ghost-btn",
              onClick: _cache[2] || (_cache[2] = (...args) => $options.clearSemesterStart && $options.clearSemesterStart(...args))
            }, "清除")) : vue.createCommentVNode("v-if", true)
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell-main top-tip" }, [
          vue.createElementVNode("text", { class: "cell-title" }, "节次时间"),
          vue.createElementVNode("text", { class: "cell-desc" }, "配置每节课时长、课间休息及上下午晚的开始时间，课表会自动重新生成。")
        ]),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "每节课时长"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "num-input",
              type: "number",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.classMinutes = $event),
              maxlength: "3"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.classMinutes]
          ]),
          vue.createElementVNode("text", { class: "input-unit" }, "分钟")
        ]),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "课间休息"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "num-input",
              type: "number",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.breakMinutes = $event),
              maxlength: "3"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.breakMinutes]
          ]),
          vue.createElementVNode("text", { class: "input-unit" }, "分钟")
        ]),
        vue.createElementVNode("view", { class: "divider" }),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "上午第 1 节"),
          vue.createElementVNode("picker", {
            mode: "time",
            value: $data.form.morningStart,
            onChange: _cache[5] || (_cache[5] = ($event) => $options.onTimeChange("morningStart", $event))
          }, [
            vue.createElementVNode(
              "view",
              { class: "picker-box small" },
              vue.toDisplayString($data.form.morningStart),
              1
              /* TEXT */
            )
          ], 40, ["value"]),
          vue.createElementVNode("text", { class: "input-unit" }, "开始")
        ]),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "上午节数"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "num-input",
              type: "number",
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.form.morningCount = $event),
              maxlength: "2"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.morningCount]
          ]),
          vue.createElementVNode("text", { class: "input-unit" }, "节")
        ]),
        vue.createElementVNode("view", { class: "divider" }),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "下午第 1 节"),
          vue.createElementVNode("picker", {
            mode: "time",
            value: $data.form.afternoonStart,
            onChange: _cache[7] || (_cache[7] = ($event) => $options.onTimeChange("afternoonStart", $event))
          }, [
            vue.createElementVNode(
              "view",
              { class: "picker-box small" },
              vue.toDisplayString($data.form.afternoonStart),
              1
              /* TEXT */
            )
          ], 40, ["value"]),
          vue.createElementVNode("text", { class: "input-unit" }, "开始")
        ]),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "下午节数"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "num-input",
              type: "number",
              "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => $data.form.afternoonCount = $event),
              maxlength: "2"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.afternoonCount]
          ]),
          vue.createElementVNode("text", { class: "input-unit" }, "节")
        ]),
        vue.createElementVNode("view", { class: "divider" }),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "晚上第 1 节"),
          vue.createElementVNode("picker", {
            mode: "time",
            value: $data.form.eveningStart,
            onChange: _cache[9] || (_cache[9] = ($event) => $options.onTimeChange("eveningStart", $event))
          }, [
            vue.createElementVNode(
              "view",
              { class: "picker-box small" },
              vue.toDisplayString($data.form.eveningStart),
              1
              /* TEXT */
            )
          ], 40, ["value"]),
          vue.createElementVNode("text", { class: "input-unit" }, "开始")
        ]),
        vue.createElementVNode("view", { class: "form-row" }, [
          vue.createElementVNode("text", { class: "form-label" }, "晚上节数"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "num-input",
              type: "number",
              "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => $data.form.eveningCount = $event),
              maxlength: "2"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.eveningCount]
          ]),
          vue.createElementVNode("text", { class: "input-unit" }, "节")
        ]),
        vue.createElementVNode("view", { class: "action-row" }, [
          vue.createElementVNode("button", {
            class: "ghost-btn full",
            onClick: _cache[11] || (_cache[11] = (...args) => $options.resetPeriodConfig && $options.resetPeriodConfig(...args))
          }, "恢复默认"),
          vue.createElementVNode("button", {
            class: "primary-btn full",
            onClick: _cache[12] || (_cache[12] = (...args) => $options.savePeriodConfigForm && $options.savePeriodConfigForm(...args))
          }, "保存")
        ]),
        vue.createElementVNode("view", { class: "preview-card" }, [
          vue.createElementVNode("text", { class: "preview-title" }, "预览节次时间"),
          vue.createElementVNode("view", { class: "preview-list" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($options.previewTimes, (item, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: index,
                  class: "preview-item"
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "preview-num" },
                    "第" + vue.toDisplayString(index + 1) + "节",
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "preview-time" },
                    vue.toDisplayString(item.start) + " - " + vue.toDisplayString(item.end),
                    1
                    /* TEXT */
                  )
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            !$options.previewTimes.length ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "preview-empty"
            }, [
              vue.createElementVNode("text", null, "请至少设置一个时段的节数")
            ])) : vue.createCommentVNode("v-if", true)
          ])
        ])
      ])
    ]);
  }
  const PagesSettingsSemesterSemester = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/settings/semester/semester.vue"]]);
  const _sfc_main$3 = {
    data() {
      return {
        appearance: loadAppearance(),
        courses: [],
        colorMap: {},
        pickerVisible: false,
        pickerTarget: null,
        pickerColor: "",
        colorPresets: COURSE_COLOR_PRESETS
      };
    },
    computed: {
      bgPreviewStyle() {
        const base = "background-color:#eef2f7;";
        if (!this.appearance.backgroundImage)
          return base;
        return `${base}background-image:url('${this.appearance.backgroundImage}');background-size:cover;background-position:center;opacity:${this.appearance.backgroundOpacity};`;
      },
      bgOpacityPercent() {
        return Math.round(this.appearance.backgroundOpacity * 100);
      },
      cardOpacityPercent() {
        return Math.round(this.appearance.cardOpacity * 100);
      },
      subjects() {
        const map = /* @__PURE__ */ new Map();
        this.courses.forEach((course) => {
          const subject = `${course.subject || ""}`.trim();
          if (!subject)
            return;
          if (!map.has(subject)) {
            map.set(subject, {
              subject,
              teachers: /* @__PURE__ */ new Set(),
              fallback: course.color || pickCourseColor(subject)
            });
          }
          if (course.teacher)
            map.get(subject).teachers.add(course.teacher);
        });
        return Array.from(map.values()).map((item) => ({
          subject: item.subject,
          teachers: Array.from(item.teachers).join(" / "),
          color: resolveCourseColor(item.subject, item.fallback, this.colorMap)
        }));
      }
    },
    onShow() {
      this.refresh();
    },
    methods: {
      goBack() {
        uni.navigateBack({ delta: 1 });
      },
      refresh() {
        this.appearance = loadAppearance();
        this.courses = loadCourses();
        this.colorMap = loadCourseColorMap();
      },
      chooseBackground() {
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: (res) => {
            const path = res.tempFilePaths && res.tempFilePaths[0] || "";
            if (!path)
              return;
            this.persistBackground(path);
          },
          fail: () => {
            uni.showToast({ title: "取消选择", icon: "none" });
          }
        });
      },
      persistBackground(path) {
        try {
          const target = `_doc/schedule_bg_${Date.now()}.jpg`;
          plus.io.resolveLocalFileSystemURL(path, (entry) => {
            plus.io.resolveLocalFileSystemURL("_doc/", (root) => {
              entry.copyTo(root, target.replace("_doc/", ""), () => {
                const localUrl = plus.io.convertLocalFileSystemURL(target);
                this.savePersistentBackground(localUrl || path);
              }, () => this.savePersistentBackground(path));
            }, () => this.savePersistentBackground(path));
          }, () => this.savePersistentBackground(path));
          return;
        } catch (e) {
          this.savePersistentBackground(path);
          return;
        }
        this.savePersistentBackground(path);
      },
      savePersistentBackground(path) {
        this.appearance = saveAppearance({ ...this.appearance, backgroundImage: path });
        uni.showToast({ title: "已设置", icon: "success" });
      },
      clearBackground() {
        this.appearance = saveAppearance({ ...this.appearance, backgroundImage: "" });
        uni.showToast({ title: "已清除", icon: "none" });
      },
      onBgOpacityChange(event) {
        const value = Number(event.detail.value) / 100;
        this.appearance = saveAppearance({ ...this.appearance, backgroundOpacity: value });
      },
      onCardOpacityChange(event) {
        const value = Number(event.detail.value) / 100;
        this.appearance = saveAppearance({ ...this.appearance, cardOpacity: value });
      },
      openColorPicker(item) {
        this.pickerTarget = item;
        this.pickerColor = item.color;
        this.pickerVisible = true;
      },
      closeColorPicker() {
        this.pickerVisible = false;
        this.pickerTarget = null;
      },
      confirmCourseColor() {
        if (!this.pickerTarget)
          return;
        this.colorMap = setCourseColor(this.pickerTarget.subject, this.pickerColor);
        uni.showToast({ title: "已应用", icon: "success" });
        this.closeColorPicker();
      },
      resetCourseColor() {
        if (!this.pickerTarget)
          return;
        this.colorMap = setCourseColor(this.pickerTarget.subject, "");
        uni.showToast({ title: "已恢复", icon: "none" });
        this.closeColorPicker();
      },
      resetAllColors() {
        uni.showModal({
          title: "恢复默认配色",
          content: "将清除所有课程的自定义颜色，确定继续？",
          confirmText: "恢复",
          confirmColor: "#ef4444",
          success: (res) => {
            if (!res.confirm)
              return;
            this.colorMap = saveCourseColorMap({});
            uni.showToast({ title: "已恢复", icon: "success" });
          }
        });
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("view", {
          class: "nav-back",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "‹")
        ]),
        vue.createElementVNode("text", { class: "nav-title" }, "课表外观"),
        vue.createElementVNode("view", { class: "nav-placeholder" })
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell-main top-tip" }, [
          vue.createElementVNode("text", { class: "cell-title" }, "背景图片"),
          vue.createElementVNode("text", { class: "cell-desc" }, "为课表页设置一张背景图，可调透明度避免影响文字阅读。")
        ]),
        vue.createElementVNode(
          "view",
          {
            class: "bg-preview",
            style: vue.normalizeStyle($options.bgPreviewStyle)
          },
          [
            !$data.appearance.backgroundImage ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "bg-empty"
            }, [
              vue.createElementVNode("text", null, "暂未设置背景")
            ])) : vue.createCommentVNode("v-if", true)
          ],
          4
          /* STYLE */
        ),
        vue.createElementVNode("view", { class: "action-row" }, [
          vue.createElementVNode("button", {
            class: "primary-btn full",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.chooseBackground && $options.chooseBackground(...args))
          }, "选择图片"),
          vue.createElementVNode("button", {
            class: "ghost-btn full",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.clearBackground && $options.clearBackground(...args)),
            disabled: !$data.appearance.backgroundImage
          }, "清除", 8, ["disabled"])
        ]),
        vue.createElementVNode("view", { class: "form-row form-row-block" }, [
          vue.createElementVNode("view", { class: "form-row-head" }, [
            vue.createElementVNode("text", { class: "form-label-strong" }, "背景透明度"),
            vue.createElementVNode(
              "text",
              { class: "form-value" },
              vue.toDisplayString(Math.round($data.appearance.backgroundOpacity * 100)) + "%",
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("slider", {
            value: $options.bgOpacityPercent,
            min: 10,
            max: 100,
            step: 5,
            "show-value": "",
            activeColor: "#2979ff",
            onChange: _cache[3] || (_cache[3] = (...args) => $options.onBgOpacityChange && $options.onBgOpacityChange(...args))
          }, null, 40, ["value"])
        ]),
        vue.createElementVNode("view", { class: "form-row form-row-block" }, [
          vue.createElementVNode("view", { class: "form-row-head" }, [
            vue.createElementVNode("text", { class: "form-label-strong" }, "课程卡片透明度"),
            vue.createElementVNode(
              "text",
              { class: "form-value" },
              vue.toDisplayString(Math.round($data.appearance.cardOpacity * 100)) + "%",
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("slider", {
            value: $options.cardOpacityPercent,
            min: 40,
            max: 100,
            step: 5,
            "show-value": "",
            activeColor: "#2979ff",
            onChange: _cache[4] || (_cache[4] = (...args) => $options.onCardOpacityChange && $options.onCardOpacityChange(...args))
          }, null, 40, ["value"])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell-main top-tip" }, [
          vue.createElementVNode("text", { class: "cell-title" }, "课程颜色"),
          vue.createElementVNode("text", { class: "cell-desc" }, "点击课程选择颜色，导入和手动添加的课程都可调整。")
        ]),
        !$options.subjects.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "empty"
        }, [
          vue.createElementVNode("text", null, "还没有课程，导入或手动添加后即可设置颜色。")
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "subject-grid"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($options.subjects, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.subject,
                class: "subject-row",
                onClick: ($event) => $options.openColorPicker(item)
              }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: "subject-swatch",
                    style: vue.normalizeStyle({ background: item.color })
                  },
                  null,
                  4
                  /* STYLE */
                ),
                vue.createElementVNode("view", { class: "subject-info" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "subject-name" },
                    vue.toDisplayString(item.subject),
                    1
                    /* TEXT */
                  ),
                  item.teachers ? (vue.openBlock(), vue.createElementBlock(
                    "text",
                    {
                      key: 0,
                      class: "subject-meta"
                    },
                    vue.toDisplayString(item.teachers),
                    1
                    /* TEXT */
                  )) : vue.createCommentVNode("v-if", true)
                ]),
                $data.colorMap[item.subject] ? (vue.openBlock(), vue.createElementBlock("text", {
                  key: 0,
                  class: "subject-tag"
                }, "已自定义")) : vue.createCommentVNode("v-if", true),
                vue.createElementVNode("text", { class: "subject-arrow" }, "›")
              ], 8, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])),
        $options.subjects.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "action-row"
        }, [
          vue.createElementVNode("button", {
            class: "ghost-btn full",
            onClick: _cache[5] || (_cache[5] = (...args) => $options.resetAllColors && $options.resetAllColors(...args))
          }, "恢复默认配色")
        ])) : vue.createCommentVNode("v-if", true)
      ]),
      $data.pickerVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "picker-mask",
        onClick: _cache[10] || (_cache[10] = (...args) => $options.closeColorPicker && $options.closeColorPicker(...args))
      }, [
        vue.createElementVNode("view", {
          class: "picker-card",
          onClick: _cache[9] || (_cache[9] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("view", { class: "picker-head" }, [
            vue.createElementVNode(
              "text",
              { class: "picker-title" },
              vue.toDisplayString($data.pickerTarget && $data.pickerTarget.subject),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", {
              class: "picker-close",
              onClick: _cache[6] || (_cache[6] = (...args) => $options.closeColorPicker && $options.closeColorPicker(...args))
            }, "×")
          ]),
          vue.createElementVNode("view", { class: "picker-current" }, [
            vue.createElementVNode(
              "view",
              {
                class: "picker-preview",
                style: vue.normalizeStyle({ background: $data.pickerColor })
              },
              null,
              4
              /* STYLE */
            ),
            vue.createElementVNode(
              "text",
              { class: "picker-hex" },
              vue.toDisplayString($data.pickerColor),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("view", { class: "picker-grid" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.colorPresets, (color) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: color,
                  class: vue.normalizeClass(["picker-swatch", { active: $data.pickerColor === color }]),
                  style: vue.normalizeStyle({ background: color }),
                  onClick: ($event) => $data.pickerColor = color
                }, null, 14, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          vue.createElementVNode("view", { class: "picker-actions" }, [
            vue.createElementVNode("button", {
              class: "ghost-btn full",
              onClick: _cache[7] || (_cache[7] = (...args) => $options.resetCourseColor && $options.resetCourseColor(...args))
            }, "恢复默认"),
            vue.createElementVNode("button", {
              class: "primary-btn full",
              onClick: _cache[8] || (_cache[8] = (...args) => $options.confirmCourseColor && $options.confirmCourseColor(...args))
            }, "应用")
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesSettingsAppearanceAppearance = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/settings/appearance/appearance.vue"]]);
  const SUBJECT_KEY = "subject_list";
  const HOMEWORK_KEY$1 = "homework_list";
  const DEFAULT_SUBJECTS = ["高等数学", "大学英语", "程序设计", "数据结构", "线性代数"];
  const _sfc_main$2 = {
    data() {
      return {
        subjectList: [],
        newSubjectName: ""
      };
    },
    onShow() {
      this.loadSubjects();
    },
    methods: {
      goBack() {
        uni.navigateBack({ delta: 1 });
      },
      loadSubjects() {
        const saved = uni.getStorageSync(SUBJECT_KEY);
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
        uni.setStorageSync(SUBJECT_KEY, this.subjectList);
      },
      addSubject() {
        const name = this.newSubjectName.trim();
        if (!name) {
          uni.showToast({ title: "请输入学科名称", icon: "none" });
          return;
        }
        if (this.subjectList.some((item) => item.name === name)) {
          uni.showToast({ title: "学科已存在", icon: "none" });
          return;
        }
        this.subjectList.unshift({
          id: this.createId(),
          name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        this.newSubjectName = "";
        this.saveSubjects();
        uni.showToast({ title: "已新增", icon: "success" });
      },
      renameSubject(item, value) {
        const name = value.trim();
        if (!name) {
          uni.showToast({ title: "学科不能为空", icon: "none" });
          return;
        }
        if (name === item.name)
          return;
        if (this.subjectList.some((subject) => subject.id !== item.id && subject.name === name)) {
          uni.showToast({ title: "学科已存在", icon: "none" });
          return;
        }
        const oldName = item.name;
        item.name = name;
        this.saveSubjects();
        this.renameHomeworkSubject(oldName, name);
        uni.showToast({ title: "已修改", icon: "success" });
      },
      renameHomeworkSubject(oldName, newName) {
        const homeworkList = uni.getStorageSync(HOMEWORK_KEY$1);
        if (!Array.isArray(homeworkList))
          return;
        const nextList = homeworkList.map((item) => {
          if (item.subject !== oldName)
            return item;
          return { ...item, subject: newName };
        });
        uni.setStorageSync(HOMEWORK_KEY$1, nextList);
      },
      deleteSubject(item) {
        uni.showModal({
          title: "删除学科",
          content: `确定删除“${item.name}”吗？已记录的作业不会被删除。`,
          confirmText: "删除",
          confirmColor: "#ef4444",
          success: (res) => {
            if (!res.confirm)
              return;
            this.subjectList = this.subjectList.filter((subject) => subject.id !== item.id);
            this.saveSubjects();
            uni.showToast({ title: "已删除", icon: "success" });
          }
        });
      },
      createId() {
        return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      }
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("view", {
          class: "nav-back",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "‹")
        ]),
        vue.createElementVNode("text", { class: "nav-title" }, "学科管理"),
        vue.createElementVNode("view", { class: "nav-placeholder" })
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell-main top-tip" }, [
          vue.createElementVNode("text", { class: "cell-title" }, "学科列表"),
          vue.createElementVNode("text", { class: "cell-desc" }, "可增删改当前学科")
        ]),
        vue.createElementVNode("view", { class: "add-row" }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "subject-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.newSubjectName = $event),
              placeholder: "输入新学科名称",
              maxlength: "20"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.newSubjectName]
          ]),
          vue.createElementVNode("button", {
            class: "primary-btn",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.addSubject && $options.addSubject(...args))
          }, "新增")
        ]),
        $data.subjectList.length ? (vue.openBlock(), vue.createElementBlock("scroll-view", {
          key: 0,
          class: "subject-list",
          "scroll-y": "",
          "show-scrollbar": "false"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.subjectList, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                class: "subject-item",
                key: item.id
              }, [
                vue.createElementVNode("input", {
                  class: "subject-name",
                  value: item.name,
                  maxlength: "20",
                  onBlur: ($event) => $options.renameSubject(item, $event.detail.value)
                }, null, 40, ["value", "onBlur"]),
                vue.createElementVNode("button", {
                  class: "delete-btn",
                  onClick: ($event) => $options.deleteSubject(item)
                }, "删除", 8, ["onClick"])
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty"
        }, [
          vue.createElementVNode("text", null, "暂无学科，请先新增")
        ]))
      ])
    ]);
  }
  const PagesSettingsSubjectsSubjects = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/settings/subjects/subjects.vue"]]);
  const HOMEWORK_KEY = "homework_list";
  const _sfc_main$1 = {
    methods: {
      goBack() {
        uni.navigateBack({ delta: 1 });
      },
      clearCompletedHomework() {
        const homeworkList = uni.getStorageSync(HOMEWORK_KEY);
        if (!Array.isArray(homeworkList) || !homeworkList.some((item) => item.completed)) {
          uni.showToast({ title: "暂无已完成作业", icon: "none" });
          return;
        }
        const completedCount = homeworkList.filter((item) => item.completed).length;
        uni.showModal({
          title: "清除已完成作业",
          content: `确定清除 ${completedCount} 条已完成作业吗？`,
          confirmText: "清除",
          confirmColor: "#ef4444",
          success: (res) => {
            if (!res.confirm)
              return;
            uni.setStorageSync(HOMEWORK_KEY, homeworkList.filter((item) => !item.completed));
            uni.showToast({ title: "已清除", icon: "success" });
          }
        });
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "custom-nav" }, [
        vue.createElementVNode("view", {
          class: "nav-back",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goBack && $options.goBack(...args))
        }, [
          vue.createElementVNode("text", { class: "nav-arrow" }, "‹")
        ]),
        vue.createElementVNode("text", { class: "nav-title" }, "数据清理"),
        vue.createElementVNode("view", { class: "nav-placeholder" })
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "cell-main" }, [
          vue.createElementVNode("text", { class: "cell-title" }, "作业清理"),
          vue.createElementVNode("text", { class: "cell-desc" }, "仅删除已标记完成的作业，未完成作业不受影响。")
        ]),
        vue.createElementVNode("button", {
          class: "danger-btn",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.clearCompletedHomework && $options.clearCompletedHomework(...args))
        }, "清除全部已完成的作业")
      ])
    ]);
  }
  const PagesSettingsDataData = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__file", "D:/program/Documents/HBuilderProjects/作业助手/pages/settings/data/data.vue"]]);
  __definePage("pages/schedule/schedule", PagesScheduleSchedule);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/record/record", PagesRecordRecord);
  __definePage("pages/view/view", PagesViewView);
  __definePage("pages/settings/settings", PagesSettingsSettings);
  __definePage("pages/settings/reminder/reminder", PagesSettingsReminderReminder);
  __definePage("pages/settings/semester/semester", PagesSettingsSemesterSemester);
  __definePage("pages/settings/appearance/appearance", PagesSettingsAppearanceAppearance);
  __definePage("pages/settings/subjects/subjects", PagesSettingsSubjectsSubjects);
  __definePage("pages/settings/data/data", PagesSettingsDataData);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:6", "App Launch");
      requestNotificationPermissionOnFirstLaunch();
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:10", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:13", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "D:/program/Documents/HBuilderProjects/作业助手/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
