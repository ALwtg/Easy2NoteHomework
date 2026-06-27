<template>
	<view class="page" :style="kbStyle">
		<view
			v-if="appearance.backgroundImage"
			class="page-bg"
			:style="{ backgroundImage: `url('${appearance.backgroundImage}')`, opacity: appearance.backgroundOpacity }"
		></view>
		<view class="custom-nav">
			<view class="nav-info" @click="showWeekPicker = !showWeekPicker">
				<text class="nav-title">{{ weekTitle }}</text>
				<text class="nav-subtitle">{{ semesterTitle }}</text>
			</view>
			<view v-if="hasCourses" class="nav-meta">
				<text class="meta-count">共 {{ courses.length }} 门课</text>
				<text v-if="meta.importedAt" class="meta-time">{{ formatImportTime(meta.importedAt) }} 同步</text>
			</view>
			<view v-if="hasCourses" class="nav-actions">
				<view class="nav-btn" @click.stop="toggleShareMenu">
					<text class="nav-btn-text">分享</text>
				</view>
				<view class="nav-btn" @click.stop="toggleImportMenu">
					<text class="nav-btn-text">导入</text>
				</view>
			</view>
		</view>

		<view v-if="showShareMenu || showImportMenu" class="menu-mask" @click="closeMenus">
			<view v-if="showShareMenu" class="menu-card share-menu" @click.stop>
				<text class="menu-title">分享课表</text>
				<button class="menu-item-btn" open-type="share" @click="onWxShareTap">
					<text class="menu-item-title">微信分享</text>
					<text class="menu-item-desc">直接发送给微信好友或群</text>
				</button>
				<view class="menu-item" @click="shareByClipboard">
					<text class="menu-item-title">复制到剪切板</text>
					<text class="menu-item-desc">把分享码复制到聊天框粘贴</text>
				</view>
				<view class="menu-item" @click="shareByFile">
					<text class="menu-item-title">导出为文件</text>
					<text class="menu-item-desc">调用系统分享菜单选择应用发送</text>
				</view>

			</view>
			<view v-if="showImportMenu" class="menu-card import-menu" @click.stop>
				<text class="menu-title">导入课表</text>
				<view class="menu-item" @click="importFromClipboard(false)">
					<text class="menu-item-title">从剪切板识别</text>
					<text class="menu-item-desc">读取剪切板中的分享码</text>
				</view>
				<view class="menu-item" @click="openPasteImport">
					<text class="menu-item-title">粘贴分享文字</text>
					<text class="menu-item-desc">手动粘贴分享内容导入</text>
				</view>
				<view class="menu-item" @click="importFromFile">
					<text class="menu-item-title">从文件读取</text>
					<text class="menu-item-desc">选择 .txt / .json 分享文件</text>
				</view>

				<view class="menu-item" @click="startImport">
					<text class="menu-item-title">从教务系统抓取</text>
					<text class="menu-item-desc">登录学校官网自动同步课表</text>
				</view>
			</view>
		</view>

		<view v-if="showPasteImport" class="paste-mask" @click="closePasteImport">
			<view class="paste-card" @click.stop>
				<view class="paste-head">
					<text class="paste-title">粘贴课表分享文字</text>
					<text class="paste-close" @click="closePasteImport">×</text>
				</view>
				<textarea
					class="paste-textarea"
					v-model="pasteImportText"
					placeholder="将好友发来的分享码或分享文字粘贴到这里"
					maxlength="200000"
				/>
				<view class="paste-actions">
					<button class="paste-ghost-btn" @click="pastePasteText">从剪切板填入</button>
					<button class="paste-primary-btn" @click="submitPasteImport">导入课表</button>
				</view>
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
			<text class="empty-tip">从学校教务系统导入，或导入好友分享的课表</text>
			<button class="empty-btn" @click="toggleImportMenu">导入课表</button>
			<text class="empty-help">支持教务系统抓取、剪切板、粘贴文字、文件读取</text>
		</view>

		<view v-else class="schedule-wrap">
			<view class="swipe-viewport">
				<view
					class="swipe-track"
					:style="trackStyle"
					@touchstart="onSwipeStart"
					@touchmove="onSwipeMove"
					@touchend="onSwipeEnd"
					@touchcancel="onSwipeEnd"
				>
					<view
						v-for="(p, pIdx) in swipePages"
						:key="`page-${pIdx}-${p.week}`"
						class="swipe-page"
						:style="pageStyle"
					>
						<template v-if="!p.isPlaceholder">
							<view class="header-row">
								<view class="time-col header-time">
									<text class="header-label">节次</text>
								</view>
								<view
									v-for="(day, dIdx) in p.weekDays"
									:key="`hd-${pIdx}-${day.label}`"
									:class="['day-col', day.isToday ? 'is-today' : '']"
								>
									<text class="day-name">{{ day.label }}</text>
									<text class="day-date">{{ day.date }}</text>
								</view>
							</view>
							<scroll-view scroll-y class="schedule-scroll">
								<view class="grid-body">
									<view class="time-col body-time">
										<view v-for="period in totalPeriods" :key="`time-${pIdx}-${period}`" class="time-cell">
											<text class="time-num">{{ period }}</text>
											<text class="time-range">{{ periodTimeText(period) }}</text>
										</view>
									</view>

									<view
										v-for="(day, dIdx) in p.weekDays"
										:key="`col-${pIdx}-${day.label}`"
										class="day-col body-col"
									>
									<view
										v-for="period in totalPeriods"
										:key="`cell-${pIdx}-${dIdx}-${period}`"
										:class="['grid-cell', period === totalPeriods ? 'is-last' : '']"
										@click="p.isCurrent && onCellTap(dIdx, period)"
									></view>

										<view
											v-for="course in p.coursesByDay[dIdx + 1]"
											:key="course.id + '_' + pIdx + '_' + dIdx"
											:class="['course-block', courseDragClass(course)]"
											:style="getCourseStyle(course)"
											@click.stop="p.isCurrent && onCourseClick(course)"
											@touchstart.stop="p.isCurrent && onCourseTouchStart(course, dIdx, $event)"
											@touchmove.stop="p.isCurrent && onCourseTouchMove($event)"
											@touchend.stop="p.isCurrent && onCourseTouchEnd($event)"
											@touchcancel.stop="p.isCurrent && onCourseTouchEnd($event)"
										>
											<text class="course-name">{{ course.subject }}</text>
											<template v-if="course.endPeriod - course.startPeriod + 1 >= 2">
												<text v-if="course.location" class="course-location">{{ course.location }}</text>
												<text v-if="course.teacher" class="course-teacher">{{ course.teacher }}</text>
											</template>
										</view>

										<view
											v-if="p.isCurrent && pendingSlot && pendingSlot.dayIndex === dIdx"
											class="pending-block"
											:style="pendingStyle"
											@click.stop="openAddPanel"
										>
											<view
												class="pending-handle pending-handle-top"
												@click.stop
												@touchstart.stop.prevent="onPendingDragStart('top', $event)"
												@touchmove.stop.prevent="onPendingDragMove($event)"
												@touchend.stop.prevent="onPendingDragEnd($event)"
												@touchcancel.stop.prevent="onPendingDragEnd($event)"
											>
												<view class="pending-handle-bar"></view>
											</view>
											<view class="pending-add" @click.stop="openAddPanel">
												<text class="pending-add-text">+</text>
											</view>
											<view
												class="pending-handle pending-handle-bottom"
												@click.stop
												@touchstart.stop.prevent="onPendingDragStart('bottom', $event)"
												@touchmove.stop.prevent="onPendingDragMove($event)"
												@touchend.stop.prevent="onPendingDragEnd($event)"
												@touchcancel.stop.prevent="onPendingDragEnd($event)"
											>
												<view class="pending-handle-bar"></view>
											</view>
										</view>
									</view>
								</view>
							</scroll-view>
						</template>
					</view>
				</view>
			</view>
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
					<button class="course-delete-btn" @click="openDeleteOptions">删除</button>
				</view>
			</view>
		</view>

		<view v-if="showDeleteOptions && activeCourse" class="delete-options-mask" @click="closeDeleteOptions">
			<view class="delete-options-card" @click.stop>
				<text class="delete-options-title">选择删除范围</text>
				<text class="delete-options-subtitle">{{ activeCourse.subject || '这节课' }}</text>
				<button class="delete-option-btn danger" @click="confirmDeleteCourse('single')">删除这节课</button>
				<button class="delete-option-btn" @click="confirmDeleteCourse('day')">删除每一周这一天的课</button>
				<button class="delete-option-btn" @click="confirmDeleteCourse('teacher')">删除这个老师的课</button>
				<button class="delete-option-btn cancel" @click="closeDeleteOptions">取消</button>
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
	loadAppearance
} from '@/utils/schedule.js'
import { importScheduleFromZf, importScheduleFromText, ZF_LOGIN_URL } from '@/utils/scheduleImporter.js'
import {
	buildScheduleShareText,
	parseScheduleShareText,
	applyScheduleShare,
	extractShareCodeFromText,
	isSameAsLastClipShare,
	rememberClipShare
} from '@/utils/scheduleShare.js'
import { exportTextAsFile, pickAndReadTextFile, readClipboard, writeClipboard } from '@/utils/shareFile.js'

const TOTAL_WEEKS = 25
const WEEK_NAMES = ['一', '二', '三', '四', '五', '六', '日']

export default {
	data() {
		const periodConfig = loadPeriodConfig()
		let initialViewport = 0
		try {
			const info = uni.getSystemInfoSync()
			initialViewport = info.windowWidth || 0
		} catch (e) {}
		return {
			courses: [],
			meta: {},
			semesterStart: '',
			selectedWeek: 1,
			currentWeek: 1,
			activeCourse: null,
			showDeleteOptions: false,
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
			// 顶部分享 / 导入菜单
			showShareMenu: false,
			showImportMenu: false,
			// 粘贴分享内容弹窗
			showPasteImport: false,
			pasteImportText: '',
			// 是否已对当前剪切板尝试过自动识别
			autoClipboardChecked: false,
			// 课表区左右滑动切周
			swipeStartX: 0,
			swipeStartY: 0,
			swipeOffset: 0,           // 当前手指拖动的横向位移（px）
			swipeViewportWidth: initialViewport, // 视口宽度（px）
			swipeTracking: false,     // 是否在跟踪手势
			swipeAxisLocked: false,   // 是否已锁定为横向滑动
			swipeAnimating: false,    // 是否处于切换动画/回弹中
			swipePendingDirection: 0, // 当前正在动画提交的方向：>0 下一周，<0 上一周，0 仅回弹
			swipeCommitTimer: null,    // 动画完成的定时器，用于支持中途打断
			// 待新增格子的拖拽状态
			pendingDrag: null, // { edge: 'top'|'bottom', startY, baseStart, baseEnd }
			// 已添加课程的"长按拖动"状态
			courseDrag: null, // { courseId, startX, startY, dx, dy, originDay, originStart, span, longPressTimer, active, cellPx, colPx, suppressClick }
			// 重叠课程闪烁时钟（毫秒时间戳，驱动 sin² 透明度计算）
			blinkTick: 0,
			__blinkTimer: null
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
			return this.buildWeekDays(this.selectedWeek)
		},
		// 上一周 / 当前周 / 下一周三页数据，用于横向滑动
		swipePages() {
			const cur = this.selectedWeek
			const prevWeek = cur - 1
			const nextWeek = cur + 1
			const prev = prevWeek >= 1
				? {
					week: prevWeek,
					weekDays: this.buildWeekDays(prevWeek),
					coursesByDay: buildWeekTable(this.courses, prevWeek),
					isCurrent: false,
					isPlaceholder: false
				}
				: { week: 0, weekDays: [], coursesByDay: {}, isCurrent: false, isPlaceholder: true }
			const center = {
				week: cur,
				weekDays: this.buildWeekDays(cur),
				coursesByDay: this.coursesByDay,
				isCurrent: true,
				isPlaceholder: false
			}
			const next = nextWeek <= this.totalWeeks
				? {
					week: nextWeek,
					weekDays: this.buildWeekDays(nextWeek),
					coursesByDay: buildWeekTable(this.courses, nextWeek),
					isCurrent: false,
					isPlaceholder: false
				}
				: { week: 0, weekDays: [], coursesByDay: {}, isCurrent: false, isPlaceholder: true }
			return [prev, center, next]
		},
		// 滑动条/单页样式
		pageStyle() {
			const w = this.swipeViewportWidth || 0
			return w > 0 ? `width:${w}px;` : 'width:100%;'
		},
		trackStyle() {
			const w = this.swipeViewportWidth || 0
			// 三页并排，初始位置在第二页（中心），手指拖动时再叠加 swipeOffset
			const baseTranslate = w > 0 ? -w : 0
			const x = baseTranslate + this.swipeOffset
			const transition = this.swipeAnimating
				? 'transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1)'
				: 'none'
			return `width:${w * 3}px;transform:translateX(${x}px);transition:${transition};`
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
			const top = (this.pendingSlot.startPeriod - 1) * 124 + 8
			const span = this.pendingSlot.endPeriod - this.pendingSlot.startPeriod + 1
			const height = span * 124 - 16
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
	onLoad(options = {}) {
		this.handleSharedScheduleOptions(options)
	},
	onShareAppMessage() {
		// 微信原生分享：把分享码作为 path 参数传给好友
		// 注意：小程序 path 上限约 1024 字符，超长课表请使用其它分享方式
		try {
			if (!this.hasCourses) {
				return {
					title: '作业助手 - 课表分享',
					path: '/pages/schedule/schedule',
					imageUrl: '/static/logo.png'
				}
			}
			const { code, count } = buildScheduleShareText()
			const encoded = encodeURIComponent(code)
			const path = encoded.length <= 900
				? `/pages/schedule/schedule?shareCode=${encoded}`
				: '/pages/schedule/schedule'
			return {
				title: `我分享了 ${count} 门课的课表给你`,
				path,
				imageUrl: '/static/logo.png'
			}
		} catch (e) {
			return {
				title: '作业助手 - 课表分享',
				path: '/pages/schedule/schedule',
				imageUrl: '/static/logo.png'
			}
		}
	},
	onShow() {
		this.refresh()
		this.checkClipboardForShare()
		this.startBlinkTimerIfNeeded()
	},
	onHide() {
		this.stopBlinkTimer()
	},
	mounted() {
		this.swipeViewportWidth = this.getViewportWidth()
		// #ifdef H5
		window.addEventListener('message', this.handleWebImportMessage)
		this.__onResize = () => {
			this.swipeViewportWidth = this.getViewportWidth()
		}
		window.addEventListener('resize', this.__onResize)
		// #endif
		this.startBlinkTimerIfNeeded()
	},
	beforeUnmount() {
		// #ifdef H5
		window.removeEventListener('message', this.handleWebImportMessage)
		if (this.__onResize) window.removeEventListener('resize', this.__onResize)
		// #endif
		if (this.swipeCommitTimer) {
			clearTimeout(this.swipeCommitTimer)
			this.swipeCommitTimer = null
		}
		this.stopBlinkTimer()
	},
	onBackPress(options) {
		// 周次选择 / 课程详情 / 教务导入弹层弹出时，优先关闭弹层
		if (this.showAddPanel) {
			this.closeAddPanel()
			return true
		}
		if (this.showPasteImport) {
			this.showPasteImport = false
			return true
		}
		if (this.showShareMenu) {
			this.showShareMenu = false
			return true
		}
		if (this.showImportMenu) {
			this.showImportMenu = false
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
			this.currentWeek = calcCurrentWeek(this.semesterStart)
			if (!this.selectedWeek || this.selectedWeek < 1 || this.selectedWeek > this.totalWeeks) {
				this.selectedWeek = this.currentWeek
			}
			if (this.semesterStart && this.selectedWeek === 1 && this.currentWeek > 1) {
				this.selectedWeek = this.currentWeek
			}
			// 课程或配置变化后，重建分组缓存并按需启停闪烁时钟
			this.__overlapMapCache = null
			this.__overlapMapCacheKey = ''
			this.startBlinkTimerIfNeeded()
		},
		periodTimeText(period) {
			const time = this.periodTimes[period - 1]
			if (!time) return ''
			return `${time.start}\n${time.end}`
		},
		getCourseStyle(course) {
			const span = course.endPeriod - course.startPeriod + 1
			const top = (course.startPeriod - 1) * 124 + 8
			const height = span * 124 - 16
			const color = resolveCourseColor(course.subject, course.color, this.courseColorMap)
			const baseOpacity = this.appearance.cardOpacity
			let extra = ''
			// 拖拽中的课程：跟随手指偏移，并保持完全可见，不参与闪烁
			const isDragging =
				this.courseDrag &&
				this.courseDrag.active &&
				this.courseDrag.courseId === course.id
			if (isDragging) {
				const dx = this.courseDrag.dx || 0
				const dy = this.courseDrag.dy || 0
				extra = `transform:translate(${dx}px, ${dy}px);`
				return `top:${top}rpx;height:${height}rpx;background:${color};opacity:${baseOpacity};${extra}`
			}
			// 重叠分组闪烁
			const overlap = this.getOverlapInfo(course)
			if (overlap && overlap.groupSize > 1) {
				const alpha = this.computeOverlapAlpha(overlap)
				const finalOpacity = baseOpacity * alpha
				// 非激活课程不可点击，避免点到隐藏的下方课程
				const pe = alpha < 0.05 ? 'pointer-events:none;' : ''
				return `top:${top}rpx;height:${height}rpx;background:${color};opacity:${finalOpacity};${pe}`
			}
			return `top:${top}rpx;height:${height}rpx;background:${color};opacity:${baseOpacity};`
		},
		courseDragClass(course) {
			if (!this.courseDrag || !this.courseDrag.active) return ''
			if (this.courseDrag.courseId !== course.id) return ''
			return 'is-dragging'
		},
		// === 重叠课程闪烁：分组 + sin² 透明度 ===
		// 当前可视周的"按天的重叠分组"映射：courseId -> { groupSize, groupIndex }
		buildOverlapMap() {
			const map = {}
			const byDay = this.coursesByDay || {}
			for (let d = 1; d <= 7; d++) {
				const list = byDay[d] || []
				if (list.length < 2) continue
				// 按 startPeriod, id 排序，保证轮播顺序稳定
				const sorted = list.slice().sort((a, b) => {
					if (a.startPeriod !== b.startPeriod) return a.startPeriod - b.startPeriod
					return String(a.id).localeCompare(String(b.id))
				})
				// 并查集分组：时段区间有交集则同组
				const parent = sorted.map((_, i) => i)
				const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
				const union = (a, b) => {
					const ra = find(a), rb = find(b)
					if (ra !== rb) parent[ra] = rb
				}
				for (let i = 0; i < sorted.length; i++) {
					for (let j = i + 1; j < sorted.length; j++) {
						const a = sorted[i], b = sorted[j]
						// 区间相交判定
						if (a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod) {
							union(i, j)
						}
					}
				}
				const groups = {}
				sorted.forEach((c, i) => {
					const r = find(i)
					if (!groups[r]) groups[r] = []
					groups[r].push(c)
				})
				Object.values(groups).forEach(g => {
					if (g.length <= 1) return
					g.forEach((c, idx) => {
						map[c.id] = { groupSize: g.length, groupIndex: idx }
					})
				})
			}
			return map
		},
		getOverlapInfo(course) {
			if (!this.__overlapMapCache || this.__overlapMapCacheKey !== this.__coursesByDayKey()) {
				this.__overlapMapCache = this.buildOverlapMap()
				this.__overlapMapCacheKey = this.__coursesByDayKey()
			}
			return this.__overlapMapCache[course.id] || null
		},
		__coursesByDayKey() {
			// 用于判断 coursesByDay 是否变化的廉价键：课程数 + 简单签名
			const byDay = this.coursesByDay || {}
			const parts = []
			for (let d = 1; d <= 7; d++) {
				const list = byDay[d] || []
				if (!list.length) continue
				parts.push(d + ':' + list.map(c => `${c.id}-${c.startPeriod}-${c.endPeriod}`).join(','))
			}
			return parts.join('|')
		},
		// 计算重叠组内某课程当前帧的 alpha（0~1）
		// 总周期 = overlapBlinkCycleMs；满显示阶段 70%，前 15% 淡入，后 15% 淡出
		// 淡入淡出采用 sin²(x·π/2) 形态保证柔和
		computeOverlapAlpha({ groupSize, groupIndex }) {
			const cycleMs = Math.max(
				1000,
				Math.min(10000, Number(this.appearance.overlapBlinkCycleMs) || 5000)
			)
			const totalMs = cycleMs * groupSize
			const t = (this.blinkTick % totalMs + totalMs) % totalMs
			const activeIdx = Math.floor(t / cycleMs)
			if (activeIdx !== groupIndex) return 0
			const phase = (t - activeIdx * cycleMs) / cycleMs // 0~1
			const fade = 0.15
			if (phase < fade) {
				const x = phase / fade // 0~1
				const s = Math.sin(x * Math.PI / 2)
				return s * s
			}
			if (phase > 1 - fade) {
				const x = (1 - phase) / fade // 1~0
				const s = Math.sin(x * Math.PI / 2)
				return s * s
			}
			return 1
		},
		// 是否当前可视页存在任意重叠分组（决定是否启动定时器）
		hasAnyOverlap() {
			if (!this.__overlapMapCache || this.__overlapMapCacheKey !== this.__coursesByDayKey()) {
				this.__overlapMapCache = this.buildOverlapMap()
				this.__overlapMapCacheKey = this.__coursesByDayKey()
			}
			for (const k in this.__overlapMapCache) {
				if (Object.prototype.hasOwnProperty.call(this.__overlapMapCache, k)) return true
			}
			return false
		},
		startBlinkTimerIfNeeded() {
			this.stopBlinkTimer()
			if (!this.hasAnyOverlap()) return
			// 50ms ≈ 20fps，足够流畅且对小程序 setData 压力可控
			this.__blinkTimer = setInterval(() => {
				this.blinkTick = Date.now()
			}, 50)
			this.blinkTick = Date.now()
		},
		stopBlinkTimer() {
			if (this.__blinkTimer) {
				clearInterval(this.__blinkTimer)
				this.__blinkTimer = null
			}
		},
		resolveColor(course) {
			if (!course) return ''
			return resolveCourseColor(course.subject, course.color, this.courseColorMap)
		},
		openCourse(course) {
			this.activeCourse = course
			this.showDeleteOptions = false
		},
		openDeleteOptions() {
			if (!this.activeCourse) return
			this.showDeleteOptions = true
		},
		closeDeleteOptions() {
			this.showDeleteOptions = false
		},
		confirmDeleteCourse(type) {
			const course = this.activeCourse
			if (!course) return
			const teacher = `${course.teacher || ''}`.trim()
			if (type === 'teacher' && !teacher) {
				uni.showToast({ title: '这节课没有老师信息', icon: 'none' })
				return
			}
			const titleMap = {
				single: '删除这节课',
				day: '删除每周这一天',
				teacher: '删除这个老师'
			}
			const contentMap = {
				single: `确定删除「${course.subject || '这节课'}」吗？`,
				day: `确定删除每一周星期${this.weekDayName(course.dayOfWeek)}第${course.startPeriod}-${course.endPeriod}节的课吗？`,
				teacher: `确定删除「${teacher}」老师的所有课程吗？`
			}
			uni.showModal({
				title: titleMap[type] || '删除课程',
				content: contentMap[type] || '确定删除课程吗？',
				confirmText: '删除',
				confirmColor: '#ef4444',
				success: res => {
					if (!res.confirm) return
					this.applyDeleteCourse(type, course)
				}
			})
		},
		applyDeleteCourse(type, course) {
			const teacher = `${course.teacher || ''}`.trim()
			const list = loadCourses().filter(item => {
				if (type === 'single') return item.id !== course.id
				if (type === 'day') {
					return !(
						item.dayOfWeek === course.dayOfWeek &&
						item.startPeriod === course.startPeriod &&
						item.endPeriod === course.endPeriod
					)
				}
				if (type === 'teacher') return `${item.teacher || ''}`.trim() !== teacher
				return true
			})
			saveCourses(list)
			this.courses = list
			this.activeCourse = null
			this.showDeleteOptions = false
			this.__overlapMapCache = null
			this.__overlapMapCacheKey = ''
			this.startBlinkTimerIfNeeded()
			uni.showToast({ title: '已删除', icon: 'success' })
		},
		// 普通点击：拖动激活过则吃掉本次 click，否则打开课程详情
		onCourseClick(course) {
			if (this.courseDrag && this.courseDrag.suppressClick) {
				this.courseDrag = null
				return
			}
			this.courseDrag = null
			this.openCourse(course)
		},
		// 长按 -> 拖动课程到其他时段（允许重叠）
		onCourseTouchStart(course, dayIndex, e) {
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			// 清掉上一次残留
			if (this.courseDrag && this.courseDrag.longPressTimer) {
				clearTimeout(this.courseDrag.longPressTimer)
			}
			const cellPx = this.getPendingCellHeightPx()
			// 一列宽度 = (视口宽 - 时间列 80rpx) / 7
			let w = this.swipeViewportWidth || 0
			if (!w) {
				try { w = uni.getSystemInfoSync().windowWidth || 0 } catch (err) {}
			}
			const timeColPx = w ? (w / 750) * 80 : 0
			const colPx = w ? (w - timeColPx) / 7 : 0
			const drag = {
				courseId: course.id,
				startX: touch.clientX,
				startY: touch.clientY,
				dx: 0,
				dy: 0,
				originDay: dayIndex + 1,
				originStart: course.startPeriod,
				span: course.endPeriod - course.startPeriod + 1,
				cellPx,
				colPx,
				active: false,
				suppressClick: false,
				longPressTimer: null
			}
			drag.longPressTimer = setTimeout(() => {
				if (this.courseDrag && this.courseDrag.courseId === course.id) {
					this.courseDrag.active = true
					this.courseDrag.suppressClick = true
					try { uni.vibrateShort && uni.vibrateShort({ type: 'medium' }) } catch (err) {}
				}
			}, 400)
			this.courseDrag = drag
		},
		onCourseTouchMove(e) {
			if (!this.courseDrag) return
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			const dx = touch.clientX - this.courseDrag.startX
			const dy = touch.clientY - this.courseDrag.startY
			// 未激活长按前：如果手指明显移动，取消长按定时器（视为滑动/滚动，不进入拖拽）
			if (!this.courseDrag.active) {
				if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
					if (this.courseDrag.longPressTimer) {
						clearTimeout(this.courseDrag.longPressTimer)
						this.courseDrag.longPressTimer = null
					}
					this.courseDrag = null
				}
				return
			}
			// 激活后：跟随手指移动
			this.courseDrag = { ...this.courseDrag, dx, dy }
		},
		onCourseTouchEnd() {
			if (!this.courseDrag) return
			if (this.courseDrag.longPressTimer) {
				clearTimeout(this.courseDrag.longPressTimer)
				this.courseDrag.longPressTimer = null
			}
			if (!this.courseDrag.active) {
				// 没有进入拖拽状态：不做任何修改，让 click 自然触发详情
				this.courseDrag = null
				return
			}
			// 计算目标 day / period
			const { courseId, dx, dy, originDay, originStart, span, cellPx, colPx } = this.courseDrag
			let targetDay = originDay
			let targetStart = originStart
			if (colPx > 0) {
				const dCol = dx >= 0 ? Math.floor(dx / colPx + 0.5) : Math.ceil(dx / colPx - 0.5)
				targetDay = Math.min(7, Math.max(1, originDay + dCol))
			}
			if (cellPx > 0) {
				const dRow = dy >= 0 ? Math.floor(dy / cellPx + 0.5) : Math.ceil(dy / cellPx - 0.5)
				targetStart = Math.min(this.totalPeriods - span + 1, Math.max(1, originStart + dRow))
			}
			// 落回原位则不持久化
			if (targetDay === originDay && targetStart === originStart) {
				this.courseDrag = { ...this.courseDrag, dx: 0, dy: 0, active: false }
				// 留 suppressClick 让本次 click 被吃掉
				return
			}
			// 应用变更：允许重叠，不做冲突检测
			const list = loadCourses()
			const idx = list.findIndex(c => c.id === courseId)
			if (idx >= 0) {
				const target = { ...list[idx] }
				target.dayOfWeek = targetDay
				target.startPeriod = targetStart
				target.endPeriod = targetStart + span - 1
				target.jcText = `${target.startPeriod}-${target.endPeriod}`
				list[idx] = target
				saveCourses(list)
				this.courses = list
			}
			// 拖拽落点后，重叠分组可能变化，刷新闪烁时钟
			this.__overlapMapCache = null
			this.__overlapMapCacheKey = ''
			this.startBlinkTimerIfNeeded()
			// 保持 suppressClick = true，避免松手时 click 触发详情
			this.courseDrag = { ...this.courseDrag, dx: 0, dy: 0, active: false }
		},
		// 点击空白格子：第一次点出现待新增标记，再次点击该范围内的格子则打开新增面板
		onCellTap(dayIndex, period) {
			const day = dayIndex + 1
			if (this.occupancyMap[day] && this.occupancyMap[day][period]) return
			// 已有 pendingSlot：在范围内 → 打开添加面板；不在范围 → 移动到新位置
			if (this.pendingSlot && this.pendingSlot.dayIndex === dayIndex) {
				if (
					period >= this.pendingSlot.startPeriod &&
					period <= this.pendingSlot.endPeriod
				) {
					this.openAddPanel()
					return
				}
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
		// 待新增格子上下拖拽：每滑过一个格子高度就调整一节
		getPendingCellHeightPx() {
			let w = 0
			try {
				w = uni.getSystemInfoSync().windowWidth || 0
			} catch (e) {}
			if (!w) w = this.swipeViewportWidth || 375
			// .grid-cell 高度为 124rpx，rpx 与 px 换算：1rpx = windowWidth/750 px
			return (w / 750) * 124
		},
		onPendingDragStart(edge, e) {
			if (!this.pendingSlot) return
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			this.pendingDrag = {
				edge,
				startY: touch.clientY,
				baseStart: this.pendingSlot.startPeriod,
				baseEnd: this.pendingSlot.endPeriod,
				cellPx: this.getPendingCellHeightPx()
			}
		},
		onPendingDragMove(e) {
			if (!this.pendingDrag || !this.pendingSlot) return
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			const { edge, startY, baseStart, baseEnd, cellPx } = this.pendingDrag
			if (!cellPx) return
			const dy = touch.clientY - startY
			// 移动一格高度的一半就触发跳一格，体验更跟手
			const stepRaw = dy / cellPx
			const step = stepRaw >= 0 ? Math.floor(stepRaw + 0.5) : Math.ceil(stepRaw - 0.5)
			const day = this.pendingSlot.dayIndex + 1
			const occ = this.occupancyMap[day] || {}
			if (edge === 'top') {
				// 上手柄：startPeriod 跟随手指上下移动，向上扩、向下收
				let target = baseStart + step
				if (target < 1) target = 1
				if (target > baseEnd) target = baseEnd
				// 向上扩展时不能跨越已被占用的节次
				while (target < baseStart && occ[target]) target += 1
				if (target === this.pendingSlot.startPeriod) return
				this.pendingSlot = { ...this.pendingSlot, startPeriod: target }
			} else {
				// 下手柄：endPeriod 跟随手指上下移动
				let target = baseEnd + step
				if (target > this.totalPeriods) target = this.totalPeriods
				if (target < baseStart) target = baseStart
				while (target > baseEnd && occ[target]) target -= 1
				if (target === this.pendingSlot.endPeriod) return
				this.pendingSlot = { ...this.pendingSlot, endPeriod: target }
			}
		},
		onPendingDragEnd() {
			this.pendingDrag = null
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
		buildWeekDays(week) {
			const todayStr = this.formatDate(new Date())
			return WEEK_NAMES.map((name, idx) => {
				const date = getDateOfWeek(this.semesterStart, week, idx + 1)
				return {
					label: `周${name}`,
					date: this.shortDate(date),
					isToday: !!date && date === todayStr
				}
			})
		},
		getViewportWidth() {
			try {
				const info = uni.getSystemInfoSync()
				return info.windowWidth || 0
			} catch (e) {
				return 0
			}
		},
		onSwipeStart(e) {
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			// 如果上一次切周动画还没跑完，立刻把它敲定并让新手势从 0 开始，
			// 这样可以连续快速滑动而不会被动画"吞"掉。
			if (this.swipeAnimating || this.swipeCommitTimer) {
				this.finalizePendingCommit()
			}
			this.swipeStartX = touch.clientX
			this.swipeStartY = touch.clientY
			this.swipeOffset = 0
			this.swipeAxisLocked = false
			this.swipeTracking = true
			if (!this.swipeViewportWidth) {
				this.swipeViewportWidth = this.getViewportWidth()
			}
		},
		onSwipeMove(e) {
			if (!this.swipeTracking) return
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			const dx = touch.clientX - this.swipeStartX
			const dy = touch.clientY - this.swipeStartY
			if (!this.swipeAxisLocked) {
				// 还没锁定方向：横向位移明显大于纵向时锁为横滑；反之放弃
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
				if (Math.abs(dx) > Math.abs(dy) * 1.2) {
					this.swipeAxisLocked = true
				} else {
					this.swipeTracking = false
					this.swipeOffset = 0
					return
				}
			}
			let offset = dx
			// 边界：第一周不让向右拖出，最后一周不让向左拖出（加阻尼）
			if (this.selectedWeek <= 1 && offset > 0) offset = offset * 0.3
			if (this.selectedWeek >= this.totalWeeks && offset < 0) offset = offset * 0.3
			this.swipeOffset = offset
		},
		onSwipeEnd() {
			if (!this.swipeTracking) {
				this.swipeOffset = 0
				return
			}
			this.swipeTracking = false
			const w = this.swipeViewportWidth || 0
			const threshold = w / 10
			const offset = this.swipeOffset
			const canPrev = this.selectedWeek > 1
			const canNext = this.selectedWeek < this.totalWeeks
			// 超过阈值才确认切换；否则回弹
			if (offset <= -threshold && canNext) {
				this.commitSwipe(1)
			} else if (offset >= threshold && canPrev) {
				this.commitSwipe(-1)
			} else {
				this.springBack()
			}
		},
		// 切到下一/上一周：先把 track 平滑动到目标位置，动画结束后再换 selectedWeek 并瞬移回中心
		commitSwipe(direction) {
			const w = this.swipeViewportWidth || 0
			this.swipeAnimating = true
			this.swipePendingDirection = direction
			this.swipeOffset = direction > 0 ? -w : w
			if (this.swipeCommitTimer) {
				clearTimeout(this.swipeCommitTimer)
			}
			this.swipeCommitTimer = setTimeout(() => {
				this.finalizePendingCommit()
			}, 230)
		},
		// 结束当前的切换/回弹动画：立刻提交方向并把 track 瞬移回中心位置
		finalizePendingCommit() {
			if (this.swipeCommitTimer) {
				clearTimeout(this.swipeCommitTimer)
				this.swipeCommitTimer = null
			}
			const direction = this.swipePendingDirection
			this.swipePendingDirection = 0
			this.swipeAnimating = false
			this.swipeOffset = 0
			if (direction > 0) {
				this.nextWeek()
				this.pendingSlot = null
			} else if (direction < 0) {
				this.prevWeek()
				this.pendingSlot = null
			}
		},
		springBack() {
			this.swipeAnimating = true
			this.swipePendingDirection = 0
			this.swipeOffset = 0
			if (this.swipeCommitTimer) {
				clearTimeout(this.swipeCommitTimer)
			}
			this.swipeCommitTimer = setTimeout(() => {
				this.swipeCommitTimer = null
				this.swipeAnimating = false
			}, 230)
		},
		selectWeek(week) {
			this.selectedWeek = week
			this.showWeekPicker = false
		},
		goToCurrentWeek() {
			this.selectedWeek = this.currentWeek
			this.showWeekPicker = false
		},
		toggleShareMenu() {
			if (!this.hasCourses) {
				uni.showToast({ title: '当前还没有课表', icon: 'none' })
				return
			}
			this.showShareMenu = !this.showShareMenu
			if (this.showShareMenu) this.showImportMenu = false
		},
		toggleImportMenu() {
			this.showImportMenu = !this.showImportMenu
			if (this.showImportMenu) this.showShareMenu = false
		},
		closeMenus() {
			this.showShareMenu = false
			this.showImportMenu = false
		},
		// 微信原生分享按钮被点击：仅关闭菜单，分享内容由 onShareAppMessage 提供
		onWxShareTap() {
			if (!this.hasCourses) {
				uni.showToast({ title: '当前还没有课表', icon: 'none' })
				return
			}
			try {
				const { code, count } = buildScheduleShareText()
				const encoded = encodeURIComponent(code)
				if (encoded.length > 900) {
					uni.showToast({
						title: '课表过大，建议改用导出文件',
						icon: 'none',
						duration: 2400
					})
				} else {
					uni.showToast({ title: `已准备好 ${count} 门课`, icon: 'none' })
				}
			} catch (e) {}
			this.showShareMenu = false
		},
		// 处理被微信好友打开/分享卡片转跳进入时携带的分享码
		handleSharedScheduleOptions(options = {}) {
			const shareCode = options && options.shareCode ? `${options.shareCode}` : ''
			if (!shareCode) return
			let decoded = shareCode
			try {
				decoded = decodeURIComponent(shareCode)
			} catch (e) {}
			const code = extractShareCodeFromText(decoded)
			if (!code) return
			// 已经导入过相同的内容则不再提示
			if (isSameAsLastClipShare(code)) return
			rememberClipShare(code)
			setTimeout(() => {
				uni.showModal({
					title: '导入分享课表',
					content: '检测到好友分享的课表，是否立即导入？',
					confirmText: '导入',
					success: res => {
						if (res.confirm) {
							this.applyImport(decoded, { source: 'wxshare', code })
						}
					}
				})
			}, 400)
		},
		// 分享：复制到剪切板
		async shareByClipboard() {
			this.showShareMenu = false
			if (!this.hasCourses) {
				uni.showToast({ title: '当前还没有课表', icon: 'none' })
				return
			}
			try {
				const { text, count } = buildScheduleShareText()
				await writeClipboard(text)
				rememberClipShare(extractShareCodeFromText(text))
				uni.showToast({ title: `已复制 ${count} 门课`, icon: 'success' })
			} catch (e) {
				uni.showToast({ title: '复制失败，请重试', icon: 'none' })
			}
		},
		// 分享：导出为文件并调用系统分享
		async shareByFile() {
			this.showShareMenu = false
			if (!this.hasCourses) {
				uni.showToast({ title: '当前还没有课表', icon: 'none' })
				return
			}
			try {
				const { text, count } = buildScheduleShareText()
				const filename = `schedule_${this.formatStamp(new Date())}.txt`
				uni.showLoading({ title: '准备分享...' })
				const res = await exportTextAsFile(text, filename, 'text/plain')
				uni.hideLoading()
				if (res && res.method === 'clipboard') {
					uni.showToast({ title: '已复制分享内容到剪切板', icon: 'success' })
				} else if (res && res.method === 'download') {
					uni.showToast({ title: `已下载 ${count} 门课`, icon: 'success' })
				} else {
					uni.showToast({ title: '请选择要分享到的应用', icon: 'none' })
				}
			} catch (e) {
				uni.hideLoading()
				uni.showModal({
					title: '导出失败',
					content: (e && e.message) || '请重试',
					showCancel: false
				})
			}
		},

		// 导入：从剪切板
		async importFromClipboard(silent = false) {
			this.showImportMenu = false
			try {
				const text = await readClipboard()
				const code = extractShareCodeFromText(text)
				if (!code) {
					if (!silent) uni.showToast({ title: '剪切板中没有课表分享码', icon: 'none' })
					return false
				}
				return this.applyImport(text, { source: 'clipboard', code })
			} catch (e) {
				if (!silent) uni.showToast({ title: '读取剪切板失败', icon: 'none' })
				return false
			}
		},
		// 导入：粘贴文字
		openPasteImport() {
			this.showImportMenu = false
			this.pasteImportText = ''
			this.showPasteImport = true
		},
		closePasteImport() {
			this.showPasteImport = false
		},
		async pastePasteText() {
			try {
				const text = await readClipboard()
				this.pasteImportText = text || ''
				if (!text) uni.showToast({ title: '剪切板为空', icon: 'none' })
			} catch (e) {
				uni.showToast({ title: '读取剪切板失败', icon: 'none' })
			}
		},
		submitPasteImport() {
			const text = `${this.pasteImportText || ''}`.trim()
			if (!text) {
				uni.showToast({ title: '请粘贴分享内容', icon: 'none' })
				return
			}
			const code = extractShareCodeFromText(text)
			this.applyImport(text, { source: 'paste', code }).then(ok => {
				if (ok) this.showPasteImport = false
			})
		},
		// 导入：从文件
		async importFromFile() {
			this.showImportMenu = false
			try {
				const res = await pickAndReadTextFile({ extensions: ['txt', 'json'] })
				const text = (res && res.content) || ''
				if (!text) {
					uni.showToast({ title: '文件内容为空', icon: 'none' })
					return
				}
				const code = extractShareCodeFromText(text)
				return this.applyImport(text, { source: 'file', code })
			} catch (e) {
				const msg = (e && e.message) || ''
				if (msg && !/cancel|取消|未选择/i.test(msg)) {
					uni.showToast({ title: msg, icon: 'none' })
				}
			}
		},
		// 公共导入：解析 -> 询问合并/覆盖 -> 应用
		applyImport(rawText, { code } = {}) {
			let parsed
			try {
				parsed = parseScheduleShareText(rawText)
			} catch (e) {
				uni.showModal({
					title: '导入失败',
					content: (e && e.message) || '内容格式不正确',
					showCancel: false
				})
				return Promise.resolve(false)
			}
			const count = parsed.courses.length
			if (!count) {
				uni.showToast({ title: '未识别到任何课程', icon: 'none' })
				return Promise.resolve(false)
			}

			const hasExisting = this.courses.length > 0
			return new Promise(resolve => {
				const apply = mode => {
					try {
						applyScheduleShare(parsed, { mode })
						if (code) rememberClipShare(code)
						this.refresh()
						uni.showToast({ title: `已导入 ${count} 门课`, icon: 'success' })
						resolve(true)
					} catch (e) {
						uni.showModal({
							title: '导入失败',
							content: (e && e.message) || '请重试',
							showCancel: false
						})
						resolve(false)
					}
				}
				if (!hasExisting) {
					apply('replace')
					return
				}
				uni.showModal({
					title: '检测到课表分享',
					content: `共识别 ${count} 门课。覆盖将替换当前课表，合并会保留现有课程。`,
					confirmText: '合并导入',
					cancelText: '覆盖导入',
					success: res => {
						if (res.cancel) {
							apply('replace')
						} else if (res.confirm) {
							apply('merge')
						} else {
							resolve(false)
						}
					},
					fail: () => resolve(false)
				})
			})
		},
		// 进入页面时自动检测剪切板里的分享码（同样内容只识别一次）
		async checkClipboardForShare() {
			if (this.autoClipboardChecked) return
			this.autoClipboardChecked = true
			try {
				const text = await readClipboard()
				const code = extractShareCodeFromText(text || '')
				if (!code) return
				if (isSameAsLastClipShare(code)) return
				rememberClipShare(code) // 先记下，避免取消后再次弹出
				const ok = await new Promise(resolve => {
					uni.showModal({
						title: '检测到课表分享码',
						content: '剪切板中包含课表分享内容，是否立即导入？',
						confirmText: '导入',
						cancelText: '忽略',
						success: r => resolve(!!r.confirm),
						fail: () => resolve(false)
					})
				})
				if (!ok) return
				this.applyImport(text, { source: 'auto-clipboard', code })
			} catch (e) {
				// 静默忽略：部分平台需用户手势才能读取剪切板
			}
		},
		formatStamp(date) {
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			const h = `${date.getHours()}`.padStart(2, '0')
			const mi = `${date.getMinutes()}`.padStart(2, '0')
			return `${y}${m}${d}_${h}${mi}`
		},
		startImport() {
			this.showImportMenu = false
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
							uni.navigateTo({ url: '/pages/settings/semester/semester' })
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
	height: 100vh;
	box-sizing: border-box;
	background: #f4f7fb;
	position: relative;
	display: flex;
	flex-direction: column;
	overflow: hidden;
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
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-shrink: 0;
	gap: 16rpx;
	padding: calc(20rpx + var(--status-bar-height)) 28rpx 20rpx;
	background: #ffffff;
	color: #2979ff;
	border-bottom: 2rpx solid #eef2f7;
}

.nav-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 2rpx;
	min-width: 0;
}

.nav-title {
	font-size: 38rpx;
	font-weight: 800;
	color: #111827;
	line-height: 1.2;
}

.nav-subtitle {
	font-size: 22rpx;
	color: #6b7280;
	line-height: 1.3;
}

.nav-meta {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 2rpx;
	flex-shrink: 0;
	margin-right: 4rpx;
}

.meta-count {
	font-size: 24rpx;
	font-weight: 700;
	color: #111827;
	line-height: 1.2;
}

.meta-time {
	font-size: 20rpx;
	color: #9ca3af;
	line-height: 1.2;
}

.nav-actions {
	display: flex;
	align-items: center;
	gap: 10rpx;
	flex-shrink: 0;
}

.nav-btn {
	min-width: 68rpx;
	height: 56rpx;
	padding: 0 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #eef4ff;
}

.nav-btn-text {
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1;
	color: #2979ff;
}

.nav-arrow {
	font-size: 36rpx;
	font-weight: 700;
	line-height: 36rpx;
	color: #2979ff;
}

.menu-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 88;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	padding: 230rpx 28rpx 0;
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.32);
}

.menu-card {
	width: 360rpx;
	padding: 22rpx 18rpx 12rpx;
	border-radius: 22rpx;
	background: #ffffff;
	box-shadow: 0 18rpx 48rpx rgba(15, 23, 42, 0.18);
}

.menu-title {
	display: block;
	margin: 0 12rpx 14rpx;
	font-size: 24rpx;
	font-weight: 800;
	color: #6b7280;
}

.menu-item {
	padding: 18rpx 14rpx;
	border-radius: 16rpx;
}

.menu-item:active {
	background: #f3f4f6;
}

.menu-item-btn {
	display: block;
	width: 100%;
	margin: 0 0 8rpx;
	padding: 18rpx 14rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, #ecfdf5, #f0fdfa);
	text-align: left;
	line-height: normal;
	font-weight: 700;
	box-sizing: border-box;
	border: none;
}

.menu-item-btn::after {
	border: none;
}

.menu-item-btn:active {
	background: linear-gradient(135deg, #d1fae5, #ccfbf1);
}

.menu-item-title {
	display: block;
	font-size: 28rpx;
	font-weight: 800;
	color: #111827;
}

.menu-item-desc {
	display: block;
	margin-top: 4rpx;
	font-size: 22rpx;
	color: #6b7280;
	line-height: 1.4;
}

.paste-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 110;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 60rpx 36rpx;
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.45);
}

.paste-card {
	width: 100%;
	border-radius: 28rpx;
	background: #ffffff;
	overflow: hidden;
}

.paste-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 28rpx 12rpx;
}

.paste-title {
	font-size: 30rpx;
	font-weight: 800;
	color: #111827;
}

.paste-close {
	font-size: 44rpx;
	line-height: 44rpx;
	color: #9ca3af;
}

.paste-textarea {
	width: calc(100% - 56rpx);
	height: 280rpx;
	margin: 0 28rpx;
	padding: 18rpx 22rpx;
	border-radius: 18rpx;
	background: #f3f4f6;
	font-size: 26rpx;
	color: #111827;
	box-sizing: border-box;
}

.paste-actions {
	display: flex;
	gap: 16rpx;
	padding: 22rpx 28rpx 28rpx;
}

.paste-ghost-btn,
.paste-primary-btn {
	flex: 1;
	margin: 0;
	height: 80rpx;
	line-height: 80rpx;
	border-radius: 999rpx;
	font-size: 26rpx;
	font-weight: 800;
}

.paste-ghost-btn {
	background: #f3f4f6;
	color: #4b5563;
}

.paste-primary-btn {
	background: #2979ff;
	color: #ffffff;
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
	flex: 1;
	min-height: 0;
}

.swipe-viewport {
	flex: 1;
	min-height: 0;
	width: 100%;
	overflow: hidden;
	position: relative;
	background: #ffffff;
}

.swipe-track {
	display: flex;
	flex-direction: row;
	height: 100%;
	will-change: transform;
}

.swipe-page {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	height: 100%;
	box-sizing: border-box;
}

.schedule-scroll {
	flex: 1;
	min-height: 0;
	height: auto;
	background: #ffffff;
}

.header-row {
	display: flex;
	flex-shrink: 0;
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
	min-height: 1364rpx;
}

.body-time {
	display: flex;
	flex-direction: column;
}

.time-cell {
	height: 124rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
	border-bottom: 2rpx solid #e2e8f0;
}

.time-cell:last-child {
	border-bottom: none;
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

/* body-col 必须重置 day-col 在 header 时使用的 flex 居中样式，
   否则 grid-cell 会被压缩成 0 宽，横向网格线 / 点击全部失效 */
.body-col {
	position: relative;
	display: block;
	padding: 0;
	gap: 0;
	align-items: stretch;
	border-left: 2rpx solid #cbd5e1;
	border-top: 2rpx solid #cbd5e1;
}

.grid-cell {
	display: block;
	width: 100%;
	height: 124rpx;
	box-sizing: border-box;
	border-bottom: 2rpx solid #cbd5e1;
}

.grid-cell.is-last {
	border-bottom: 2rpx solid #cbd5e1;
}

.course-block {
	position: absolute;
	left: 5rpx;
	right: 5rpx;
	padding: 12rpx 8rpx;
	border-radius: 16rpx;
	color: #ffffff;
	box-shadow: 0 4rpx 12rpx rgba(15, 23, 42, 0.18);
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	overflow: hidden;
	box-sizing: border-box;
	z-index: 5;
	transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.course-block.is-dragging {
	z-index: 99;
	box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.32);
	opacity: 0.92;
	transition: none;
}

.course-block.is-drag-origin {
	opacity: 0.35;
}

.pending-block {
	position: absolute;
	left: 6rpx;
	right: 6rpx;
	z-index: 6;
	border-radius: 16rpx;
	border: 3rpx dashed #2979ff;
	background: rgba(41, 121, 255, 0.06);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 8rpx 0;
	box-sizing: border-box;
}

.pending-handle {
	width: 100%;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 7;
}

.pending-handle-bar {
	width: 80rpx;
	height: 10rpx;
	border-radius: 6rpx;
	background: transparent;
	box-shadow: none;
}

.pending-add {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 0;
	background: transparent;
	box-shadow: none;
}

.pending-add-text {
	font-size: 46rpx;
	line-height: 46rpx;
	color: #2979ff;
	font-weight: 800;
}

.course-name {
	font-size: 22rpx;
	font-weight: 800;
	line-height: 28rpx;
	color: #ffffff;
	white-space: normal;
	word-break: break-all;
	overflow: visible;
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

.course-delete-btn {
	margin-top: 24rpx;
	width: 100%;
	height: 82rpx;
	line-height: 82rpx;
	border-radius: 18rpx;
	background: #fee2e2;
	color: #ef4444;
	font-size: 28rpx;
	font-weight: 800;
}

.course-delete-btn::after {
	border: 0;
}

.delete-options-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 110;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding: 32rpx;
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.36);
}

.delete-options-card {
	width: 100%;
	padding: 28rpx;
	border-radius: 28rpx;
	background: #ffffff;
	box-sizing: border-box;
}

.delete-options-title {
	display: block;
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
	text-align: center;
}

.delete-options-subtitle {
	display: block;
	margin-top: 8rpx;
	margin-bottom: 22rpx;
	font-size: 24rpx;
	color: #6b7280;
	text-align: center;
}

.delete-option-btn {
	margin-top: 14rpx;
	width: 100%;
	height: 82rpx;
	line-height: 82rpx;
	border-radius: 18rpx;
	background: #f8fafc;
	color: #111827;
	font-size: 28rpx;
	font-weight: 700;
}

.delete-option-btn.danger {
	background: #fee2e2;
	color: #ef4444;
}

.delete-option-btn.cancel {
	margin-top: 20rpx;
	background: #ffffff;
	color: #6b7280;
}

.delete-option-btn::after {
	border: 0;
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
