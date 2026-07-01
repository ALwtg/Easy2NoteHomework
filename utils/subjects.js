export const SUBJECT_KEY = 'subject_list'
export const DEFAULT_SUBJECTS = []

const LEGACY_DEFAULT_SUBJECTS = ['高等数学', '大学英语', '程序设计', '数据结构', '线性代数']

export function createSubject(name) {
	return {
		id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
		name,
		createdAt: new Date().toISOString()
	}
}

export function loadSubjects() {
	const saved = uni.getStorageSync(SUBJECT_KEY)
	if (Array.isArray(saved) && saved.length) {
		if (isLegacyDefaultSubjects(saved)) {
			const defaults = DEFAULT_SUBJECTS.map(createSubject)
			saveSubjects(defaults)
			return defaults
		}
		return saved
	}

	const defaults = DEFAULT_SUBJECTS.map(createSubject)
	saveSubjects(defaults)
	return defaults
}

export function saveSubjects(subjects) {
	uni.setStorageSync(SUBJECT_KEY, Array.isArray(subjects) ? subjects : [])
}

export function syncSubjectsFromCourses(courses) {
	const courseSubjects = Array.isArray(courses)
		? courses.map(course => `${course && course.subject || ''}`.trim()).filter(Boolean)
		: []
	if (!courseSubjects.length) return loadSubjects()

	const subjects = loadSubjects()
	const existingNames = new Set(subjects.map(item => item && item.name).filter(Boolean))
	let changed = false

	courseSubjects.forEach(name => {
		if (existingNames.has(name)) return
		existingNames.add(name)
		subjects.push(createSubject(name))
		changed = true
	})

	if (changed) saveSubjects(subjects)
	return subjects
}

function isLegacyDefaultSubjects(subjects) {
	if (!Array.isArray(subjects) || subjects.length !== LEGACY_DEFAULT_SUBJECTS.length) return false
	const names = subjects.map(item => item && item.name).filter(Boolean)
	return LEGACY_DEFAULT_SUBJECTS.every(name => names.includes(name))
}

