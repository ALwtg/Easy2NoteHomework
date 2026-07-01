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
	breakAfterMap: {
		2: 30,
		6: 20
	},
	morningStart: '08:00',
	morningCount: 4,
	afternoonStart: '13:40',
	afternoonCount: 4,
	eveningStart: '18:30',
	eveningCount: 4,
	periodTimes: []
}

// 默认上课节次时间表（基于默认配置生成，用于显示）
export const DEFAULT_PERIOD_TIMES = buildPeriodTimes(DEFAULT_PERIOD_CONFIG)

export const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']


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
	const xqj = parseWeekday(item.xqj || item.xqjmc || item.xqmc)
	const jcsRange = parseJcs(item.jcs || item.jc || item.jcor || item.ksjc || item.ksjcdm)
	if (!xqj || !jcsRange) return null
	const weekText = firstText(item.zcd, item.zcmc, item.skzcmc, item.zc, item.skzc)
	const weeks = parseZcd(weekText)
	const subject = firstText(item.kcmc, item.kcName, item.kcmcDisplay) || '未命名课程'
	return {
		id: `${item.kch_id || item.kch || item.kcid || ''}_${item.jxbmc || item.jxb_id || item.jxbid || ''}_${xqj}_${jcsRange.start}`,
		subject,
		teacher: firstText(item.xm, item.jsxm, item.jsmc, item.teacher),
		location: firstText(item.cdmc, item.jxdd, item.jxddmc, item.croommc),
		dayOfWeek: xqj,
		startPeriod: jcsRange.start,
		endPeriod: jcsRange.end,
		weeks,
		weekText,
		jcText: firstText(item.jc, item.jcs, item.jcor, item.ksjc, item.ksjcdm),
		note: firstText(item.kkbzsmc, item.kcxzmc),
		color: pickCourseColor(subject)
	}
}

function firstText(...values) {
	for (const value of values) {
		const text = `${value || ''}`.trim()
		if (text) return text
	}
	return ''
}

function parseWeekday(value) {
	const text = `${value || ''}`.trim()
	const num = parseInt(text, 10)
	if (num >= 1 && num <= 7) return num
	const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
	const match = text.match(/[一二三四五六日天]/)
	return match ? map[match[0]] : 0
}

// 解析 "1-2" / "3-4" / "5" / "第5-8节" / "0508" 节次范围
function parseJcs(jcs) {
	if (!jcs) return null
	const text = `${jcs}`
	const rangeMatches = Array.from(text.matchAll(/(\d+)\s*(?:[-–~至]|到)\s*(\d+)/g))
	if (rangeMatches.length) {
		const ranges = rangeMatches
			.map(match => ({ start: parseInt(match[1], 10), end: parseInt(match[2], 10) }))
			.filter(range => range.start > 0 && range.end >= range.start)
		if (ranges.length) {
			return ranges.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]
		}
	}
	const compact = text.match(/^\s*(\d{2})(\d{2})\s*$/)
	if (compact) {
		const start = parseInt(compact[1], 10)
		const end = parseInt(compact[2], 10)
		if (start > 0 && end >= start) return { start, end }
	}
	const nums = text.match(/\d+/g)
	if (nums && nums.length) {
		const values = nums.map(n => parseInt(n, 10)).filter(n => n > 0 && n <= 30)
		if (values.length >= 2) return { start: Math.min(...values), end: Math.max(...values) }
		if (values.length === 1) return { start: values[0], end: values[0] }
	}
	return null
}

// 解析 "1-3,5,7-16周" / "1-16周" / "1,3,5周" / "1-16周(单)"
export function parseZcd(zcd) {
	const result = new Set()
	const text = `${zcd || ''}`
	if (!text.trim()) return []
	const normalized = text
		.replace(/星期[一二三四五六日天]/g, '')
		.replace(/[第节\s]/g, '')
		.replace(/，/g, ',')
		.replace(/、/g, ',')
	let matched = false
	const rangeReg = /(\d+)\s*[-–~至]\s*(\d+)\s*(?:周)?\s*(?:\(?\s*(单|双)\s*(?:周)?\s*\)?)?/g
	let range
	while ((range = rangeReg.exec(normalized))) {
		matched = true
		const from = parseInt(range[1], 10)
		const to = parseInt(range[2], 10)
		const filter = range[3]
		for (let i = from; i <= to; i++) {
			if (filter === '单' && i % 2 === 0) continue
			if (filter === '双' && i % 2 !== 0) continue
			result.add(i)
		}
	}
	const nums = normalized.match(/\d+/g) || []
	nums.map(n => parseInt(n, 10)).filter(n => n > 0 && n <= 30).forEach(n => result.add(n))
	if (!matched && result.size === 0) return []
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
	const base = {
		...DEFAULT_PERIOD_CONFIG,
		breakAfterMap: { ...DEFAULT_PERIOD_CONFIG.breakAfterMap },
		periodTimes: []
	}
	if (!config || typeof config !== 'object') return base
	const next = { ...base }
	if (isPositiveInt(config.classMinutes)) next.classMinutes = Number(config.classMinutes)
	if (isNonNegativeInt(config.breakMinutes)) next.breakMinutes = Number(config.breakMinutes)
	next.breakAfterMap = mergeBreakAfterMap(config.breakAfterMap, next.breakMinutes)
	if (isTimeStr(config.morningStart)) next.morningStart = padTime(config.morningStart)
	if (isNonNegativeInt(config.morningCount)) next.morningCount = Number(config.morningCount)
	if (isTimeStr(config.afternoonStart)) next.afternoonStart = padTime(config.afternoonStart)
	if (isNonNegativeInt(config.afternoonCount)) next.afternoonCount = Number(config.afternoonCount)
	if (isTimeStr(config.eveningStart)) next.eveningStart = padTime(config.eveningStart)
	if (isNonNegativeInt(config.eveningCount)) next.eveningCount = Number(config.eveningCount)
	const total = next.morningCount + next.afternoonCount + next.eveningCount
	if (Array.isArray(config.periodTimes)) {
		next.periodTimes = normalizePeriodTimes(config.periodTimes, total)
	}
	return next
}

function mergeBreakAfterMap(map, fallbackBreakMinutes) {
	const base = { ...DEFAULT_PERIOD_CONFIG.breakAfterMap }
	if (map && typeof map === 'object' && !Array.isArray(map)) {
		Object.keys(map).forEach(key => {
			if (isNonNegativeInt(map[key])) base[Number(key)] = Number(map[key])
		})
	}
	if (!isNonNegativeInt(base[2])) base[2] = 30
	if (!isNonNegativeInt(base[6])) base[6] = 20
	return base
}

function normalizePeriodTimes(times, total) {
	return times.slice(0, total).map(item => {
		if (!item || typeof item !== 'object') return null
		const start = isTimeStr(item.start) ? padTime(item.start) : ''
		const end = isTimeStr(item.end) ? padTime(item.end) : ''
		return start && end ? { start, end } : null
	}).filter(Boolean)
}


// 根据节次配置生成 [{ start, end }] 列表
export function buildPeriodTimes(config) {
	const cfg = mergePeriodConfig(config)
	const total = getTotalPeriodCount(cfg)
	if (Array.isArray(cfg.periodTimes) && cfg.periodTimes.length >= total) {
		return cfg.periodTimes.slice(0, total)
	}
	const list = []
	pushSession(list, cfg.morningStart, cfg.morningCount, cfg.classMinutes, cfg.breakMinutes, cfg.breakAfterMap)
	pushSession(list, cfg.afternoonStart, cfg.afternoonCount, cfg.classMinutes, cfg.breakMinutes, cfg.breakAfterMap)
	pushSession(list, cfg.eveningStart, cfg.eveningCount, cfg.classMinutes, cfg.breakMinutes, cfg.breakAfterMap)
	return list
}

export function getTotalPeriodCount(config) {
	const cfg = mergePeriodConfig(config)
	return cfg.morningCount + cfg.afternoonCount + cfg.eveningCount
}

export function buildAutoPeriodTimes(config) {
	const cfg = mergePeriodConfig({ ...config, periodTimes: [] })
	const list = []
	pushSession(list, cfg.morningStart, cfg.morningCount, cfg.classMinutes, cfg.breakMinutes, cfg.breakAfterMap)
	pushSession(list, cfg.afternoonStart, cfg.afternoonCount, cfg.classMinutes, cfg.breakMinutes, cfg.breakAfterMap)
	pushSession(list, cfg.eveningStart, cfg.eveningCount, cfg.classMinutes, cfg.breakMinutes, cfg.breakAfterMap)
	return list
}

function pushSession(list, startTime, count, classMinutes, breakMinutes, breakAfterMap) {
	if (!count || count <= 0) return
	let cursor = parseTimeMinutes(startTime)
	if (cursor === null) return
	for (let i = 0; i < count; i++) {
		const periodNo = list.length + 1
		const start = cursor
		const end = start + classMinutes
		list.push({ start: minutesToTime(start), end: minutesToTime(end) })
		const currentBreak = breakAfterMap && isNonNegativeInt(breakAfterMap[periodNo]) ? Number(breakAfterMap[periodNo]) : breakMinutes
		cursor = end + currentBreak
	}
}


export function parseClockMinutes(text) {
	return parseTimeMinutes(text)
}

export function minutesToClockTime(total) {
	return minutesToTime(total)
}

export function getCourseDateTime(course, periodTimes, startOrEnd = 'start', baseDate = new Date()) {
	if (!course) return null
	const times = Array.isArray(periodTimes) ? periodTimes : buildPeriodTimes(loadPeriodConfig())
	const period = startOrEnd === 'end' ? course.endPeriod : course.startPeriod
	const time = times[period - 1]
	if (!time) return null
	const minutes = parseTimeMinutes(startOrEnd === 'end' ? time.end : time.start)
	if (minutes === null) return null
	const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
	const today = date.getDay() || 7
	const targetDay = Number(course.dayOfWeek) || today
	let offset = targetDay - today
	if (offset < 0) offset += 7
	date.setDate(date.getDate() + offset)
	date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
	return date
}

export function findCurrentOrRecentCourse(options = {}) {
	const now = options.now || new Date()
	const courses = Array.isArray(options.courses) ? options.courses : loadCourses()
	const week = options.week || calcCurrentWeek(loadSemesterStartDate(), now)
	const periodTimes = Array.isArray(options.periodTimes) ? options.periodTimes : buildPeriodTimes(loadPeriodConfig())
	const recentMinutes = Number(options.recentMinutes) >= 0 ? Number(options.recentMinutes) : 20
	const dayOfWeek = now.getDay() || 7
	const currentMinutes = now.getHours() * 60 + now.getMinutes()
	const todayCourses = courses
		.filter(course => course && Number(course.dayOfWeek) === dayOfWeek && (!Array.isArray(course.weeks) || !course.weeks.length || course.weeks.includes(week)))
		.sort((a, b) => a.startPeriod - b.startPeriod)
	for (const course of todayCourses) {
		const start = parseTimeMinutes((periodTimes[course.startPeriod - 1] || {}).start)
		const end = parseTimeMinutes((periodTimes[course.endPeriod - 1] || {}).end)
		if (start === null || end === null) continue
		if (currentMinutes >= start && currentMinutes <= end + recentMinutes) {
			return { course, periodTime: { start: minutesToTime(start), end: minutesToTime(end) }, status: currentMinutes <= end ? 'current' : 'recent' }
		}
	}
	return null
}

export function findNextCourse(options = {}) {
	const now = options.now || new Date()
	const courses = Array.isArray(options.courses) ? options.courses : loadCourses()
	const semesterStart = options.semesterStart || loadSemesterStartDate()
	const periodTimes = Array.isArray(options.periodTimes) ? options.periodTimes : buildPeriodTimes(loadPeriodConfig())
	const currentWeek = options.week || calcCurrentWeek(semesterStart, now)
	let best = null
	for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		date.setDate(date.getDate() + dayOffset)
		const dayOfWeek = date.getDay() || 7
		const week = currentWeek + Math.floor((dayOfWeek < (now.getDay() || 7) ? dayOffset + 7 : dayOffset) / 7)
		courses.forEach(course => {
			if (!course || Number(course.dayOfWeek) !== dayOfWeek) return
			if (Array.isArray(course.weeks) && course.weeks.length && !course.weeks.includes(week)) return
			const time = periodTimes[course.startPeriod - 1]
			const minutes = parseTimeMinutes(time && time.start)
			if (minutes === null) return
			const startAt = new Date(date)
			startAt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
			if (startAt <= now) return
			if (!best || startAt < best.startAt) best = { course, startAt, week, periodTime: time }
		})
		if (best) return best
	}
	return null
}

export function formatCoursePoint(info) {
	if (!info || !info.course || !info.startAt) return ''
	const date = info.startAt
	const md = `${date.getMonth() + 1}月${date.getDate()}日`
	return `${md}周${WEEKDAY_NAMES[(Number(info.course.dayOfWeek) || 1) - 1]}第${info.course.startPeriod}-${info.course.endPeriod}节 ${info.course.subject || '课程'}`
}

// 查找指定学科的下一次上课时间
export function findNextCourseForSubject(subject, options = {}) {
	const now = options.now || new Date()
	const courses = Array.isArray(options.courses) ? options.courses : loadCourses()
	const semesterStart = options.semesterStart || loadSemesterStartDate()
	const periodTimes = Array.isArray(options.periodTimes) ? options.periodTimes : buildPeriodTimes(loadPeriodConfig())
	const currentWeek = options.week || calcCurrentWeek(semesterStart, now)
	const searchDays = Number.isInteger(Number(options.searchDays)) && Number(options.searchDays) > 0 ? Number(options.searchDays) : 210
	let best = null
	for (let dayOffset = 0; dayOffset <= searchDays; dayOffset++) {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		date.setDate(date.getDate() + dayOffset)
		const dayOfWeek = date.getDay() || 7
		const week = currentWeek + Math.floor((dayOfWeek < (now.getDay() || 7) ? dayOffset + 7 : dayOffset) / 7)
		courses.forEach(course => {
			if (!course || Number(course.dayOfWeek) !== dayOfWeek) return
			if ((course.subject || '').trim() !== (subject || '').trim()) return
			if (Array.isArray(course.weeks) && course.weeks.length && !course.weeks.includes(week)) return
			const time = periodTimes[course.startPeriod - 1]
			const minutes = parseTimeMinutes(time && time.start)
			if (minutes === null) return
			const startAt = new Date(date)
			startAt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
			if (startAt <= now) return
			if (!best || startAt < best.startAt) best = { course, startAt, week, periodTime: time }
		})
		if (best) return best
	}
	return null
}

// 根据指定的截止日期和时间，查找该时间点对应的课程（匹配到时间点在课程节次范围内即视为命中）
export function findCourseAtDeadline(deadlineDate, deadlineTime, options = {}) {
	if (!deadlineDate || !deadlineTime) return null
	const courses = Array.isArray(options.courses) ? options.courses : loadCourses()
	const semesterStart = options.semesterStart || loadSemesterStartDate()
	const periodTimes = Array.isArray(options.periodTimes) ? options.periodTimes : buildPeriodTimes(loadPeriodConfig())
	const deadline = new Date(`${deadlineDate}T${deadlineTime}:00`)
	if (Number.isNaN(deadline.getTime())) return null
	const dayOfWeek = deadline.getDay() || 7
	const deadlineMinutes = deadline.getHours() * 60 + deadline.getMinutes()
	const currentWeek = options.week || calcCurrentWeek(semesterStart, deadline)
	const matching = courses.filter(course => {
		if (!course || Number(course.dayOfWeek) !== dayOfWeek) return false
		if (Array.isArray(course.weeks) && course.weeks.length && !course.weeks.includes(currentWeek)) return false
		const start = periodTimes[course.startPeriod - 1]
		const end = periodTimes[course.endPeriod - 1]
		if (!start || !end) return false
		const startMin = parseTimeMinutes(start.start)
		const endMin = parseTimeMinutes(end.end)
		if (startMin === null || endMin === null) return false
		return deadlineMinutes >= startMin - 5 && deadlineMinutes <= endMin + 5
	})
	if (!matching.length) return null
	// 优先返回截止时间正好在课程开始时间附近的
	const exact = matching.find(c => {
		const startMin = parseTimeMinutes(periodTimes[c.startPeriod - 1].start)
		return startMin !== null && Math.abs(deadlineMinutes - startMin) <= 5
	})
	const course = exact || matching[0]
	const startAt = new Date(deadline)
	const startTime = periodTimes[course.startPeriod - 1]
	if (startTime) {
		const sm = parseTimeMinutes(startTime.start)
		if (sm !== null) {
			startAt.setHours(Math.floor(sm / 60), sm % 60, 0, 0)
		}
	}
	return { course, startAt, week: currentWeek, periodTime: startTime }
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
	'#0d9488', '#7c3aed', '#d946ef', '#f59e0b', '#64748b',
	'#be185d', '#9333ea', '#0f766e', '#b45309', '#475569'
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
	// 背景图配置更新时间，用于跨页面刷新和图片缓存失效
	updatedAt: 0,
	// 背景图透明度（0-1，越小越透）
	backgroundOpacity: 1,
	// 课程卡片透明度（0.3-1，整体卡片含色块）
	cardOpacity: 1,
	// 重叠课程切换显示模式：'switch'（轮播闪烁，默认）/ 'overlap'（按学科顺序分层重叠）
	overlapDisplayMode: 'switch',
	// 重叠显示模式下的最低透明度（0-0.5，默认 0.1 = 10%）
	overlapMinOpacity: 0.1,
	// 重叠课程切换频率（每节课停留时长，含淡入淡出，单位 ms，默认 2000）
	// 范围 1000-10000，步长 500。优先于废弃的 overlapBlinkCycleMs
	overlapSwitchFrequency: 2000,
	// [废弃] 保留兼容旧数据，新逻辑优先使用 overlapSwitchFrequency
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
	if (typeof config.updatedAt === 'number' && config.updatedAt > 0) next.updatedAt = config.updatedAt
	if (typeof config.backgroundOpacity === 'number' && config.backgroundOpacity >= 0 && config.backgroundOpacity <= 1) {
		next.backgroundOpacity = round2(config.backgroundOpacity)
	}
	if (typeof config.cardOpacity === 'number' && config.cardOpacity >= 0.3 && config.cardOpacity <= 1) {
		next.cardOpacity = round2(config.cardOpacity)
	}
	// 重叠显示模式：仅接受 'switch' 或 'overlap'
	if (config.overlapDisplayMode === 'switch' || config.overlapDisplayMode === 'overlap') {
		next.overlapDisplayMode = config.overlapDisplayMode
	}
	// 最低透明度：0-0.5
	if (typeof config.overlapMinOpacity === 'number' && config.overlapMinOpacity >= 0 && config.overlapMinOpacity <= 0.5) {
		next.overlapMinOpacity = round2(config.overlapMinOpacity)
	}
	// 切换频率：1000-10000ms，取整到 500ms 步长
	if (
		typeof config.overlapSwitchFrequency === 'number' &&
		config.overlapSwitchFrequency >= 1000 &&
		config.overlapSwitchFrequency <= 10000
	) {
		next.overlapSwitchFrequency = Math.round(config.overlapSwitchFrequency / 500) * 500
	}
	// 兼容旧字段 overlapBlinkCycleMs（若 overlapSwitchFrequency 未设置则回退）
	if (
		!config.overlapSwitchFrequency &&
		typeof config.overlapBlinkCycleMs === 'number' &&
		config.overlapBlinkCycleMs >= 1000 &&
		config.overlapBlinkCycleMs <= 10000
	) {
		const legacy = Math.round(config.overlapBlinkCycleMs / 500) * 500
		next.overlapBlinkCycleMs = legacy
		next.overlapSwitchFrequency = next.overlapSwitchFrequency === 2000 && legacy !== 2000 ? legacy : next.overlapSwitchFrequency
	}
	return next
}

function round2(value) {
	return Math.round(value * 100) / 100
}
