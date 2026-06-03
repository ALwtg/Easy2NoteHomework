<template>
	<view class="page">
		<view
			v-if="appearance.backgroundImage"
			class="page-bg"
			:style="{ backgroundImage: `url('${appearance.backgroundImage}')`, opacity: appearance.backgroundOpacity }"
		></view>
		<view class="custom-nav">
			<view class="nav-left" @click="prevWeek">
				<text class="nav-arrow">‹</text>
			</view>
			<view class="nav-center" @click="showWeekPicker = !showWeekPicker">
				<text class="nav-title">{{ weekTitle }}</text>
				<text class="nav-subtitle">{{ semesterTitle }}</text>
			</view>
			<view class="nav-right" @click="nextWeek">
				<text class="nav-arrow">›</text>
			</view>
		</view>

		<view v-if="showWeekPicker" class="week-picker-mask" @click="showWeekPicker = false">
			<view class="week-picker-card" @click.stop>
				<view class="week-picker-header">
					<text class="week-picker-title">选择周次</text>
					<text class="week-picker-close" @click="showWeekPicker = false">关闭</text>
				</view>
				<scroll-view scroll-y class="week-picker-list">
					<view class="week-picker-grid">
						<view
							v-for="week in totalWeeks"
							:key="week"
							:class="['week-picker-item', selectedWeek === week ? 'active' : '', currentWeek === week ? 'is-now' : '']"
							@click="selectWeek(week)"
						>
							<text class="week-picker-num">{{ week }}</text>
							<text class="week-picker-tag">{{ currentWeek === week ? '本周' : '' }}</text>
						</view>
					</view>
				</scroll-view>
				<view class="week-picker-footer" @click="goToCurrentWeek">
					<text>跳到本周</text>
				</view>
			</view>
		</view>

		<view v-if="!hasCourses" class="empty-state">
			<view class="empty-illu">
				<text class="empty-icon">📅</text>
			</view>
			<text class="empty-title">还没有课表</text>
			<text class="empty-tip">从学校教务系统导入，自动同步本学期所有课程</text>
			<button class="empty-btn" @click="startImport">从教务系统导入</button>
			<text class="empty-help">网页端和 App 端都可打开教务系统导入</text>
		</view>

		<view v-else class="schedule-wrap">
			<view class="schedule-toolbar">
				<view class="toolbar-info">
					<text class="info-count">共 {{ courses.length }} 门课</text>
					<text v-if="meta.importedAt" class="info-time">{{ formatImportTime(meta.importedAt) }} 同步</text>
				</view>
				<view class="toolbar-actions">
					<view
						class="manual-toggle"
						:class="clearManualOnImport ? 'is-on' : ''"
						@click="toggleClearManual"
					>
						<view class="manual-toggle-track">
							<view class="manual-toggle-thumb"></view>
						</view>
						<text class="manual-toggle-label">重新导入清除手动课</text>
					</view>
					<button class="ghost-btn" @click="startImport">重新导入</button>
				</view>
			</view>

			<scroll-view scroll-y class="schedule-scroll">
				<view class="header-row">
					<view class="time-col header-time">
						<text class="header-label">节次</text>
					</view>
					<view
						v-for="(day, index) in weekDays"
						:key="day.label"
						:class="['day-col', day.isToday ? 'is-today' : '']"
					>
						<text class="day-name">{{ day.label }}</text>
						<text class="day-date">{{ day.date }}</text>
					</view>
				</view>

				<view class="grid-body">
					<view class="time-col body-time">
						<view v-for="period in totalPeriods" :key="period" class="time-cell">
							<text class="time-num">{{ period }}</text>
							<text class="time-range">{{ periodTimeText(period) }}</text>
						</view>
					</view>

					<view v-for="(day, dayIndex) in weekDays" :key="`col-${day.label}`" class="day-col body-col">
						<view
							v-for="period in totalPeriods"
							:key="`cell-${dayIndex}-${period}`"
							class="grid-cell"
							@click="onCellTap(dayIndex, period)"
						></view>

						<view
							v-for="course in coursesByDay[dayIndex + 1]"
							:key="course.id + '_' + dayIndex"
							class="course-block"
							:style="getCourseStyle(course)"
							@click.stop="openCourse(course)"
						>
							<text class="course-name">{{ course.subject }}</text>
							<text v-if="course.location" class="course-location">@{{ course.location }}</text>
							<text v-if="course.teacher" class="course-teacher">{{ course.teacher }}</text>
						</view>

						<view
							v-if="pendingSlot && pendingSlot.dayIndex === dayIndex"
							class="pending-block"
							:style="pendingStyle"
							@click.stop
						>
							<view class="pending-actions">
								<view
									:class="['pending-arrow', canExpandUp ? '' : 'is-disabled']"
									@click.stop="expandPendingUp"
								>
									<text class="pending-arrow-text">▲</text>
								</view>
								<view class="pending-add" @click.stop="openAddPanel">
									<text class="pending-add-text">+</text>
								</view>
								<view
									:class="['pending-arrow', canExpandDown ? '' : 'is-disabled']"
									@click.stop="expandPendingDown"
								>
									<text class="pending-arrow-text">▼</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>

		<view v-if="activeCourse" class="course-mask" @click="activeCourse = null">
			<view class="course-card" @click.stop>
				<view class="course-card-head" :style="{ background: resolveColor(activeCourse) }">
					<text class="course-card-title">{{ activeCourse.subject }}</text>
					<text class="course-card-close" @click="activeCourse = null">×</text>
				</view>
				<view class="course-card-body">
					<view class="course-row">
						<text class="course-label">教师</text>
						<text class="course-value">{{ activeCourse.teacher || '未知' }}</text>
					</view>
					<view class="course-row">
						<text class="course-label">教室</text>
						<text class="course-value">{{ activeCourse.location || '未知' }}</text>
					</view>
					<view class="course-row">
						<text class="course-label">星期</text>
						<text class="course-value">星期{{ weekDayName(activeCourse.dayOfWeek) }} 第{{ activeCourse.startPeriod }}-{{ activeCourse.endPeriod }}节</text>
					</view>
					<view class="course-row">
						<text class="course-label">周次</text>
						<text class="course-value">{{ activeCourse.weekText || (activeCourse.weeks.join(',') + '周') }}</text>
					</view>
					<view v-if="activeCourse.note" class="course-row">
						<text class="course-label">备注</text>
						<text class="course-value">{{ activeCourse.note }}</text>
					</view>
				</view>
			</view>
		</view>

		<view v-if="showAddPanel" class="add-mask" @click="closeAddPanel">
			<view class="add-card" @click.stop>
				<view class="add-head">
					<view>
						<text class="add-title">添加课程</text>
						<text class="add-subtitle">{{ pendingSlot ? `周${weekDayName(pendingSlot.dayIndex + 1)} 第${pendingSlot.startPeriod}-${pendingSlot.endPeriod}节` : '' }}</text>
					</view>
					<text class="add-close" @click="closeAddPanel">×</text>
				</view>

				<view class="add-tabs">
					<view
						:class="['add-tab', addPanelMode === 'pick' ? 'active' : '']"
						@click="switchAddMode('pick')"
					>
						<text>选择已有课程</text>
					</view>
					<view
						:class="['add-tab', addPanelMode === 'create' ? 'active' : '']"
						@click="switchAddMode('create')"
					>
						<text>快捷新建</text>
					</view>
				</view>

				<view v-if="addPanelMode === 'pick'" class="add-body">
					<input
						class="add-search"
						type="text"
						v-model="courseSearch"
						placeholder="搜索课程名 / 老师 / 教室"
					/>
					<scroll-view scroll-y class="add-pick-list">
						<view
							v-for="(item, idx) in uniqueCourseOptions"
							:key="`opt-${idx}`"
							class="add-pick-item"
							@click="pickExistingCourse(item)"
						>
							<view class="add-pick-color" :style="{ background: item.color || '#2979ff' }"></view>
							<view class="add-pick-info">
								<text class="add-pick-name">{{ item.subject }}</text>
								<text class="add-pick-meta">
									<text v-if="item.teacher">{{ item.teacher }}</text>
									<text v-if="item.teacher && item.location"> · </text>
									<text v-if="item.location">{{ item.location }}</text>
									<text v-if="!item.teacher && !item.location">仅本周该节次添加</text>
								</text>
							</view>
							<text class="add-pick-arrow">›</text>
						</view>
						<view v-if="uniqueCourseOptions.length === 0" class="add-pick-empty">
							<text>暂无可选课程，去"快捷新建"页吧</text>
						</view>
					</scroll-view>
					<view class="add-pick-tip">
						<text>选择后会按本周该节次新增一节课</text>
					</view>
				</view>

				<view v-else class="add-body">
					<view class="add-form-row">
						<text class="add-form-label">课程名</text>
						<input class="add-form-input" type="text" v-model="createForm.subject" placeholder="必填，例如：高等数学" />
					</view>
					<view class="add-form-row">
						<text class="add-form-label">教师</text>
						<input class="add-form-input" type="text" v-model="createForm.teacher" placeholder="可选" />
					</view>
					<view class="add-form-row">
						<text class="add-form-label">教室</text>
						<input class="add-form-input" type="text" v-model="createForm.location" placeholder="可选" />
					</view>
					<view class="add-form-toggle" @click="createForm.applyAllWeeks = !createForm.applyAllWeeks">
						<view :class="['add-form-checkbox', createForm.applyAllWeeks ? 'checked' : '']">
							<text v-if="createForm.applyAllWeeks" class="add-form-check">✓</text>
						</view>
						<text class="add-form-toggle-text">每周该节次都加上（不勾选则只加本周）</text>
					</view>
					<button class="add-form-submit" @click="submitCreateForm">添加到课表</button>
				</view>
			</view>
		</view>

		<view v-if="showWebImport" class="web-import-mask">
			<view class="web-import-card" @click.stop>
				<view class="web-import-head">
					<view>
						<text class="web-import-title">从教务系统导入</text>
						<text class="web-import-subtitle">登录学校官网后进入个人课表查询，再点击自动抓取</text>
					</view>
					<text class="web-import-close" @click="closeWebImport">×</text>
				</view>
				<view class="web-import-body">
					<!-- #ifdef H5 -->
					<iframe
						ref="schoolFrame"
						class="school-frame"
						:src="webImportUrl"
						@load="webFrameLoaded"
					></iframe>
					<!-- #endif -->
					<view v-if="webImportStatus" class="web-import-status">
						<text>{{ webImportStatus }}</text>
					</view>
					<view v-if="webImportError" class="web-import-error">
						<text>{{ webImportError }}</text>
					</view>
				</view>
				<view class="web-import-actions">
					<button class="web-cancel-btn" @click="reloadWebImport">重载网页</button>
					<button class="web-submit-btn" :disabled="webAutoBusy" @click="runWebAutoImport">
						{{ webAutoBusy ? '抓取中...' : '自动抓取课表' }}
					</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import {
	loadCourses,
	saveCourses,
	loadScheduleMeta,
	loadSemesterStartDate,
	calcCurrentWeek,
	getDateOfWeek,
	buildWeekTable,
	loadPeriodConfig,
	buildPeriodTimes,
	getTotalPeriodCount,
	pickCourseColor,
	loadCourseColorMap,
	resolveCourseColor,
	loadAppearance,
	loadClearManualOnImport,
	saveClearManualOnImport
} from '@/utils/schedule.js'
import { importScheduleFromZf, importScheduleFromText, ZF_LOGIN_URL } from '@/utils/scheduleImporter.js'

const TOTAL_WEEKS = 25
const WEEK_NAMES = ['一', '二', '三', '四', '五', '六', '日']

export default {
	data() {
		const periodConfig = loadPeriodConfig()
		return {
			courses: [],
			meta: {},
			semesterStart: '',
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
			webImportStatus: '',
			webImportError: '',
			webAutoBusy: false,
			// 点击空格子后出现的"待新增"标记
			pendingSlot: null, // { dayIndex(0-6), startPeriod, endPeriod }
			// + 号弹出的"添加课程"面板
			showAddPanel: false,
			addPanelMode: 'pick', // 'pick' | 'create'
			courseSearch: '',
			createForm: {
				subject: '',
				teacher: '',
				location: '',
				applyAllWeeks: true
			},
			// 重新导入时是否清除手动添加的课程
			clearManualOnImport: loadClearManualOnImport()
		}
	},
	computed: {
		hasCourses() {
			return this.courses.length > 0
		},
		coursesByDay() {
			return buildWeekTable(this.courses, this.selectedWeek)
		},
		weekDays() {
			const todayStr = this.formatDate(new Date())
			return WEEK_NAMES.map((name, idx) => {
				const date = getDateOfWeek(this.semesterStart, this.selectedWeek, idx + 1)
				return {
					label: `周${name}`,
					date: this.shortDate(date),
					isToday: !!date && date === todayStr
				}
			})
		},
		weekTitle() {
			return `第 ${this.selectedWeek} 周`
		},
		semesterTitle() {
			if (this.meta && this.meta.xnmc && this.meta.xqmmc) {
				return `${this.meta.xnmc} 学年 第${this.meta.xqmmc}学期`
			}
			if (this.meta && this.meta.xnm && this.meta.xqm) {
				return `${this.meta.xnm}学年 学期${this.meta.xqm}`
			}
			return this.semesterStart ? `开学：${this.semesterStart}` : '尚未设置开学日期'
		},
		// 当前周每个 (day, period) 是否被占用，用于扩展时判断
		occupancyMap() {
			const map = {}
			for (let d = 1; d <= 7; d++) {
				map[d] = {}
				const list = this.coursesByDay[d] || []
				list.forEach(course => {
					for (let p = course.startPeriod; p <= course.endPeriod; p++) {
						map[d][p] = true
					}
				})
			}
			return map
		},
		// + 号弹窗里"已添加的课程"去重列表
		uniqueCourseOptions() {
			const seen = new Map()
			this.courses.forEach(c => {
				const key = `${c.subject}|${c.teacher || ''}|${c.location || ''}`
				if (!seen.has(key)) {
					seen.set(key, {
						subject: c.subject,
						teacher: c.teacher || '',
						location: c.location || '',
						color: c.color
					})
				}
			})
			const kw = `${this.courseSearch || ''}`.trim().toLowerCase()
			const list = Array.from(seen.values())
			if (!kw) return list
			return list.filter(item => {
				return (
					item.subject.toLowerCase().includes(kw) ||
					(item.teacher || '').toLowerCase().includes(kw) ||
					(item.location || '').toLowerCase().includes(kw)
				)
			})
		},
		// 待新增区段的悬浮按钮位置（按 day 列内 absolute 定位）
		pendingStyle() {
			if (!this.pendingSlot) return ''
			const top = (this.pendingSlot.startPeriod - 1) * 110
			const span = this.pendingSlot.endPeriod - this.pendingSlot.startPeriod + 1
			const height = span * 110 - 8
			return `top:${top}rpx;height:${height}rpx;`
		},
		canExpandUp() {
			if (!this.pendingSlot) return false
			const { dayIndex, startPeriod } = this.pendingSlot
			if (startPeriod <= 1) return false
			const day = dayIndex + 1
			return !this.occupancyMap[day][startPeriod - 1]
		},
		canExpandDown() {
			if (!this.pendingSlot) return false
			const { dayIndex, endPeriod } = this.pendingSlot
			if (endPeriod >= this.totalPeriods) return false
			const day = dayIndex + 1
			return !this.occupancyMap[day][endPeriod + 1]
		}
	},
	onShow() {
		this.refresh()
	},
	mounted() {
		// #ifdef H5
		window.addEventListener('message', this.handleWebImportMessage)
		// #endif
	},
	beforeUnmount() {
		// #ifdef H5
		window.removeEventListener('message', this.handleWebImportMessage)
		// #endif
	},
	onBackPress(options) {
		// 周次选择 / 课程详情 / 教务导入弹层弹出时，优先关闭弹层
		if (this.showAddPanel) {
			this.closeAddPanel()
			return true
		}
		if (this.pendingSlot) {
			this.pendingSlot = null
			return true
		}
		if (this.showWeekPicker) {
			this.showWeekPicker = false
			return true
		}
		if (this.activeCourse) {
			this.activeCourse = null
			return true
		}
		if (this.showWebImport) {
			this.closeWebImport()
			return true
		}
		// 课表页是 tabBar 页面，没有上一页可返回，物理返回会直接退出 App
		// 这里改为切回首页，与用户预期一致
		if (options && options.from === 'backbutton') {
			uni.switchTab({ url: '/pages/record/record' })
			return true
		}
		return false
	},
	methods: {
		refresh() {
			this.courses = loadCourses()
			this.meta = loadScheduleMeta()
			this.semesterStart = loadSemesterStartDate()
			this.periodConfig = loadPeriodConfig()
			this.periodTimes = buildPeriodTimes(this.periodConfig)
			this.totalPeriods = getTotalPeriodCount(this.periodConfig)
			this.courseColorMap = loadCourseColorMap()
			this.appearance = loadAppearance()
			this.clearManualOnImport = loadClearManualOnImport()
			this.currentWeek = calcCurrentWeek(this.semesterStart)
			if (!this.selectedWeek || this.selectedWeek < 1 || this.selectedWeek > this.totalWeeks) {
				this.selectedWeek = this.currentWeek
			}
			if (this.semesterStart && this.selectedWeek === 1 && this.currentWeek > 1) {
				this.selectedWeek = this.currentWeek
			}
		},
		toggleClearManual() {
			const next = !this.clearManualOnImport
			this.clearManualOnImport = next
			saveClearManualOnImport(next)
			uni.showToast({
				title: next ? '已开启：重新导入会清除手动课' : '已关闭：手动课会保留',
				icon: 'none'
			})
		},
		periodTimeText(period) {
			const time = this.periodTimes[period - 1]
			if (!time) return ''
			return `${time.start}\n${time.end}`
		},
		getCourseStyle(course) {
			const span = course.endPeriod - course.startPeriod + 1
			const top = (course.startPeriod - 1) * 110
			const height = span * 110 - 8
			const color = resolveCourseColor(course.subject, course.color, this.courseColorMap)
			const opacity = this.appearance.cardOpacity
			return `top:${top}rpx;height:${height}rpx;background:${color};opacity:${opacity};`
		},
		resolveColor(course) {
			if (!course) return ''
			return resolveCourseColor(course.subject, course.color, this.courseColorMap)
		},
		openCourse(course) {
			this.activeCourse = course
		},
		// 点击空白格子：先判断是否真的为空，再设置/取消"待新增"标记
		onCellTap(dayIndex, period) {
			const day = dayIndex + 1
			if (this.occupancyMap[day] && this.occupancyMap[day][period]) return
			// 再点同一格：收起浮层
			if (
				this.pendingSlot &&
				this.pendingSlot.dayIndex === dayIndex &&
				period >= this.pendingSlot.startPeriod &&
				period <= this.pendingSlot.endPeriod
			) {
				this.pendingSlot = null
				return
			}
			this.pendingSlot = { dayIndex, startPeriod: period, endPeriod: period }
		},
		expandPendingUp() {
			if (!this.canExpandUp) return
			this.pendingSlot = {
				...this.pendingSlot,
				startPeriod: this.pendingSlot.startPeriod - 1
			}
		},
		expandPendingDown() {
			if (!this.canExpandDown) return
			this.pendingSlot = {
				...this.pendingSlot,
				endPeriod: this.pendingSlot.endPeriod + 1
			}
		},
		closePending() {
			this.pendingSlot = null
		},
		openAddPanel() {
			if (!this.pendingSlot) return
			this.addPanelMode = 'pick'
			this.courseSearch = ''
			this.createForm = { subject: '', teacher: '', location: '', applyAllWeeks: true }
			this.showAddPanel = true
		},
		closeAddPanel() {
			this.showAddPanel = false
		},
		switchAddMode(mode) {
			this.addPanelMode = mode
		},
		// 选择"已有课程"作为模板新增
		pickExistingCourse(item) {
			this.commitNewCourse({
				subject: item.subject,
				teacher: item.teacher,
				location: item.location,
				color: item.color || pickCourseColor(item.subject),
				applyAllWeeks: false
			})
		},
		// 提交"快捷新建"
		submitCreateForm() {
			const subject = `${this.createForm.subject || ''}`.trim()
			if (!subject) {
				uni.showToast({ title: '请输入课程名称', icon: 'none' })
				return
			}
			this.commitNewCourse({
				subject,
				teacher: `${this.createForm.teacher || ''}`.trim(),
				location: `${this.createForm.location || ''}`.trim(),
				color: pickCourseColor(subject),
				applyAllWeeks: !!this.createForm.applyAllWeeks
			})
		},
		commitNewCourse({ subject, teacher, location, color, applyAllWeeks }) {
			if (!this.pendingSlot) return
			const { dayIndex, startPeriod, endPeriod } = this.pendingSlot
			const dayOfWeek = dayIndex + 1
			const weeks = applyAllWeeks
				? Array.from({ length: this.totalWeeks }, (_, i) => i + 1)
				: [this.selectedWeek]
			const weekText = applyAllWeeks
				? `1-${this.totalWeeks}周`
				: `${this.selectedWeek}周`
			const id = `manual_${Date.now()}_${dayOfWeek}_${startPeriod}`
			const newCourse = {
				id,
				subject,
				teacher: teacher || '',
				location: location || '',
				dayOfWeek,
				startPeriod,
				endPeriod,
				weeks,
				weekText,
				jcText: `${startPeriod}-${endPeriod}`,
				note: '',
				color: color || pickCourseColor(subject),
				manual: true
			}
			const list = loadCourses()
			list.push(newCourse)
			saveCourses(list)
			this.courses = list
			this.showAddPanel = false
			this.pendingSlot = null
			uni.showToast({ title: '已添加', icon: 'success' })
		},
		prevWeek() {
			if (this.selectedWeek > 1) this.selectedWeek -= 1
		},
		nextWeek() {
			if (this.selectedWeek < this.totalWeeks) this.selectedWeek += 1
		},
		selectWeek(week) {
			this.selectedWeek = week
			this.showWeekPicker = false
		},
		goToCurrentWeek() {
			this.selectedWeek = this.currentWeek
			this.showWeekPicker = false
		},
		startImport() {
			// #ifdef H5
			this.webImportError = ''
			this.webImportStatus = '请在内嵌网页中登录，并进入"个人课表查询"页面。'
			this.showWebImport = true
			return
			// #endif

			// #ifndef APP-PLUS
			// #ifndef H5
			uni.showModal({
				title: '提示',
				content: '当前平台暂不支持自动导入，请在网页端或 Android App 中使用。',
				showCancel: false
			})
			return
			// #endif
			// #endif

			// #ifdef APP-PLUS
			if (!this.semesterStart) {
				uni.showModal({
					title: '请先设置开学日期',
					content: '设置开学日期后再导入课表，便于按周次查看。是否前往"设置"？',
					confirmText: '去设置',
					success: res => {
						if (res.confirm) {
							uni.switchTab({ url: '/pages/settings/settings' })
						}
					}
				})
				return
			}

			uni.showModal({
				title: '从教务系统导入',
				content: '将打开学校教务网站，请登录并进入"个人课表查询"，再点击底部"提取课表"按钮。',
				confirmText: '继续',
				success: res => {
					if (!res.confirm) return
					importScheduleFromZf({
						onSuccess: result => {
							this.refresh()
							uni.showToast({ title: `成功导入 ${result.courses.length} 门课程`, icon: 'success' })
						},
						onError: err => {
							console.warn('课表导入失败：', err)
						},
						onCancel: () => {}
					})
				}
			})
			// #endif
		},
		closeWebImport() {
			this.showWebImport = false
			this.webAutoBusy = false
		},
		reloadWebImport() {
			// #ifdef H5
			this.webImportError = ''
			this.webImportStatus = '网页已重新载入，请登录学校官网后进入"个人课表查询"。'
			this.webImportUrl = ''
			this.$nextTick(() => {
				this.webImportUrl = ZF_LOGIN_URL
			})
			// #endif
		},
		webFrameLoaded() {
			this.webImportStatus = '页面已载入。登录并进入"个人课表查询"后，点击"自动抓取课表"。'
		},
		runWebAutoImport() {
			// #ifdef H5
			this.webAutoBusy = true
			this.webImportError = ''
			this.webImportStatus = '正在尝试读取教务系统课表...'

			let frameWindow = null
			try {
				const frame = this.$refs.schoolFrame
				frameWindow = frame && frame.contentWindow
			} catch (e) {}

			if (!frameWindow) {
				this.webAutoBusy = false
				this.webImportStatus = ''
				this.webImportError = '未能读取内嵌网页，请点击重载网页后重试。'
				return
			}

			try {
				const frameDoc = frameWindow.document
				const xnmEl = frameDoc.getElementById('xnm')
				const xqmEl = frameDoc.getElementById('xqm')
				const xnm = xnmEl && xnmEl.value
				const xqm = xqmEl && xqmEl.value
				if (!xnm || !xqm) {
					throw new Error('请先在内嵌网页中进入"个人课表查询"，并选择学年学期。')
				}

				frameWindow.fetch('/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
					credentials: 'include',
					body: `xnm=${encodeURIComponent(xnm)}&xqm=${encodeURIComponent(xqm)}&kblx=1`
				})
					.then(res => res.text())
					.then(text => {
						const result = importScheduleFromText(text)
						this.webAutoBusy = false
						this.webImportStatus = ''
						this.webImportError = ''
						this.showWebImport = false
						this.refresh()
						uni.showToast({ title: `成功导入 ${result.courses.length} 门课程`, icon: 'success' })
					})
					.catch(err => {
						this.webAutoBusy = false
						this.webImportStatus = ''
						this.webImportError = (err && err.message) || '课表接口读取失败，请确认已进入个人课表查询页。'
					})
			} catch (e) {
				this.webAutoBusy = false
				this.webImportStatus = ''
				this.webImportError = (e && e.message) || '浏览器阻止读取内嵌网页，请在 App 端使用自动导入。'
			}
			// #endif
		},
		handleWebImportMessage(event) {
			if (!event || !event.data || event.data.type !== 'schedule-import-data') return
			try {
				const result = importScheduleFromText(event.data.payload)
				this.showWebImport = false
				this.refresh()
				uni.showToast({ title: `成功导入 ${result.courses.length} 门课程`, icon: 'success' })
			} catch (e) {
				uni.showModal({
					title: '导入失败',
					content: (e && e.message) || '课表数据解析失败',
					showCancel: false
				})
			}
		},
		formatImportTime(value) {
			if (!value) return ''
			const date = new Date(value)
			if (Number.isNaN(date.getTime())) return ''
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			const h = `${date.getHours()}`.padStart(2, '0')
			const min = `${date.getMinutes()}`.padStart(2, '0')
			return `${m}-${d} ${h}:${min}`
		},
		formatDate(date) {
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			return `${y}-${m}-${d}`
		},
		shortDate(value) {
			if (!value) return ''
			const parts = value.split('-')
			if (parts.length !== 3) return value
			return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
		},
		weekDayName(num) {
			return WEEK_NAMES[(num - 1) % 7]
		}
	}
}
</script>

<style>
.page {
	min-height: 100vh;
	padding-bottom: 120rpx;
	box-sizing: border-box;
	background: #f4f7fb;
	position: relative;
}

.page-bg {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	z-index: 0;
	pointer-events: none;
}

.custom-nav,
.schedule-wrap,
.empty-state,
.week-picker-mask,
.course-mask,
.web-import-mask,
.add-mask,
.add-panel {
	position: relative;
	z-index: 1;
}

.custom-nav {
	display: flex;
	align-items: center;
	gap: 12rpx;
	padding: 72rpx 24rpx 28rpx;
	background: linear-gradient(180deg, #2979ff 0%, #4f8bff 100%);
	color: #ffffff;
}

.nav-left,
.nav-right {
	width: 80rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
}

.nav-arrow {
	font-size: 44rpx;
	font-weight: 700;
	line-height: 44rpx;
	color: #ffffff;
}

.nav-center {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4rpx;
}

.nav-title {
	font-size: 34rpx;
	font-weight: 800;
	color: #ffffff;
}

.nav-subtitle {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.78);
}

.week-picker-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 80;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 60rpx 36rpx;
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.42);
}

.week-picker-card {
	width: 100%;
	max-height: 70vh;
	display: flex;
	flex-direction: column;
	border-radius: 28rpx;
	background: #ffffff;
	overflow: hidden;
}

.week-picker-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 32rpx 12rpx;
}

.week-picker-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.week-picker-close {
	font-size: 26rpx;
	color: #6b7280;
}

.week-picker-list {
	max-height: 50vh;
	padding: 12rpx 24rpx 0;
}

.week-picker-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	padding-bottom: 24rpx;
}

.week-picker-item {
	width: calc(20% - 16rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 18rpx 0 14rpx;
	border-radius: 18rpx;
	background: #f3f4f6;
	color: #1f2937;
}

.week-picker-item.active {
	background: #2979ff;
	color: #ffffff;
}

.week-picker-item.is-now {
	border: 3rpx solid #f97316;
}

.week-picker-num {
	font-size: 28rpx;
	font-weight: 800;
}

.week-picker-tag {
	margin-top: 4rpx;
	font-size: 20rpx;
	color: #f97316;
}

.week-picker-item.active .week-picker-tag {
	color: #fde68a;
}

.week-picker-footer {
	padding: 24rpx;
	text-align: center;
	font-size: 28rpx;
	font-weight: 800;
	color: #2979ff;
	border-top: 2rpx solid #f1f5f9;
}

.empty-state {
	margin: 80rpx 32rpx 0;
	padding: 60rpx 30rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 18rpx;
	border-radius: 28rpx;
	background: #ffffff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.empty-illu {
	width: 160rpx;
	height: 160rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: linear-gradient(135deg, #eef2ff, #dbeafe);
}

.empty-icon {
	font-size: 96rpx;
}

.empty-title {
	font-size: 36rpx;
	font-weight: 800;
	color: #111827;
}

.empty-tip {
	font-size: 26rpx;
	line-height: 1.5;
	color: #6b7280;
	text-align: center;
}

.empty-btn {
	margin-top: 14rpx;
	width: 100%;
	max-width: 480rpx;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 999rpx;
	background: #2979ff;
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 800;
}

.empty-help {
	font-size: 22rpx;
	color: #9ca3af;
}

.schedule-wrap {
	display: flex;
	flex-direction: column;
	min-height: calc(100vh - 240rpx);
}

.schedule-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 18rpx 28rpx;
	background: #ffffff;
}

.toolbar-info {
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.info-count {
	font-size: 26rpx;
	font-weight: 800;
	color: #111827;
}

.info-time {
	font-size: 22rpx;
	color: #9ca3af;
}

.toolbar-actions {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.manual-toggle {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.manual-toggle-track {
	position: relative;
	width: 60rpx;
	height: 32rpx;
	border-radius: 999rpx;
	background: #d1d5db;
	transition: background 0.18s ease;
}

.manual-toggle-thumb {
	position: absolute;
	top: 3rpx;
	left: 3rpx;
	width: 26rpx;
	height: 26rpx;
	border-radius: 50%;
	background: #ffffff;
	box-shadow: 0 2rpx 4rpx rgba(15, 23, 42, 0.18);
	transition: left 0.18s ease;
}

.manual-toggle.is-on .manual-toggle-track {
	background: #2979ff;
}

.manual-toggle.is-on .manual-toggle-thumb {
	left: 31rpx;
}

.manual-toggle-label {
	font-size: 22rpx;
	color: #6b7280;
	max-width: 200rpx;
	line-height: 1.3;
}

.ghost-btn {
	margin: 0;
	padding: 0 24rpx;
	height: 60rpx;
	line-height: 60rpx;
	font-size: 24rpx;
	color: #2979ff;
	background: #eef4ff;
	border-radius: 999rpx;
}

.schedule-scroll {
	flex: 1;
	height: calc(100vh - 360rpx);
	background: #ffffff;
}

.header-row {
	display: flex;
	position: sticky;
	top: 0;
	z-index: 5;
	background: #ffffff;
	border-bottom: 2rpx solid #eef2f7;
}

.time-col {
	width: 80rpx;
	flex-shrink: 0;
}

.header-time {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 14rpx 0;
}

.header-label {
	font-size: 22rpx;
	color: #6b7280;
}

.day-col {
	flex: 1;
	padding: 14rpx 4rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4rpx;
	min-width: 0;
}

.day-name {
	font-size: 24rpx;
	font-weight: 800;
	color: #111827;
}

.day-date {
	font-size: 20rpx;
	color: #9ca3af;
}

.day-col.is-today .day-name {
	color: #2979ff;
}

.day-col.is-today .day-date {
	color: #2979ff;
}

.grid-body {
	display: flex;
	position: relative;
	min-height: 1210rpx;
}

.body-time {
	display: flex;
	flex-direction: column;
}

.time-cell {
	height: 110rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
	border-bottom: 2rpx dashed #eef2f7;
}

.time-num {
	font-size: 22rpx;
	font-weight: 800;
	color: #1f2937;
}

.time-range {
	font-size: 18rpx;
	line-height: 22rpx;
	color: #9ca3af;
	white-space: pre-line;
	text-align: center;
}

.body-col {
	position: relative;
	border-left: 2rpx solid #f1f5f9;
}

.grid-cell {
	height: 110rpx;
	border-bottom: 2rpx dashed #eef2f7;
}

.course-block {
	position: absolute;
	left: 6rpx;
	right: 6rpx;
	padding: 12rpx 10rpx;
	border-radius: 16rpx;
	color: #ffffff;
	box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.12);
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	overflow: hidden;
}

.pending-block {
	position: absolute;
	left: 6rpx;
	right: 6rpx;
	z-index: 6;
	border-radius: 16rpx;
	border: 3rpx dashed #2979ff;
	background: rgba(41, 121, 255, 0.12);
}

.pending-actions {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6rpx;
	z-index: 7;
}

.pending-arrow {
	width: 56rpx;
	height: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	background: rgba(255, 255, 255, 0.96);
	color: #2979ff;
	box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.12);
}

.pending-arrow.is-disabled {
	color: #cbd5f5;
	background: rgba(255, 255, 255, 0.6);
}

.pending-arrow-text {
	font-size: 22rpx;
	line-height: 22rpx;
	font-weight: 700;
}

.pending-add {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: #2979ff;
	box-shadow: 0 6rpx 14rpx rgba(41, 121, 255, 0.4);
}

.pending-add-text {
	font-size: 40rpx;
	line-height: 40rpx;
	color: #ffffff;
	font-weight: 800;
}

.course-name {
	font-size: 22rpx;
	font-weight: 800;
	line-height: 28rpx;
	color: #ffffff;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.course-location,
.course-teacher {
	font-size: 18rpx;
	line-height: 22rpx;
	color: rgba(255, 255, 255, 0.86);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.course-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 90;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 60rpx 32rpx;
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.45);
}

.course-card {
	width: 100%;
	border-radius: 28rpx;
	background: #ffffff;
	overflow: hidden;
}

.course-card-head {
	position: relative;
	padding: 28rpx 32rpx;
	color: #ffffff;
}

.course-card-title {
	display: block;
	padding-right: 60rpx;
	font-size: 34rpx;
	font-weight: 800;
	color: #ffffff;
}

.course-card-close {
	position: absolute;
	right: 18rpx;
	top: 12rpx;
	font-size: 50rpx;
	color: rgba(255, 255, 255, 0.92);
	line-height: 50rpx;
}

.course-card-body {
	padding: 22rpx 32rpx 32rpx;
}

.course-row {
	display: flex;
	align-items: flex-start;
	gap: 18rpx;
	padding: 14rpx 0;
	border-bottom: 1rpx solid #f1f5f9;
}

.course-row:last-child {
	border-bottom: 0;
}

.course-label {
	width: 110rpx;
	font-size: 26rpx;
	font-weight: 700;
	color: #6b7280;
	flex-shrink: 0;
}

.course-value {
	flex: 1;
	font-size: 26rpx;
	color: #111827;
	word-break: break-all;
}
.web-import-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40rpx 28rpx;
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.48);
}

.web-import-card {
	width: 100%;
	max-height: 86vh;
	display: flex;
	flex-direction: column;
	border-radius: 28rpx;
	background: #ffffff;
	overflow: hidden;
}

.web-import-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	padding: 28rpx 32rpx 20rpx;
	border-bottom: 1rpx solid #eef2f7;
}

.web-import-title {
	display: block;
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.web-import-subtitle {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #6b7280;
}

.web-import-close {
	font-size: 48rpx;
	line-height: 48rpx;
	color: #9ca3af;
}

.web-import-body {
	padding: 18rpx 24rpx;
	display: flex;
	flex-direction: column;
	gap: 14rpx;
	min-height: 0;
	flex: 1;
}

.school-frame {
	width: 100%;
	height: 60vh;
	border: 0;
	border-radius: 18rpx;
	background: #f8fafc;
}

.web-import-status,
.web-import-error {
	padding: 14rpx 18rpx;
	border-radius: 14rpx;
	font-size: 24rpx;
	line-height: 1.5;
}

.web-import-status {
	color: #1d4ed8;
	background: #eff6ff;
}

.web-import-error {
	color: #b91c1c;
	background: #fef2f2;
}

.web-import-actions {
	display: flex;
	gap: 18rpx;
	padding: 20rpx 32rpx 30rpx;
	border-top: 1rpx solid #eef2f7;
}

.web-cancel-btn,
.web-submit-btn {
	flex: 1;
	margin: 0;
	height: 76rpx;
	line-height: 76rpx;
	border-radius: 999rpx;
	font-size: 26rpx;
	font-weight: 800;
}

.web-cancel-btn {
	color: #4b5563;
	background: #f3f4f6;
}

.web-submit-btn {
	color: #ffffff;
	background: #2979ff;
}

.add-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 95;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	background: rgba(15, 23, 42, 0.45);
}

.add-card {
	width: 100%;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	background: #ffffff;
	border-top-left-radius: 32rpx;
	border-top-right-radius: 32rpx;
	overflow: hidden;
}

.add-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	padding: 28rpx 32rpx 14rpx;
}

.add-title {
	display: block;
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.add-subtitle {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #6b7280;
}

.add-close {
	font-size: 48rpx;
	line-height: 48rpx;
	color: #9ca3af;
}

.add-tabs {
	display: flex;
	gap: 14rpx;
	padding: 4rpx 32rpx 18rpx;
}

.add-tab {
	flex: 1;
	padding: 16rpx 0;
	text-align: center;
	border-radius: 999rpx;
	background: #f3f4f6;
	color: #4b5563;
	font-size: 26rpx;
	font-weight: 700;
}

.add-tab.active {
	background: #2979ff;
	color: #ffffff;
}

.add-body {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
	padding: 6rpx 32rpx 32rpx;
	min-height: 0;
}

.add-search {
	width: 100%;
	box-sizing: border-box;
	padding: 16rpx 22rpx;
	border-radius: 16rpx;
	background: #f3f4f6;
	font-size: 26rpx;
	color: #111827;
}

.add-pick-list {
	max-height: 50vh;
	border-radius: 18rpx;
	background: #f8fafc;
}

.add-pick-item {
	display: flex;
	align-items: center;
	gap: 18rpx;
	padding: 20rpx 22rpx;
	border-bottom: 1rpx solid #eef2f7;
}

.add-pick-item:last-child {
	border-bottom: 0;
}

.add-pick-color {
	width: 12rpx;
	height: 56rpx;
	border-radius: 6rpx;
	flex-shrink: 0;
}

.add-pick-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4rpx;
	min-width: 0;
}

.add-pick-name {
	font-size: 28rpx;
	font-weight: 700;
	color: #111827;
}

.add-pick-meta {
	font-size: 22rpx;
	color: #6b7280;
}

.add-pick-arrow {
	font-size: 36rpx;
	color: #9ca3af;
	line-height: 36rpx;
}

.add-pick-empty {
	padding: 40rpx 24rpx;
	text-align: center;
	font-size: 24rpx;
	color: #9ca3af;
}

.add-pick-tip {
	font-size: 22rpx;
	color: #9ca3af;
	text-align: center;
}

.add-form-row {
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 8rpx 0;
}

.add-form-label {
	width: 110rpx;
	font-size: 26rpx;
	font-weight: 700;
	color: #4b5563;
	flex-shrink: 0;
}

.add-form-input {
	flex: 1;
	padding: 16rpx 22rpx;
	border-radius: 16rpx;
	background: #f3f4f6;
	font-size: 26rpx;
	color: #111827;
}

.add-form-toggle {
	display: flex;
	align-items: center;
	gap: 14rpx;
	padding: 6rpx 0 4rpx;
}

.add-form-checkbox {
	width: 36rpx;
	height: 36rpx;
	border-radius: 8rpx;
	border: 2rpx solid #cbd5f5;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #ffffff;
}

.add-form-checkbox.checked {
	background: #2979ff;
	border-color: #2979ff;
}

.add-form-check {
	font-size: 24rpx;
	color: #ffffff;
	line-height: 24rpx;
	font-weight: 800;
}

.add-form-toggle-text {
	font-size: 24rpx;
	color: #4b5563;
}

.add-form-submit {
	margin: 6rpx 0 0;
	width: 100%;
	height: 84rpx;
	line-height: 84rpx;
	border-radius: 999rpx;
	background: #2979ff;
	color: #ffffff;
	font-size: 28rpx;
	font-weight: 800;
}

</style>
