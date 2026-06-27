// 课表相关工具：本地存储 / 解析 / 周次计算
export const SCHEDULE_KEY = 'schedule_courses'
export const SCHEDULE_META_KEY = 'schedule_meta'
export const SEMESTER_START_KEY = 'semester_start_date'
export const PERIOD_CONFIG_KEY = 'schedule_period_config'
export const IMPORT_CLEAR_MANUAL_KEY = 'schedule_import_clear_manual'
export const COURSE_COLOR_KEY = 'schedule_course_colors'
export const APPEARANCE_KEY = 'schedule_appearance'

// 节次时间默认配置
export const DEFAULT_PERIOD_CONFIG = {
	classMinutes: 45,
	breakMinutes: 10,
	morningStart: '08:00',
	morningCount: 4,
	afternoonStart: '13:40',
	afternoonCount: 4,
	eveningStart: '18:30',
	eveningCount: 4
}

// 默认上课节次时间表（基于默认配置生成，用于显示）
export const DEFAULT_PERIOD_TIMES = buildPeriodTimes(DEFAULT_PERIOD_CONFIG)

// 颜色池：稳定根据课程名分配
const COLOR_POOL = [
	'#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
	'#0ea5e9', '#14b8a6', '#ef4444', '#eab308', '#6366f1',
	'#84cc16', '#06b6d4', '#f43f5e', '#10b981', '#8b5cf6'
]

export function pickCourseColor(name) {
	const text = `${name || ''}`
	let hash = 0
	for (let i = 0; i < text.length; i++) {
		hash = (hash * 31 + text.charCodeAt(i)) >>> 0
	}
	return COLOR_POOL[hash % COLOR_POOL.length]
}

// 把 zfsoft 教务系统返回的 kbList 转成应用内课程结构
// 教务系统字段：kcmc 课程名称, jsxm 教师, cdmc 教室, xqj 星期(1-7), jcs "1-2"/"3-4", zcd "1-16周", zcmc "周次描述", kkbzsmc 备注
export function normalizeCourseFromZf(item) {
	if (!item) return null
	const xqj = parseInt(item.xqj, 10)
	const jcsRange = parseJcs(item.jcs)
	if (!xqj || !jcsRange) return null
	const weeks = parseZcd(item.zcd)
	const subject = `${item.kcmc || ''}`.trim() || '未命名课程'
	return {
		id: `${item.kch_id || item.kch || ''}_${item.jxbmc || item.jxb_id || ''}_${xqj}_${jcsRange.start}`,
		subject,
		teacher: `${item.xm || item.jsxm || ''}`.trim(),
		location: `${item.cdmc || ''}`.trim(),
		dayOfWeek: xqj,
		startPeriod: jcsRange.start,
		endPeriod: jcsRange.end,
		weeks,
		weekText: `${item.zcd || ''}`.trim(),
		jcText: `${item.jc || item.jcs || ''}`.trim(),
		note: `${item.kkbzsmc || ''}`.trim(),
		color: pickCourseColor(subject)
	}
}

// 解析 "1-2" / "3-4" / "5" 节次范围
function parseJcs(jcs) {
	if (!jcs) return null
	const text = `${jcs}`
	const match = text.match(/(\d+)\s*[-–]\s*(\d+)/)
	if (match) {
		return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) }
	}
	const single = parseInt(text, 10)
	if (single > 0) return { start: single, end: single }
	return null
}

// 解析 "1-3,5,7-16周" / "1-16周" / "1,3,5周"
export function parseZcd(zcd) {
	const result = new Set()
	const text = `${zcd || ''}`.replace(/[周\s]/g, '')
	if (!text) return []
	text.split(/[,、]/).forEach(part => {
		if (!part) return
		const single = part.match(/^(\d+)$/)
		if (single) {
			result.add(parseInt(single[1], 10))
			return
		}
		const range = part.match(/^(\d+)[-–](\d+)(单|双)?$/)
		if (range) {
			const from = parseInt(range[1], 10)
			const to = parseInt(range[2], 10)
			const filter = range[3]
			for (let i = from; i <= to; i++) {
				if (filter === '单' && i % 2 === 0) continue
				if (filter === '双' && i % 2 !== 0) continue
				result.add(i)
			}
		}
	})
	return Array.from(result).sort((a, b) => a - b)
}

export function loadCourses() {
	const data = uni.getStorageSync(SCHEDULE_KEY)
	return Array.isArray(data) ? data : []
}

export function saveCourses(list) {
	uni.setStorageSync(SCHEDULE_KEY, list)
}

export function loadScheduleMeta() {
	const data = uni.getStorageSync(SCHEDULE_META_KEY)
	return data && typeof data === 'object' ? data : {}
}

export function saveScheduleMeta(meta) {
	uni.setStorageSync(SCHEDULE_META_KEY, meta || {})
}

export function loadSemesterStartDate() {
	const value = uni.getStorageSync(SEMESTER_START_KEY)
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
	return ''
}

export function saveSemesterStartDate(value) {
	uni.setStorageSync(SEMESTER_START_KEY, value || '')
}

// 计算当前周（学期开始日期所在的那一周记为第 1 周，按周一为一周第一天）
export function calcCurrentWeek(startDate, today = new Date()) {
	if (!startDate) return 1
	const start = new Date(`${startDate}T00:00:00`)
	if (Number.isNaN(start.getTime())) return 1
	const startMonday = mondayOf(start)
	const todayMonday = mondayOf(today)
	const diffDays = Math.round((todayMonday.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1000))
	return Math.max(1, Math.floor(diffDays / 7) + 1)
}

function mondayOf(date) {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
	const day = d.getDay() // 0=Sun ... 6=Sat
	const offset = day === 0 ? -6 : 1 - day
	d.setDate(d.getDate() + offset)
	return d
}

// 给定学期开始日期 + 周次 + 星期(1-7) 计算具体日期
export function getDateOfWeek(startDate, week, dayOfWeek) {
	if (!startDate) return ''
	const start = new Date(`${startDate}T00:00:00`)
	if (Number.isNaN(start.getTime())) return ''
	const startMonday = mondayOf(start)
	const target = new Date(startMonday)
	target.setDate(target.getDate() + (week - 1) * 7 + (dayOfWeek - 1))
	const y = target.getFullYear()
	const m = `${target.getMonth() + 1}`.padStart(2, '0')
	const d = `${target.getDate()}`.padStart(2, '0')
	return `${y}-${m}-${d}`
}

// 把课程列表按周筛选，并展开成 {dayOfWeek -> [课程]}
export function buildWeekTable(courses, week) {
	const table = {}
	for (let i = 1; i <= 7; i++) table[i] = []
	courses.forEach(course => {
		if (!Array.isArray(course.weeks) || !course.weeks.includes(week)) return
		table[course.dayOfWeek].push(course)
	})
	Object.keys(table).forEach(key => {
		table[key].sort((a, b) => a.startPeriod - b.startPeriod)
	})
	return table
}

// 读取节次配置（不合法字段会回落到默认值）
export function loadPeriodConfig() {
	const data = uni.getStorageSync(PERIOD_CONFIG_KEY)
	return mergePeriodConfig(data)
}

export function savePeriodConfig(config) {
	const merged = mergePeriodConfig(config)
	uni.setStorageSync(PERIOD_CONFIG_KEY, merged)
	return merged
}

export function mergePeriodConfig(config) {
	const base = { ...DEFAULT_PERIOD_CONFIG }
	if (!config || typeof config !== 'object') return base
	const next = { ...base }
	if (isPositiveInt(config.classMinutes)) next.classMinutes = Number(config.classMinutes)
	if (isNonNegativeInt(config.breakMinutes)) next.breakMinutes = Number(config.breakMinutes)
	if (isTimeStr(config.morningStart)) next.morningStart = padTime(config.morningStart)
	if (isNonNegativeInt(config.morningCount)) next.morningCount = Number(config.morningCount)
	if (isTimeStr(config.afternoonStart)) next.afternoonStart = padTime(config.afternoonStart)
	if (isNonNegativeInt(config.afternoonCount)) next.afternoonCount = Number(config.afternoonCount)
	if (isTimeStr(config.eveningStart)) next.eveningStart = padTime(config.eveningStart)
	if (isNonNegativeInt(config.eveningCount)) next.eveningCount = Number(config.eveningCount)
	return next
}

// 根据节次配置生成 [{ start, end }] 列表
export function buildPeriodTimes(config) {
	const cfg = mergePeriodConfig(config)
	const list = []
	pushSession(list, cfg.morningStart, cfg.morningCount, cfg.classMinutes, cfg.breakMinutes)
	pushSession(list, cfg.afternoonStart, cfg.afternoonCount, cfg.classMinutes, cfg.breakMinutes)
	pushSession(list, cfg.eveningStart, cfg.eveningCount, cfg.classMinutes, cfg.breakMinutes)
	return list
}

export function getTotalPeriodCount(config) {
	const cfg = mergePeriodConfig(config)
	return cfg.morningCount + cfg.afternoonCount + cfg.eveningCount
}

function pushSession(list, startTime, count, classMinutes, breakMinutes) {
	if (!count || count <= 0) return
	let cursor = parseTimeMinutes(startTime)
	if (cursor === null) return
	for (let i = 0; i < count; i++) {
		const start = cursor
		const end = start + classMinutes
		list.push({ start: minutesToTime(start), end: minutesToTime(end) })
		cursor = end + breakMinutes
	}
}

function parseTimeMinutes(text) {
	const match = `${text || ''}`.match(/^(\d{1,2}):(\d{2})$/)
	if (!match) return null
	const h = parseInt(match[1], 10)
	const m = parseInt(match[2], 10)
	if (h < 0 || h > 23 || m < 0 || m > 59) return null
	return h * 60 + m
}

function minutesToTime(total) {
	const wrap = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
	const h = `${Math.floor(wrap / 60)}`.padStart(2, '0')
	const m = `${wrap % 60}`.padStart(2, '0')
	return `${h}:${m}`
}

function padTime(text) {
	const match = `${text}`.match(/^(\d{1,2}):(\d{2})$/)
	if (!match) return text
	return `${match[1].padStart(2, '0')}:${match[2]}`
}

function isPositiveInt(value) {
	const n = Number(value)
	return Number.isInteger(n) && n > 0
}

function isNonNegativeInt(value) {
	const n = Number(value)
	return Number.isInteger(n) && n >= 0
}

function isTimeStr(value) {
	return typeof value === 'string' && /^(\d{1,2}):(\d{2})$/.test(value)
}

// 重新导入时是否清除"手动添加"的课程，默认 false（保留）
export function loadClearManualOnImport() {
	const value = uni.getStorageSync(IMPORT_CLEAR_MANUAL_KEY)
	return value === true
}

export function saveClearManualOnImport(value) {
	uni.setStorageSync(IMPORT_CLEAR_MANUAL_KEY, value === true)
}

// 课程预设颜色（供颜色面板使用，含默认色池）
export const COURSE_COLOR_PRESETS = [
	'#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
	'#0ea5e9', '#14b8a6', '#ef4444', '#eab308', '#6366f1',
	'#84cc16', '#06b6d4', '#f43f5e', '#10b981', '#8b5cf6',
	'#0d9488', '#7c3aed', '#d946ef', '#f59e0b', '#64748b'
]

// 课程颜色覆盖（按课程名）：{ subject: '#xxxxxx' }
export function loadCourseColorMap() {
	const data = uni.getStorageSync(COURSE_COLOR_KEY)
	if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
	const map = {}
	Object.keys(data).forEach(key => {
		const value = data[key]
		if (typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
			map[key] = value
		}
	})
	return map
}

export function saveCourseColorMap(map) {
	const safe = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
	uni.setStorageSync(COURSE_COLOR_KEY, safe)
	return safe
}

export function setCourseColor(subject, color) {
	const map = loadCourseColorMap()
	const key = `${subject || ''}`.trim()
	if (!key) return map
	if (color) {
		map[key] = color
	} else {
		delete map[key]
	}
	return saveCourseColorMap(map)
}

// 根据课程名 + 颜色覆盖映射计算最终展示颜色
export function resolveCourseColor(subject, fallback, colorMap) {
	const map = colorMap || loadCourseColorMap()
	const key = `${subject || ''}`.trim()
	if (key && map[key]) return map[key]
	if (fallback) return fallback
	return pickCourseColor(subject)
}

// 课表页外观配置
export const DEFAULT_APPEARANCE = {
	backgroundImage: '',
	// 背景图透明度（0-1，越小越透）
	backgroundOpacity: 1,
	// 课程卡片透明度（0.3-1，整体卡片含色块）
	cardOpacity: 1,
	// 重叠课程闪烁切换周期（每节课的总停留时长，含淡入淡出，单位 ms）
	// 范围 1000-10000，步长 500
	overlapBlinkCycleMs: 5000
}

export function loadAppearance() {
	const data = uni.getStorageSync(APPEARANCE_KEY)
	return mergeAppearance(data)
}

export function saveAppearance(config) {
	const merged = mergeAppearance(config)
	uni.setStorageSync(APPEARANCE_KEY, merged)
	return merged
}

export function mergeAppearance(config) {
	const base = { ...DEFAULT_APPEARANCE }
	if (!config || typeof config !== 'object') return base
	const next = { ...base }
	if (typeof config.backgroundImage === 'string') next.backgroundImage = config.backgroundImage
	if (typeof config.backgroundOpacity === 'number' && config.backgroundOpacity >= 0 && config.backgroundOpacity <= 1) {
		next.backgroundOpacity = round2(config.backgroundOpacity)
	}
	if (typeof config.cardOpacity === 'number' && config.cardOpacity >= 0.3 && config.cardOpacity <= 1) {
		next.cardOpacity = round2(config.cardOpacity)
	}
	if (
		typeof config.overlapBlinkCycleMs === 'number' &&
		config.overlapBlinkCycleMs >= 1000 &&
		config.overlapBlinkCycleMs <= 10000
	) {
		// 取整到 500ms 步长
		next.overlapBlinkCycleMs = Math.round(config.overlapBlinkCycleMs / 500) * 500
	}
	return next
}

function round2(value) {
	return Math.round(value * 100) / 100
}
