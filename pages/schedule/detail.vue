<template>
	<view class="page">
		<view class="custom-nav">
			<view class="nav-back" @click="onBack">
				<text class="nav-back-icon">‹</text>
			</view>
			<text class="nav-title">{{ editing ? '编辑课程' : '课程详情' }}</text>
			<view class="nav-action" @click="toggleEdit">
				<text class="nav-action-text">{{ editing ? '取消' : '编辑' }}</text>
			</view>
		</view>

		<scroll-view scroll-y class="detail-scroll" v-if="course">
			<!-- 顶部课程卡 -->
			<view class="hero" :style="{ background: courseColor }">
				<view class="hero-color-bar">
					<view
						v-for="c in colorPresets"
						:key="c"
						class="hero-color-dot"
						:class="{ active: editingColor === c }"
						:style="{ background: c }"
						@click="editing && selectColor(c)"
					></view>
				</view>
				<text class="hero-subject">{{ course.subject || '未命名课程' }}</text>
				<view class="hero-meta">
					<text class="hero-meta-item">星期{{ weekDayName(course.dayOfWeek) }}</text>
					<text class="hero-meta-sep">·</text>
					<text class="hero-meta-item">第{{ course.startPeriod }}-{{ course.endPeriod }}节</text>
				</view>
				<text class="hero-weeks">{{ weekTextDisplay }}</text>
			</view>

			<!-- 详情模式 -->
			<view v-if="!editing" class="info-list">
				<view class="info-row">
					<text class="info-label">教师</text>
					<text class="info-value">{{ course.teacher || '未设置' }}</text>
				</view>
				<view class="info-row">
					<text class="info-label">教室</text>
					<text class="info-value">{{ course.location || '未设置' }}</text>
				</view>
				<view class="info-row">
					<text class="info-label">时间</text>
					<text class="info-value">星期{{ weekDayName(course.dayOfWeek) }} 第{{ course.startPeriod }}-{{ course.endPeriod }}节</text>
				</view>
				<view class="info-row">
					<text class="info-label">周次</text>
					<text class="info-value">{{ weekTextDisplay }}</text>
				</view>
				<view class="info-row" v-if="course.note">
					<text class="info-label">备注</text>
					<text class="info-value">{{ course.note }}</text>
				</view>
			</view>

			<!-- 编辑模式 -->
			<view v-else class="form">
				<view class="form-row">
					<text class="form-label">课程名</text>
					<input class="form-input" type="text" v-model="form.subject" placeholder="必填，例如：高等数学" />
				</view>
				<view class="form-row">
					<text class="form-label">教师</text>
					<input class="form-input" type="text" v-model="form.teacher" placeholder="可选" />
				</view>
				<view class="form-row">
					<text class="form-label">教室</text>
					<input class="form-input" type="text" v-model="form.location" placeholder="可选" />
				</view>
				<view class="form-row">
					<text class="form-label">星期</text>
					<view class="chip-row">
						<view
							v-for="d in 7"
							:key="`day-${d}`"
							:class="['chip', form.dayOfWeek === d ? 'active' : '']"
							@click="form.dayOfWeek = d"
						>
							<text>{{ weekDayName(d) }}</text>
						</view>
					</view>
				</view>
				<view class="form-row">
					<text class="form-label">起始节次</text>
					<view class="period-control">
						<view class="period-btn" @click="adjustPeriod('start', -1)"><text>−</text></view>
						<text class="period-value">第{{ form.startPeriod }}节</text>
						<view class="period-btn" @click="adjustPeriod('start', 1)"><text>+</text></view>
					</view>
				</view>
				<view class="form-row">
					<text class="form-label">结束节次</text>
					<view class="period-control">
						<view class="period-btn" @click="adjustPeriod('end', -1)"><text>−</text></view>
						<text class="period-value">第{{ form.endPeriod }}节</text>
						<view class="period-btn" @click="adjustPeriod('end', 1)"><text>+</text></view>
					</view>
				</view>
				<view class="form-row form-row-block">
					<text class="form-label">周次</text>
					<view class="week-mode-row">
						<view :class="['chip', form.weekMode === 'current' ? 'active' : '']" @click="applyWeekMode('current')"><text>仅本周</text></view>
						<view :class="['chip', form.weekMode === 'all' ? 'active' : '']" @click="applyWeekMode('all')"><text>每周</text></view>
						<view :class="['chip', form.weekMode === 'odd' ? 'active' : '']" @click="applyWeekMode('odd')"><text>单周</text></view>
						<view :class="['chip', form.weekMode === 'even' ? 'active' : '']" @click="applyWeekMode('even')"><text>双周</text></view>
					</view>
				</view>
				<view class="form-row form-row-block">
					<text class="form-label">自定义周次</text>
					<view class="week-grid">
						<view
							v-for="w in totalWeeks"
							:key="`wk-${w}`"
							:class="['week-cell', form.weeks.includes(w) ? 'active' : '']"
							@click="toggleWeek(w)"
						>
							<text>{{ w }}</text>
						</view>
					</view>
				</view>
				<view class="form-row form-row-block">
					<text class="form-label">备注</text>
					<textarea class="form-textarea" v-model="form.note" placeholder="可选" maxlength="200" />
				</view>
				<button class="save-btn" @click="saveEdit">保存修改</button>
			</view>

			<!-- 删除区 -->
			<view v-if="!editing" class="danger-zone">
				<button class="delete-btn" @click="openDeleteOptions">删除这节课</button>
			</view>

			<view class="bottom-safe"></view>
		</scroll-view>

		<view v-else class="empty">
			<text class="empty-text">课程不存在或已被删除</text>
			<button class="empty-btn" @click="onBack">返回课表</button>
		</view>

		<!-- 删除范围二次确认 -->
		<view v-if="showDeleteOptions && course" class="delete-mask" @click="closeDeleteOptions">
			<view class="delete-card" @click.stop>
				<text class="delete-title">选择删除范围</text>
				<text class="delete-subtitle">{{ course.subject || '这节课' }}</text>
				<button class="delete-option danger" @click="confirmDelete('single')">仅删除这节课</button>
				<button class="delete-option" @click="confirmDelete('day')">删除每周这一时间段的同一节课</button>
				<button class="delete-option" @click="confirmDelete('teacher')" :disabled="!hasTeacher">删除这个老师的所有课</button>
				<button class="delete-option cancel" @click="closeDeleteOptions">取消</button>
			</view>
		</view>
	</view>
</template>

<script>
import {
	loadCourses,
	saveCourses,
	loadPeriodConfig,
	getTotalPeriodCount,
	resolveCourseColor,
	setCourseColor,
	COURSE_COLOR_PRESETS,
	WEEKDAY_NAMES
} from '@/utils/schedule.js'

const TOTAL_WEEKS = 25

export default {
	data() {
		return {
			courseId: '',
			course: null,
			editing: false,
			editingColor: '',
			form: {
				subject: '',
				teacher: '',
				location: '',
				dayOfWeek: 1,
				startPeriod: 1,
				endPeriod: 1,
				weeks: [],
				weekMode: 'current',
				note: ''
			},
			totalPeriods: 12,
			totalWeeks: TOTAL_WEEKS,
			colorPresets: COURSE_COLOR_PRESETS.slice(0, 15),
			showDeleteOptions: false
		}
	},
	computed: {
		courseColor() {
			if (!this.course) return '#2979ff'
			if (this.editingColor) return this.editingColor
			return resolveCourseColor(this.course.subject, this.course.color)
		},
		weekTextDisplay() {
			if (!this.course) return ''
			const text = this.course.weekText
			if (text) return text
			const weeks = Array.isArray(this.course.weeks) ? this.course.weeks : []
			if (!weeks.length) return '未设置周次'
			return weeks.slice().sort((a, b) => a - b).join(',') + '周'
		},
		hasTeacher() {
			return !!(this.course && `${this.course.teacher || ''}`.trim())
		}
	},
	onLoad(options = {}) {
		this.courseId = options.courseId || ''
		const config = loadPeriodConfig()
		this.totalPeriods = getTotalPeriodCount(config)
		this.loadCourse()
	},
	onShow() {
		// 从课表页返回时无需额外处理（编辑结果已落库）
		if (!this.course) this.loadCourse()
	},
	methods: {
		weekDayName(num) {
			return WEEKDAY_NAMES[(num - 1) % 7]
		},
		loadCourse() {
			const list = loadCourses()
			const found = list.find(c => c && c.id === this.courseId)
			if (found) {
				this.course = { ...found }
				this.editingColor = resolveCourseColor(this.course.subject, this.course.color)
			} else {
				this.course = null
			}
		},
		toggleEdit() {
			if (this.editing) {
				this.editing = false
				return
			}
			if (!this.course) return
			const c = this.course
			this.form = {
				subject: c.subject || '',
				teacher: c.teacher || '',
				location: c.location || '',
				dayOfWeek: Number(c.dayOfWeek) || 1,
				startPeriod: Number(c.startPeriod) || 1,
				endPeriod: Number(c.endPeriod) || 1,
				weeks: Array.isArray(c.weeks) ? c.weeks.slice() : [],
				weekMode: '',
				note: c.note || ''
			}
			this.editingColor = resolveCourseColor(c.subject, c.color)
			this.editing = true
		},
		selectColor(color) {
			this.editingColor = color
		},
		adjustPeriod(which, delta) {
			if (which === 'start') {
				this.form.startPeriod = Math.max(1, Math.min(this.totalPeriods, this.form.startPeriod + delta))
				if (this.form.startPeriod > this.form.endPeriod) {
					this.form.endPeriod = this.form.startPeriod
				}
			} else {
				this.form.endPeriod = Math.max(this.form.startPeriod, Math.min(this.totalPeriods, this.form.endPeriod + delta))
			}
		},
		applyWeekMode(mode) {
			this.form.weekMode = mode
			if (mode === 'all') {
				this.form.weeks = Array.from({ length: this.totalWeeks }, (_, i) => i + 1)
			} else if (mode === 'odd') {
				this.form.weeks = Array.from({ length: this.totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 1)
			} else if (mode === 'even') {
				this.form.weeks = Array.from({ length: this.totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 0)
			}
			// current 模式不动 weeks，保留原值
		},
		toggleWeek(w) {
			const idx = this.form.weeks.indexOf(w)
			if (idx >= 0) {
				this.form.weeks.splice(idx, 1)
			} else {
				this.form.weeks.push(w)
			}
			this.form.weekMode = ''
		},
		formatWeeksText(weeks) {
			const sorted = Array.from(new Set(weeks.map(n => parseInt(n, 10)).filter(n => n > 0))).sort((a, b) => a - b)
			if (!sorted.length) return ''
			const ranges = []
			let start = sorted[0]
			let prev = sorted[0]
			for (let i = 1; i <= sorted.length; i++) {
				const week = sorted[i]
				if (week === prev + 1) {
					prev = week
					continue
				}
				ranges.push(start === prev ? `${start}周` : `${start}-${prev}周`)
				start = week
				prev = week
			}
			return ranges.join(',')
		},
		saveEdit() {
			const subject = `${this.form.subject || ''}`.trim()
			if (!subject) {
				uni.showToast({ title: '请填写课程名', icon: 'none' })
				return
			}
			if (this.form.startPeriod > this.form.endPeriod) {
				uni.showToast({ title: '起始节次不能大于结束节次', icon: 'none' })
				return
			}
			const list = loadCourses()
			const idx = list.findIndex(c => c && c.id === this.courseId)
			if (idx < 0) {
				uni.showToast({ title: '课程不存在', icon: 'none' })
				return
			}
			const sortedWeeks = Array.from(new Set(this.form.weeks.map(n => parseInt(n, 10)).filter(n => n > 0 && n <= this.totalWeeks))).sort((a, b) => a - b)
			const updated = {
				...list[idx],
				subject,
				teacher: `${this.form.teacher || ''}`.trim(),
				location: `${this.form.location || ''}`.trim(),
				dayOfWeek: Number(this.form.dayOfWeek),
				startPeriod: Number(this.form.startPeriod),
				endPeriod: Number(this.form.endPeriod),
				weeks: sortedWeeks.length ? sortedWeeks : list[idx].weeks,
				weekText: sortedWeeks.length ? this.formatWeeksText(sortedWeeks) : (list[idx].weekText || ''),
				jcText: `${this.form.startPeriod}-${this.form.endPeriod}`,
				note: `${this.form.note || ''}`.trim(),
				manual: true
			}
			// 颜色覆盖：按课程名写入颜色映射（若学科名变更则同步迁移）
			const oldSubject = `${list[idx].subject || ''}`.trim()
			if (this.editingColor) {
				if (oldSubject && oldSubject !== subject) {
					setCourseColor(oldSubject, '')
				}
				setCourseColor(subject, this.editingColor)
			}
			list[idx] = updated
			saveCourses(list)
			this.course = { ...updated }
			this.editing = false
			uni.showToast({ title: '已保存', icon: 'success' })
		},
		openDeleteOptions() {
			this.showDeleteOptions = true
		},
		closeDeleteOptions() {
			this.showDeleteOptions = false
		},
		confirmDelete(type) {
			const course = this.course
			if (!course) return
			if (type === 'teacher' && !this.hasTeacher) {
				uni.showToast({ title: '这节课没有老师信息', icon: 'none' })
				return
			}
			const titleMap = {
				single: '删除这节课',
				day: '删除每周这一时段',
				teacher: '删除这个老师'
			}
			const contentMap = {
				single: `确定删除「${course.subject || '这节课'}」吗？`,
				day: `确定删除每一周星期${this.weekDayName(course.dayOfWeek)}第${course.startPeriod}-${course.endPeriod}节同一时段的所有课程吗？`,
				teacher: `确定删除「${course.teacher}」老师的所有课程吗？`
			}
			uni.showModal({
				title: titleMap[type] || '删除课程',
				content: contentMap[type] || '确定删除课程吗？',
				confirmText: '删除',
				confirmColor: '#ef4444',
				success: res => {
					if (!res.confirm) return
					this.applyDelete(type, course)
				}
			})
		},
		applyDelete(type, course) {
			const teacher = `${course.teacher || ''}`.trim()
			const list = loadCourses().filter(item => {
				if (type === 'single') return item.id !== course.id
				if (type === 'day') {
					return !(
						Number(item.dayOfWeek) === Number(course.dayOfWeek) &&
						Number(item.startPeriod) === Number(course.startPeriod) &&
						Number(item.endPeriod) === Number(course.endPeriod)
					)
				}
				if (type === 'teacher') return `${item.teacher || ''}`.trim() !== teacher
				return true
			})
			saveCourses(list)
			this.showDeleteOptions = false
			uni.showToast({ title: '已删除', icon: 'success' })
			setTimeout(() => {
				this.onBack()
			}, 400)
		},
		onBack() {
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack()
			} else {
				uni.switchTab({ url: '/pages/schedule/schedule' })
			}
		}
	}
}
</script>

<style>
.page {
	height: 100vh;
	box-sizing: border-box;
	background: #f4f7fb;
	display: flex;
	flex-direction: column;
}

.custom-nav {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: calc(20rpx + var(--status-bar-height)) 28rpx 20rpx;
	background: #ffffff;
	border-bottom: 2rpx solid #eef2f7;
}

.nav-back {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav-back-icon {
	font-size: 56rpx;
	line-height: 1;
	color: #111827;
	margin-top: -8rpx;
}

.nav-title {
	font-size: 34rpx;
	font-weight: 800;
	color: #111827;
}

.nav-action {
	min-width: 68rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav-action-text {
	font-size: 28rpx;
	font-weight: 700;
	color: #2979ff;
}

.detail-scroll {
	flex: 1;
	min-height: 0;
}

.hero {
	margin: 24rpx;
	padding: 36rpx 32rpx;
	border-radius: 28rpx;
	display: flex;
	flex-direction: column;
	gap: 12rpx;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.12);
}

.hero-subject {
	font-size: 44rpx;
	font-weight: 800;
	color: #ffffff;
	line-height: 1.2;
}

.hero-meta {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.hero-meta-item {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.95);
}

.hero-meta-sep {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.7);
}

.hero-weeks {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.85);
}

.hero-color-bar {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 8rpx;
}

.hero-color-dot {
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	border: 4rpx solid rgba(255, 255, 255, 0.4);
}

.hero-color-dot.active {
	border-color: #ffffff;
	transform: scale(1.15);
}

.info-list {
	margin: 0 24rpx;
	padding: 8rpx 28rpx;
	background: #ffffff;
	border-radius: 24rpx;
}

.info-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	padding: 28rpx 0;
	border-bottom: 2rpx solid #f1f5f9;
}

.info-row:last-child {
	border-bottom: none;
}

.info-label {
	font-size: 28rpx;
	color: #6b7280;
	flex-shrink: 0;
}

.info-value {
	font-size: 28rpx;
	color: #111827;
	font-weight: 600;
	text-align: right;
	max-width: 60%;
}

.form {
	margin: 0 24rpx;
	padding: 12rpx 28rpx 28rpx;
	background: #ffffff;
	border-radius: 24rpx;
}

.form-row {
	display: flex;
	align-items: center;
	padding: 24rpx 0;
	border-bottom: 2rpx solid #f1f5f9;
}

.form-row-block {
	flex-direction: column;
	align-items: stretch;
	gap: 16rpx;
}

.form-label {
	font-size: 28rpx;
	color: #6b7280;
	width: 160rpx;
	flex-shrink: 0;
}

.form-row-block .form-label {
	width: auto;
}

.form-input {
	flex: 1;
	font-size: 30rpx;
	color: #111827;
	text-align: right;
}

.form-textarea {
	width: 100%;
	min-height: 120rpx;
	font-size: 28rpx;
	color: #111827;
	padding: 16rpx;
	box-sizing: border-box;
	background: #f8fafc;
	border-radius: 16rpx;
}

.chip-row {
	flex: 1;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	justify-content: flex-end;
}

.chip {
	min-width: 64rpx;
	height: 64rpx;
	padding: 0 20rpx;
	border-radius: 32rpx;
	background: #f1f5f9;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 26rpx;
	color: #475569;
}

.chip.active {
	background: #2979ff;
	color: #ffffff;
}

.week-mode-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.period-control {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 20rpx;
}

.period-btn {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: #eef4ff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 36rpx;
	color: #2979ff;
	font-weight: 700;
}

.period-value {
	font-size: 30rpx;
	font-weight: 700;
	color: #111827;
	min-width: 140rpx;
	text-align: center;
}

.week-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.week-cell {
	width: calc((100% - 96rpx) / 8);
	height: 64rpx;
	border-radius: 14rpx;
	background: #f1f5f9;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 26rpx;
	color: #475569;
}

.week-cell.active {
	background: #2979ff;
	color: #ffffff;
}

.save-btn {
	margin-top: 32rpx;
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 44rpx;
	background: #2979ff;
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 800;
}

.danger-zone {
	margin: 24rpx;
	padding: 8rpx 28rpx;
	background: #ffffff;
	border-radius: 24rpx;
}

.delete-btn {
	margin: 20rpx 0;
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 44rpx;
	background: #fef2f2;
	color: #ef4444;
	font-size: 30rpx;
	font-weight: 700;
}

.bottom-safe {
	height: calc(40rpx + env(safe-area-inset-bottom));
}

.empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
}

.empty-text {
	font-size: 30rpx;
	color: #6b7280;
}

.empty-btn {
	width: 320rpx;
	height: 80rpx;
	line-height: 80rpx;
	border-radius: 40rpx;
	background: #2979ff;
	color: #ffffff;
	font-size: 28rpx;
	font-weight: 700;
}

.delete-mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	z-index: 1000;
	display: flex;
	align-items: flex-end;
}

.delete-card {
	width: 100%;
	background: #ffffff;
	border-radius: 28rpx 28rpx 0 0;
	padding: 32rpx 28rpx calc(40rpx + env(safe-area-inset-bottom));
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.delete-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
	text-align: center;
}

.delete-subtitle {
	font-size: 26rpx;
	color: #6b7280;
	text-align: center;
	margin-bottom: 8rpx;
}

.delete-option {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 44rpx;
	background: #f1f5f9;
	color: #111827;
	font-size: 30rpx;
	font-weight: 600;
}

.delete-option.danger {
	background: #fef2f2;
	color: #ef4444;
}

.delete-option.cancel {
	background: #f8fafc;
	color: #6b7280;
}

.delete-option[disabled] {
	opacity: 0.4;
}
</style>
