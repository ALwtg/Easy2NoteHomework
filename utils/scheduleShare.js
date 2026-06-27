// 课表分享与导入逻辑
// - 通过 base64 包装 JSON，保证粘贴到聊天框 / 写入文件后不出现转义问题
// - 包含一个识别前缀 ZF_SCHEDULE_SHARE_V1，便于在剪切板里识别
// - 兼容直接粘贴 JSON / 教务系统原始 JSON（复用 scheduleImporter 的解析）

import { base64Encode, base64Decode } from './base64.js'
import {
	loadCourses,
	saveCourses,
	loadScheduleMeta,
	saveScheduleMeta,
	loadSemesterStartDate,
	saveSemesterStartDate,
	pickCourseColor,
	loadClearManualOnImport
} from './schedule.js'
import { parseScheduleImportText } from './scheduleImporter.js'

export const SHARE_PREFIX = 'ZF_SCHEDULE_SHARE_V1::'
const LAST_IMPORT_CLIP_KEY = 'schedule_last_clip_share'

// 用于人类可读的"分享文字"开头
const HUMAN_HEADER = '【课表分享】请在作业助手中粘贴或选择文件导入，以下分享码请勿改动：'

export function buildScheduleShareText() {
	const courses = loadCourses()
	const meta = loadScheduleMeta() || {}
	const semesterStart = loadSemesterStartDate() || ''
	const payload = {
		type: 'schedule',
		version: 1,
		exportedAt: new Date().toISOString(),
		semesterStart,
		meta: {
			xnm: meta.xnm || '',
			xqm: meta.xqm || '',
			xnmc: meta.xnmc || '',
			xqmmc: meta.xqmmc || ''
		},
		courses: courses.map(serializeCourse)
	}
	const code = SHARE_PREFIX + base64Encode(JSON.stringify(payload))
	return {
		code,
		text: `${HUMAN_HEADER}\n${code}`,
		count: courses.length
	}
}

function serializeCourse(course) {
	if (!course) return null
	return {
		id: course.id,
		subject: course.subject,
		teacher: course.teacher || '',
		location: course.location || '',
		dayOfWeek: course.dayOfWeek,
		startPeriod: course.startPeriod,
		endPeriod: course.endPeriod,
		weeks: Array.isArray(course.weeks) ? course.weeks.slice() : [],
		weekText: course.weekText || '',
		jcText: course.jcText || '',
		note: course.note || '',
		color: course.color || '',
		manual: !!course.manual
	}
}

// 在文本中提取分享码（兼容粘贴整段聊天文字）
export function extractShareCodeFromText(rawText) {
	const text = `${rawText || ''}`
	const idx = text.indexOf(SHARE_PREFIX)
	if (idx < 0) return ''
	const tail = text.slice(idx + SHARE_PREFIX.length)
	// 截取到第一个非 base64 字符为止
	const match = tail.match(/^[A-Za-z0-9+/=]+/)
	return match ? SHARE_PREFIX + match[0] : ''
}

// 把 share 文本（可能是分享码、纯 JSON、教务原始 JSON）解析成课表数据
export function parseScheduleShareText(rawText) {
	const text = `${rawText || ''}`.trim()
	if (!text) throw new Error('内容为空')

	const code = extractShareCodeFromText(text)
	if (code) {
		const json = base64Decode(code.slice(SHARE_PREFIX.length))
		const payload = JSON.parse(json)
		if (!payload || payload.type !== 'schedule' || !Array.isArray(payload.courses)) {
			throw new Error('分享码格式不正确')
		}
		return {
			source: 'share-code',
			courses: payload.courses.map(normalizeCourse).filter(Boolean),
			meta: payload.meta || {},
			semesterStart: payload.semesterStart || '',
			exportedAt: payload.exportedAt || ''
		}
	}

	// 兼容直接粘贴的 JSON（自身导出的 JSON 或教务系统原始 JSON）
	let parsed = null
	try {
		parsed = JSON.parse(text)
	} catch (e) {}
	if (parsed && parsed.type === 'schedule' && Array.isArray(parsed.courses)) {
		return {
			source: 'share-json',
			courses: parsed.courses.map(normalizeCourse).filter(Boolean),
			meta: parsed.meta || {},
			semesterStart: parsed.semesterStart || '',
			exportedAt: parsed.exportedAt || ''
		}
	}

	// 兼容：教务系统接口 JSON（kbList）
	const fromZf = parseScheduleImportText(text)
	return {
		source: 'zf-json',
		courses: fromZf.courses,
		meta: fromZf.meta || {},
		semesterStart: '',
		exportedAt: new Date().toISOString()
	}
}

function normalizeCourse(item) {
	if (!item) return null
	const dayOfWeek = parseInt(item.dayOfWeek, 10)
	const startPeriod = parseInt(item.startPeriod, 10)
	const endPeriod = parseInt(item.endPeriod, 10) || startPeriod
	if (!dayOfWeek || !startPeriod) return null
	const subject = `${item.subject || ''}`.trim() || '未命名课程'
	return {
		id: `${item.id || `share_${Date.now()}_${Math.random().toString(16).slice(2)}`}`,
		subject,
		teacher: `${item.teacher || ''}`.trim(),
		location: `${item.location || ''}`.trim(),
		dayOfWeek,
		startPeriod,
		endPeriod,
		weeks: Array.isArray(item.weeks) ? item.weeks.map(n => parseInt(n, 10)).filter(n => n > 0) : [],
		weekText: `${item.weekText || ''}`,
		jcText: `${item.jcText || ''}`,
		note: `${item.note || ''}`,
		color: item.color || pickCourseColor(subject),
		manual: !!item.manual
	}
}

// 应用分享数据到本地存储
// 默认 merge: 合并课程，去重后追加
// replace: 直接覆盖
export function applyScheduleShare(parsed, options = {}) {
	const mode = options.mode || 'replace'
	const list = Array.isArray(parsed.courses) ? parsed.courses.slice() : []
	if (!list.length) throw new Error('未识别到任何课程')

	let nextCourses = []
	if (mode === 'merge') {
		const existing = loadCourses()
		const keyOf = c => `${c.subject}|${c.dayOfWeek}|${c.startPeriod}|${c.endPeriod}|${(c.weeks || []).join(',')}`
		const seen = new Set(existing.map(keyOf))
		nextCourses = existing.slice()
		list.forEach(c => {
			const k = keyOf(c)
			if (!seen.has(k)) {
				seen.add(k)
				nextCourses.push(c)
			}
		})
	} else {
		// replace 模式时仍然遵循"重新导入清除手动课"开关
		const existing = loadCourses()
		const keepManual = !loadClearManualOnImport()
		nextCourses = list.slice()
		if (keepManual) {
			nextCourses = nextCourses.concat(existing.filter(c => c && c.manual))
		}
	}

	saveCourses(nextCourses)

	const existingMeta = loadScheduleMeta() || {}
	const incomingMeta = parsed.meta || {}
	saveScheduleMeta({
		...existingMeta,
		...incomingMeta,
		importMode: 'share',
		importedAt: new Date().toISOString(),
		courseCount: nextCourses.length
	})

	if (parsed.semesterStart && !loadSemesterStartDate()) {
		saveSemesterStartDate(parsed.semesterStart)
	}

	return {
		courses: nextCourses,
		count: list.length,
		total: nextCourses.length,
		mode
	}
}

// 用于"自动从剪切板识别相同内容只识别一次"
export function isSameAsLastClipShare(code) {
	if (!code) return true
	try {
		const last = uni.getStorageSync(LAST_IMPORT_CLIP_KEY) || ''
		return last && last === code
	} catch (e) {
		return false
	}
}

export function rememberClipShare(code) {
	if (!code) return
	try {
		uni.setStorageSync(LAST_IMPORT_CLIP_KEY, code)
	} catch (e) {}
}
