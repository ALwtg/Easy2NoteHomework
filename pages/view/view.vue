<template>
	<view class="page" @touchstart="onPageTouchStart" @touchmove="onPageTouchMove" @touchend="onPageTouchEnd" @touchcancel="onPageTouchEnd">
		<view :class="['top-panel', isTopCollapsed ? 'is-collapsed' : '']">
			<view class="collapsed-bar" @click="expandTopPanel">
				<image class="expand-icon" src="/static/more.png" mode="aspectFit"></image>
				<text class="collapsed-title">展开功能栏</text>
			</view>

			<view class="custom-nav">
				<text class="nav-title">查看作业</text>
				<view class="nav-share-wrap">
					<button class="nav-share-btn" @click="showShareMenu = !showShareMenu">分享</button>
					<view v-if="showShareMenu" class="share-menu">
						<text class="share-menu-tip">选择分享方式</text>
						<button class="share-menu-item primary" open-type="share" @click="showShareMenu = false">微信分享</button>
						<button class="share-menu-item" @click="copyShareCode">复制分享码</button>
						<button class="share-menu-item" @click="openImportForm">导入分享码</button>
					</view>
				</view>
			</view>

			<view v-if="showImportForm" class="form-card import-form">
				<view class="form-title-row">
					<text class="form-title">导入分享码</text>
					<text class="form-close" @click="showImportForm = false">取消</text>
				</view>
				<textarea class="import-textarea" v-model="importCode" placeholder="粘贴好友的分享码" maxlength="10000" />
				<view class="import-btns">
					<button class="paste-btn" @click="pasteFromClipboard">从剪贴板导入</button>
					<button class="save-btn" @click="manualImport">导入作业</button>
				</view>
			</view>

			<view class="stats">
				<view :class="['stat-card', selectedStatus === 'pending' ? 'active' : '']" @click="selectStatus('pending')">
					<text class="stat-num">{{ pendingCount }}</text>
					<text class="stat-label">未完成</text>
				</view>
				<view :class="['stat-card', 'warn', selectedStatus === 'urgent' ? 'active' : '']" @click="selectStatus('urgent')">
					<text class="stat-num">{{ urgentCount }}</text>
					<text class="stat-label">临近截止</text>
				</view>
				<view :class="['stat-card', 'done', selectedStatus === 'completed' ? 'active' : '']" @click="selectStatus('completed')">
					<text class="stat-num">{{ completedCount }}</text>
					<text class="stat-label">已完成</text>
				</view>
			</view>

			<view class="filter-card">
				<view class="filter-head">
					<text class="filter-title">按学科筛选</text>
					<text class="filter-count">{{ filterSummary }}</text>
				</view>
				<scroll-view class="subject-filter-scroll" scroll-x show-scrollbar="false">
					<view class="subject-filter-list">
						<view
							v-for="subject in subjectFilterOptions"
							:key="subject"
							:class="['filter-chip', selectedSubject === subject ? 'active' : '']"
							@click="selectSubject(subject)"
						>
							<text>{{ subject }}</text>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>

		<view class="section-title-row">
			<view>
				<text class="section-title">作业看板</text>
				<text v-if="selectedSubject !== '全部'" class="section-subtitle">当前：{{ selectedSubject }}</text>
			</view>
			<text class="section-tip">点击编辑 · 右划完成 · 左滑恢复 · 长按删除</text>
		</view>

		<view v-if="visibleHomework.length" class="homework-list">
			<view
				v-for="(item, index) in visibleHomework"
				:key="item.id"
				:class="['homework-card', cardEnterActive ? 'is-entering' : '', touchingId === item.id && swipeOffsetX ? 'is-swiping' : '', getSwipeActionClass(item), item.completed ? 'is-done' : '', item.id === completingId ? 'is-completing' : '']"
				:style="getCardStyle(item, index)"
				@touchstart="onTouchStart($event, item.id)"
				@touchmove="onTouchMove($event, item.id)"
				@touchend="onTouchEnd($event, item)"
				@touchcancel="onTouchCancel"
				@longpress="onLongPress(item)"
				@click="editHomework(item)"
			>
				<view v-if="touchingId === item.id && swipeOffsetX" class="swipe-action">
					<text class="swipe-action-icon">{{ getSwipeActionIcon(item) }}</text>
					<text class="swipe-action-text">{{ getSwipeActionText(item) }}</text>
				</view>

				<view v-if="item.id === completingId" class="complete-badge">
					<text class="complete-check">✓</text>
					<text class="complete-text">已完成</text>
				</view>
				<scroll-view v-if="getImagePaths(item).length || getAudios(item).length" scroll-x class="card-attachment-scroll" @click.stop>
					<view class="card-attachment-row">
						<image v-for="(path, index) in getImagePaths(item)" :key="`card-image-${item.id}-${index}`" class="thumb" :src="path" mode="aspectFill" @click.stop="previewImage(path, getImagePaths(item))"></image>
						<view v-for="(audio, index) in getAudios(item)" :key="`card-audio-${item.id}-${index}`" class="thumb audio-thumb" @click.stop="playAudio(audio.path)">
							<image class="audio-thumb-icon" src="/static/audio.png" mode="aspectFit"></image>
							<text class="audio-thumb-text">{{ audio.duration || 1 }}秒</text>
						</view>
					</view>
				</scroll-view>
				<view v-else class="thumb text-thumb">
					<text>文</text>
				</view>
				<view class="card-body">
					<view class="card-top">
						<text class="subject-tag">{{ item.subject }}</text>
						<text :class="['status', item.completed ? 'status-done' : getDeadlineClass(item)]">{{ getStatusText(item) }}</text>
					</view>
					<text class="deadline">截止：{{ formatDeadline(item.deadline) }}</text>
					<text v-if="getAudios(item).length" class="audio-note" @click.stop="playAudio(getAudios(item)[0].path)">点击播放语音 · {{ getAudios(item).length }} 条</text>
					<text v-if="item.note" class="card-note">{{ item.note }}</text>
					<text v-else class="card-note muted">暂无备注</text>
				</view>
			</view>
		</view>

		<view v-if="isLoadingHomework" class="load-more-row">
			<view class="load-spinner"></view>
			<text>正在逐个加载作业...</text>
		</view>

		<view v-else-if="visibleHomework.length && !hasMoreHomework" class="load-more-row is-end">
			<text>已显示全部 {{ sortedHomework.length }} 条作业</text>
		</view>

		<view v-else-if="sortedHomework.length && hasMoreHomework" class="load-more-row">
			<text>继续上滑加载更多</text>
		</view>

		<view v-else class="empty">
			<text class="empty-title">{{ emptyTitle }}</text>
			<text class="empty-tip">{{ emptyTip }}</text>
		</view>

		<view v-if="showForm" class="modal-mask" @click="resetForm">
			<view class="form-card edit-modal-card" @click.stop>
				<view class="form-title-row">
					<text class="form-title">编辑作业</text>
					<text class="form-close" @click="resetForm">取消</text>
				</view>


				<view class="attachment-edit-actions">
					<view class="attachment-add-btn" @click="chooseFormImage">添加图片</view>
					<view :class="['attachment-add-btn', isRecording ? 'recording' : '']" @click="toggleFormRecord">{{ isRecording ? '停止录音' : '添加录音' }}</view>
				</view>

				<view v-if="form.imagePaths.length || form.audios.length" class="form-preview-grid">
					<view v-for="(path, index) in form.imagePaths" :key="`edit-image-${index}-${path}`" class="preview-tile">
						<image class="preview" :src="path" mode="aspectFill" @click="previewImage(path, form.imagePaths)"></image>
						<image class="remove-attachment preview-remove" src="/static/delete.png" mode="aspectFit" @click.stop="removeFormImageAttachment(index)"></image>
					</view>
					<view v-for="(audio, index) in form.audios" :key="`edit-audio-${index}-${audio.path}`" class="preview-tile audio-preview-tile" @click="playAudio(audio.path)">
						<image class="audio-thumb-icon" src="/static/audio.png" mode="aspectFit"></image>
						<text class="audio-thumb-text">{{ audio.duration || 1 }}秒</text>
						<image class="remove-attachment preview-remove" src="/static/delete.png" mode="aspectFit" @click.stop="removeFormAudioAttachment(index)"></image>
					</view>
				</view>

				<view class="field">
					<text class="label">选择学科</text>
					<picker :range="subjectNames" @change="onSubjectChange">
						<view class="picker-box">{{ form.subject || '从已建学科中选择' }}</view>
					</picker>
				</view>

				<view class="quick-subject">
					<input class="subject-input" v-model="newSubjectName" placeholder="快捷新建学科" maxlength="20" />
					<button class="small-btn" @click="addSubject">新建</button>
				</view>

				<view class="date-row">
					<view class="field half">
						<text class="label">截止日期</text>
						<picker mode="date" :value="form.deadlineDate" @change="onDateChange">
							<view class="picker-box">{{ form.deadlineDate || '选择日期' }}</view>
						</picker>
					</view>
					<view class="field half">
						<text class="label">截止时间</text>
						<picker mode="time" :value="form.deadlineTime" @change="onTimeChange">
							<view class="picker-box">{{ form.deadlineTime || '选择时间' }}</view>
						</picker>
					</view>
				</view>

				<view class="field">
					<text class="label">提醒时间</text>
					<view class="reminder-row">
						<input class="reminder-input" type="number" v-model="form.reminderOffsetHours" placeholder="23" maxlength="3" />
						<text class="reminder-unit">截止前小时提醒</text>
					</view>
				</view>

				<view class="field">
					<text class="label">{{ hasFormAttachment ? '备注' : '作业内容' }}</text>
					<textarea class="note" v-model="form.note" :placeholder="hasFormAttachment ? '例如：第 3 章习题、需要提交实验报告' : '请输入老师布置的作业内容'" maxlength="200" />
				</view>

				<button class="save-btn" @click="saveHomework">保存修改</button>
			</view>
		</view>


	</view>
</template>

<script>
import { 
	setHomeworkReminder, 
	cancelHomeworkReminder,
	checkAndSetReminders,
	resetNotificationStatus
} from '@/utils/notification.js'

const HOMEWORK_KEY = 'homework_list'
const SUBJECT_KEY = 'subject_list'
const DEFAULT_DEADLINE_OFFSET_KEY = 'default_deadline_offset_hours'
const DEFAULT_DEADLINE_OFFSET_HOURS = 24
const DEFAULT_REMINDER_OFFSET_KEY = 'default_reminder_offset_hours'
const DEFAULT_REMINDER_OFFSET_HOURS = 23
const DEFAULT_SUBJECTS = ['高等数学', '大学英语', '程序设计', '数据结构', '线性代数']
const HOMEWORK_LOAD_BATCH_SIZE = 30
const HOMEWORK_LOAD_INTERVAL = 90


export default {
	data() {
		return {
			homeworkList: [],
			subjectList: [],
			selectedSubject: '全部',
			selectedStatus: 'all',
			showForm: false,
			newSubjectName: '',
			touchStartX: 0,
			touchStartY: 0,
			touchingId: '',
			swipeOffsetX: 0,
			isHorizontalSwiping: false,
			suppressNextClick: false,
			completingId: '',
			completeTimer: null,
			longPressTriggered: false,
			editingId: '',
			form: this.createEmptyForm(),
			showImportForm: false,
			importCode: '',
			lastCopiedCode: '',
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
		}
	},
	computed: {
		subjectNames() {
			return this.subjectList.map(item => item.name)
		},
		subjectFilterOptions() {
			const subjects = this.homeworkList.map(item => item.subject).filter(Boolean)
			return ['全部', ...new Set([...this.subjectNames, ...subjects])]
		},
		filteredHomework() {
			const subjectFiltered = this.selectedSubject === '全部'
				? this.homeworkList
				: this.homeworkList.filter(item => item.subject === this.selectedSubject)

			if (this.selectedStatus === 'pending') {
				return subjectFiltered.filter(item => !item.completed)
			}
			if (this.selectedStatus === 'urgent') {
				return subjectFiltered.filter(item => !item.completed && this.isUrgent(item))
			}
			if (this.selectedStatus === 'completed') {
				return subjectFiltered.filter(item => item.completed)
			}
			return subjectFiltered
		},
		sortedHomework() {
			return [...this.filteredHomework].sort((a, b) => {
				if (a.completed !== b.completed) {
					return a.completed ? 1 : -1
				}

				if (!a.completed && !b.completed) {
					return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
				}

				return new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
			})
		},
		visibleHomework() {
			return this.sortedHomework.slice(0, this.visibleHomeworkCount)
		},
		hasMoreHomework() {
			return this.visibleHomeworkCount < this.sortedHomework.length
		},
		filterSummary() {
			const statusTextMap = {
				all: '',
				pending: '未完成',
				urgent: '临近截止',
				completed: '已完成'
			}
			const subjectText = this.selectedSubject === '全部' ? '全部' : this.selectedSubject
			const statusText = statusTextMap[this.selectedStatus]
			return `${subjectText}${statusText ? ` · ${statusText}` : ''} · ${this.filteredHomework.length} 条`
		},
		hasFormAttachment() {
			return Boolean(this.form.imagePaths.length || this.form.audios.length)
		},
		emptyTitle() {
			const statusTextMap = {
				all: '作业',
				pending: '未完成作业',
				urgent: '临近截止作业',
				completed: '已完成作业'
			}
			const prefix = this.selectedSubject === '全部' ? '暂无' : `暂无${this.selectedSubject}`
			return `${prefix}${statusTextMap[this.selectedStatus]}`
		},
		emptyTip() {
			if (this.selectedStatus !== 'all') return '点击上方状态卡片可切换筛选范围'
			return this.selectedSubject === '全部' ? '点击"记录作业"标签，把黑板上的作业保存下来' : '切换其他学科，或去记录新的作业'
		},
		pendingCount() {
			return this.homeworkList.filter(item => !item.completed).length
		},
		completedCount() {
			return this.homeworkList.filter(item => item.completed).length
		},
		urgentCount() {
			return this.homeworkList.filter(item => !item.completed && this.isUrgent(item)).length
		}
	},
	onLoad(options = {}) {
		this.loadSubjects()
		this.loadHomework()
		this.initRecorder()
		this.handleSharedHomeworkOptions(options)
	},
	onShareAppMessage() {
		const shareCode = this.buildShareCode()
		return {
			title: `我分享了 ${this.homeworkList.length} 条作业给你`,
			path: `/pages/view/view?shareCode=${shareCode}`,
			imageUrl: '/static/logo.png'
		}
	},
	onShow() {
		this.loadHomework()
		this.checkHomeworkReminders()
		this.playCardEnterAnimation()
	},
	onUnload() {
		if (this.isRecording) {
			this.cancelFormRecord()
		}
		if (this.completeTimer) {
			clearTimeout(this.completeTimer)
			this.completeTimer = null
		}
		this.clearCardEnterTimer()
		this.clearHomeworkLoadTimer()
	},
	onPageScroll(event) {
		const scrollTop = event.scrollTop || 0
		this.lastScrollTop = scrollTop
		if (scrollTop > 80 && !this.isTopCollapsed) {
			this.isTopCollapsed = true
			return
		}

		this.expandTopPanelAtTop(scrollTop)
	},
	onReachBottom() {
		this.loadMoreHomework()
	},
	methods: {
		onPageTouchStart(event) {
			this.pageTouchStartY = event.touches && event.touches[0] ? event.touches[0].clientY : 0
			this.isPullingDown = false
		},
		onPageTouchMove(event) {
			const currentY = event.touches && event.touches[0] ? event.touches[0].clientY : 0
			this.isPullingDown = currentY - this.pageTouchStartY > 12
			this.expandTopPanelAtTop(this.lastScrollTop)
		},
		onPageTouchEnd() {
			if (this.touchingId) {
				this.resetSwipeState()
			}
		},
		expandTopPanelAtTop(scrollTop) {
			if (scrollTop <= 0 && this.isTopCollapsed && this.isPullingDown) {
				this.isTopCollapsed = false
				this.isPullingDown = false
			}
		},
		expandTopPanel() {
			this.isTopCollapsed = false
		},
		openImportForm() {
			this.showShareMenu = false
			this.showImportForm = true
		},
		checkHomeworkReminders() {
			checkAndSetReminders(this.homeworkList)
		},
		startHomeworkLoading(reset = false) {
			this.clearHomeworkLoadTimer()
			const total = this.sortedHomework.length
			if (!total) {
				this.visibleHomeworkCount = 0
				this.loadBatchTarget = 0
				this.isLoadingHomework = false
				return
			}

			if (reset) {
				this.visibleHomeworkCount = 0
			}

			const nextTarget = Math.min(total, this.visibleHomeworkCount + HOMEWORK_LOAD_BATCH_SIZE)
			this.loadBatchTarget = nextTarget
			this.isLoadingHomework = this.visibleHomeworkCount < this.loadBatchTarget
			this.loadNextHomeworkItem()
		},
		loadNextHomeworkItem() {
			if (this.visibleHomeworkCount >= this.loadBatchTarget || this.visibleHomeworkCount >= this.sortedHomework.length) {
				this.isLoadingHomework = false
				this.clearHomeworkLoadTimer()
				return
			}

			this.visibleHomeworkCount += 1
			this.homeworkLoadTimer = setTimeout(() => {
				this.loadNextHomeworkItem()
			}, HOMEWORK_LOAD_INTERVAL)
		},
		loadMoreHomework() {
			if (this.isLoadingHomework || !this.hasMoreHomework) return
			this.startHomeworkLoading(false)
		},
		resetHomeworkLoading() {
			this.startHomeworkLoading(true)
		},
		clearHomeworkLoadTimer() {
			if (this.homeworkLoadTimer) {
				clearTimeout(this.homeworkLoadTimer)
				this.homeworkLoadTimer = null
			}
		},
		playCardEnterAnimation() {
			this.clearCardEnterTimer()
			this.cardEnterActive = false
			this.$nextTick(() => {
				if (!this.visibleHomework.length) return
				this.cardEnterActive = true
				const visibleCount = Math.min(this.visibleHomework.length, 8)
				this.cardEnterTimer = setTimeout(() => {
					this.cardEnterActive = false
					this.cardEnterTimer = null
				}, 520 + visibleCount * 70)
			})
		},
		clearCardEnterTimer() {
			if (this.cardEnterTimer) {
				clearTimeout(this.cardEnterTimer)
				this.cardEnterTimer = null
			}
		},
		getCardStyle(item, index) {
			const styles = []
			if (this.cardEnterActive) {
				const delay = Math.min(index, 8) * 70
				styles.push(`animation-delay: ${delay}ms`)
			}
			if (this.touchingId === item.id && this.swipeOffsetX) {
				const progress = Math.min(Math.abs(this.swipeOffsetX) / 120, 1)
				const rotate = Math.max(Math.min(this.swipeOffsetX / 28, 4), -4)
				styles.push(`transform: translateX(${this.swipeOffsetX}px) scale(${1 + progress * 0.015}) rotate(${rotate}deg)`)
				styles.push(`--swipe-progress: ${progress}`)
			}
			return styles.join(';')
		},
		getSwipeActionClass(item) {
			if (this.touchingId !== item.id || !this.swipeOffsetX) return ''
			const isActionable = (!item.completed && this.swipeOffsetX > 0) || (item.completed && this.swipeOffsetX < 0)
			return [this.swipeOffsetX > 0 ? 'swipe-right' : 'swipe-left', Math.abs(this.swipeOffsetX) >= 80 ? 'swipe-ready' : '', isActionable ? 'swipe-actionable' : 'swipe-disabled'].filter(Boolean).join(' ')
		},
		getSwipeActionIcon(item) {
			if (!item.completed && this.swipeOffsetX > 0) return Math.abs(this.swipeOffsetX) >= 80 ? '✓' : '→'
			if (item.completed && this.swipeOffsetX < 0) return Math.abs(this.swipeOffsetX) >= 80 ? '↺' : '←'
			return '·'
		},
		getSwipeActionText(item) {
			if (!item.completed && this.swipeOffsetX > 0) return Math.abs(this.swipeOffsetX) >= 80 ? '松手完成' : '右滑完成'
			if (item.completed && this.swipeOffsetX < 0) return Math.abs(this.swipeOffsetX) >= 80 ? '松手恢复' : '左滑恢复'
			return item.completed ? '已完成，左滑恢复' : '未完成，右滑完成'
		},
		initRecorder() {
			if (this.recorderManager || typeof uni.getRecorderManager !== 'function') return
			this.recorderManager = uni.getRecorderManager()
			this.recorderManager.onStop(async res => {
				const duration = Math.max(1, Math.round(((res.duration || 0) / 1000) || ((Date.now() - this.recordStartTime) / 1000)))
				const canceled = this.recordCanceled
				this.isRecording = false
				this.recordCanceled = false
				if (!canceled && res.tempFilePath) {
					const audioPath = await this.saveAudioFile(res.tempFilePath)
					if (!audioPath) return
					this.form.audios.push({
						path: audioPath,
						duration
					})
					this.syncLegacyAttachmentFields()
					uni.showToast({ title: '录音已添加', icon: 'success' })
				}
			})
			this.recorderManager.onError(() => {
				this.isRecording = false
				this.recordCanceled = false
				uni.showToast({ title: '录音失败，请重试', icon: 'none' })
			})
		},
		chooseFormImage() {
			uni.chooseImage({
				count: 9,
				sourceType: ['album', 'camera'],
				success: res => {
					this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || [])
					this.syncLegacyAttachmentFields()
				},
				fail: () => {
					uni.showToast({ title: '未选择图片', icon: 'none' })
				}
			})
		},
		startFormRecord() {
			this.initRecorder()
			if (!this.recorderManager || this.isRecording) return
			this.isRecording = true
			this.recordCanceled = false
			this.recordStartTime = Date.now()
			this.recorderManager.start({
				duration: 60000,
				format: 'mp3'
			})
		},
		stopFormRecord() {
			if (!this.recorderManager || !this.isRecording) return
			this.recorderManager.stop()
		},
		toggleFormRecord() {
			if (this.isRecording) {
				this.stopFormRecord()
				return
			}
			this.startFormRecord()
		},
		cancelFormRecord() {
			if (this.recorderManager && this.isRecording) {
				this.recordCanceled = true
				this.recorderManager.stop()
			}
			this.isRecording = false
		},
		async saveAudioFile(tempFilePath) {
			if (!tempFilePath) {
				uni.showToast({ title: '录音文件无效，请重试', icon: 'none' })
				return ''
			}
			if (typeof uni.saveFile !== 'function') {
				return tempFilePath
			}

			try {
				const res = await new Promise((resolve, reject) => {
					uni.saveFile({
						tempFilePath,
						success: resolve,
						fail: reject
					})
				})
				const savedFilePath = res.savedFilePath || res.filePath || ''
				if (!savedFilePath) throw new Error('empty savedFilePath')
				return savedFilePath
			} catch (e) {
				console.warn('录音文件保存失败：', e)
				uni.showToast({ title: '录音保存失败，请重试', icon: 'none' })
				return ''
			}
		},
		createEmptyForm() {
			const deadline = this.getDefaultDeadlineDate()
			return {
				subject: '',
				deadlineDate: this.formatDate(deadline),
				deadlineTime: this.formatTime(deadline),
				reminderOffsetHours: `${this.getDefaultReminderOffsetHours()}`,
				imagePaths: [],
				audios: [],
				imagePath: '',
				audioPath: '',
				audioDuration: 0,
				note: ''
			}
		},
		loadSubjects() {
			const saved = uni.getStorageSync(SUBJECT_KEY)
			if (Array.isArray(saved) && saved.length) {
				this.subjectList = saved
				return
			}

			this.subjectList = DEFAULT_SUBJECTS.map(name => ({
				id: this.createId(),
				name,
				createdAt: new Date().toISOString()
			}))
			this.saveSubjects()
		},
		loadHomework() {
			const saved = uni.getStorageSync(HOMEWORK_KEY)
			this.homeworkList = Array.isArray(saved) ? saved.map(this.normalizeHomeworkItem) : []
			this.ensureSelectedSubject()
			this.resetHomeworkLoading()
		},
		ensureSelectedSubject() {
			if (this.selectedSubject === '全部') return
			if (!this.subjectFilterOptions.includes(this.selectedSubject)) {
				this.selectedSubject = '全部'
			}
		},
		selectSubject(subject) {
			this.selectedSubject = subject
			this.resetHomeworkLoading()
		},
		selectStatus(status) {
			this.selectedStatus = this.selectedStatus === status ? 'all' : status
			this.resetHomeworkLoading()
		},
		normalizeHomeworkItem(item) {
			const imagePaths = Array.isArray(item.imagePaths) ? item.imagePaths : (item.imagePath ? [item.imagePath] : [])
			const audios = Array.isArray(item.audios) ? item.audios : (item.audioPath ? [{ path: item.audioPath, duration: item.audioDuration || 1 }] : [])
			const firstAudio = audios[0] || {}
			return {
				...item,
				imagePaths,
				audios,
				imagePath: imagePaths[0] || '',
				audioPath: firstAudio.path || '',
				audioDuration: firstAudio.duration || 0
			}
		},
		getImagePaths(item) {
			return Array.isArray(item.imagePaths) ? item.imagePaths : (item.imagePath ? [item.imagePath] : [])
		},
		getAudios(item) {
			return Array.isArray(item.audios) ? item.audios : (item.audioPath ? [{ path: item.audioPath, duration: item.audioDuration || 1 }] : [])
		},
		syncLegacyAttachmentFields() {
			const firstAudio = this.form.audios[0] || {}
			this.form.imagePath = this.form.imagePaths[0] || ''
			this.form.audioPath = firstAudio.path || ''
			this.form.audioDuration = firstAudio.duration || 0
		},
		removeFormImageAttachment(index) {
			this.form.imagePaths.splice(index, 1)
			this.syncLegacyAttachmentFields()
		},
		removeFormAudioAttachment(index) {
			this.form.audios.splice(index, 1)
			this.syncLegacyAttachmentFields()
		},
		saveSubjects() {
			uni.setStorageSync(SUBJECT_KEY, this.subjectList)
		},
		saveHomeworkList() {
			uni.setStorageSync(HOMEWORK_KEY, this.homeworkList)
		},
		buildSharePayload() {
			return {
				version: 1,
				sharedAt: new Date().toISOString(),
				items: this.homeworkList.map(item => this.createShareableHomework(item))
			}
		},
		buildShareCode() {
			return encodeURIComponent(JSON.stringify(this.buildSharePayload()))
		},
		safeDecodeShareCode(code) {
			const raw = `${code || ''}`.trim()
			try {
				return decodeURIComponent(raw)
			} catch (e) {
				return raw
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
				note: item.note || '',
				completed: !!item.completed,
				completedAt: item.completedAt || null,
				createdAt: item.createdAt || new Date().toISOString()
			}
		},
		getShareItemsFromCode(code) {
			const decoded = this.safeDecodeShareCode(code)
			const parsed = JSON.parse(decoded)
			if (Array.isArray(parsed)) return parsed
			if (parsed && Array.isArray(parsed.items)) return parsed.items
			return []
		},
		createImportedHomework(item) {
			const normalized = this.normalizeHomeworkItem({
				...item,
				id: item.id || this.createId(),
				reminderOffsetHours: Number(item.reminderOffsetHours) || DEFAULT_REMINDER_OFFSET_HOURS,
				imagePaths: [],
				audios: [],
				imagePath: '',
				audioPath: '',
				audioDuration: 0,
				completed: !!item.completed,
				completedAt: item.completedAt || null,
				createdAt: item.createdAt || new Date().toISOString()
			})
			if (!normalized.deadline && normalized.deadlineDate && normalized.deadlineTime) {
				normalized.deadline = `${normalized.deadlineDate}T${normalized.deadlineTime}:00`
			}
			return normalized
		},
		isHomeworkImportable(item) {
			return item && item.subject && item.deadline && (item.note || item.subject)
		},
		syncImportedSubjects(items) {
			let changed = false
			items.forEach(item => {
				const name = item && item.subject ? `${item.subject}`.trim() : ''
				if (!name || this.subjectList.some(subject => subject.name === name)) return
				this.subjectList.unshift({
					id: this.createId(),
					name,
					createdAt: new Date().toISOString()
				})
				changed = true
			})
			if (changed) this.saveSubjects()
		},
		handleSharedHomeworkOptions(options = {}) {
			const shareCode = options.shareCode || ''
			if (!shareCode) return
			setTimeout(() => {
				this.importShareCode(shareCode, { fromNativeShare: true })
			}, 300)
		},
		copyShareCode() {
			const shareCode = this.buildShareCode()
			uni.setClipboardData({
				data: shareCode,
				success: () => {
					this.showShareMenu = false
					this.lastCopiedCode = shareCode
					uni.showToast({ title: '分享码已复制', icon: 'success' })
				}
			})
		},
		isValidShareCode(code) {
			try {
				return this.getShareItemsFromCode(code).some(item => this.isHomeworkImportable(item))
			} catch (e) {
				return false
			}
		},
		manualImport() {
			if (!this.importCode.trim()) {
				uni.showToast({ title: '请输入分享码', icon: 'none' })
				return
			}
			this.importShareCode(this.importCode.trim())
		},
		async pasteFromClipboard() {
			try {
				const res = await uni.getClipboardData()
				const data = res.data || res[1]?.data || ''
				if (!data) {
					uni.showToast({ title: '剪贴板为空', icon: 'none' })
					return
				}
				
				if (this.isValidShareCode(data)) {
					this.importShareCode(data)
				} else {
					this.importCode = data
					uni.showToast({ title: '已粘贴，请确认分享码', icon: 'none' })
				}
			} catch (e) {
				uni.showToast({ title: '读取剪贴板失败', icon: 'none' })
			}
		},
		importShareCode(code, options = {}) {
			try {
				const importedList = this.getShareItemsFromCode(code)
				
				if (!Array.isArray(importedList) || !importedList.length) {
					uni.showToast({ title: '无效的分享内容', icon: 'none' })
					return
				}
				
				const existingKeys = new Set(this.homeworkList.map(item => `${item.subject}|${item.deadline}|${item.note || ''}`))
				let newCount = 0
				
				importedList.forEach(item => {
					if (!this.isHomeworkImportable(item)) return
					const imported = this.createImportedHomework(item)
					const key = `${imported.subject}|${imported.deadline}|${imported.note || ''}`
					if (!existingKeys.has(key)) {
						imported.id = this.createId()
						existingKeys.add(key)
						this.homeworkList.push(imported)
						newCount++
					}
				})
				
				if (newCount > 0) {
					this.syncImportedSubjects(importedList)
					this.saveHomeworkList()
					this.homeworkList.forEach(item => {
						if (!item.completed) resetNotificationStatus(item.id)
					})
					this.checkHomeworkReminders()
					this.resetHomeworkLoading()
					this.showImportForm = false
					this.importCode = ''
					uni.showToast({ title: `成功导入 ${newCount} 条作业`, icon: 'success' })
				} else {
					uni.showToast({ title: options.fromNativeShare ? '分享作业已存在' : '没有新作业可导入', icon: 'none' })
				}
			} catch (e) {
				uni.showToast({ title: '分享内容格式错误', icon: 'none' })
			}
		},
		onSubjectChange(event) {
			this.form.subject = this.subjectNames[event.detail.value]
		},
		onDateChange(event) {
			this.form.deadlineDate = event.detail.value
		},
		onTimeChange(event) {
			this.form.deadlineTime = event.detail.value
		},
		addSubject() {
			const name = this.newSubjectName.trim()
			if (!name) {
				uni.showToast({ title: '请输入学科名称', icon: 'none' })
				return
			}

			const exists = this.subjectList.some(item => item.name === name)
			if (!exists) {
				this.subjectList.unshift({
					id: this.createId(),
					name,
					createdAt: new Date().toISOString()
				})
				this.saveSubjects()
			}

			this.form.subject = name
			this.newSubjectName = ''
			uni.showToast({ title: exists ? '已选择该学科' : '学科已新建', icon: 'none' })
		},
		editHomework(item) {
			if (this.suppressNextClick) {
				this.suppressNextClick = false
				return
			}
			if (this.completingId) return
			
			const normalized = this.normalizeHomeworkItem(item)
			this.editingId = normalized.id
			this.form = {
				subject: normalized.subject,
				deadlineDate: normalized.deadlineDate || '',
				deadlineTime: normalized.deadlineTime || '',
				imagePaths: [...normalized.imagePaths],
				audios: normalized.audios.map(audio => ({ ...audio })),
				imagePath: normalized.imagePath || '',
				audioPath: normalized.audioPath || '',
				audioDuration: normalized.audioDuration || 0,
				note: normalized.note || ''
			}
			this.showForm = true
		},
		async saveHomework() {
			if (!this.hasFormAttachment && !this.form.note.trim()) {
				uni.showToast({ title: '请输入作业内容', icon: 'none' })
				return
			}
			if (!this.form.subject) {
				uni.showToast({ title: '请选择学科', icon: 'none' })
				return
			}
			if (!this.form.deadlineDate || !this.form.deadlineTime) {
				uni.showToast({ title: '请选择截止时间', icon: 'none' })
				return
			}

			const deadline = `${this.form.deadlineDate}T${this.form.deadlineTime}:00`
			const reminderOffsetHours = Number(this.form.reminderOffsetHours)
			if (!Number.isInteger(reminderOffsetHours) || reminderOffsetHours <= 0 || reminderOffsetHours > 168) {
				uni.showToast({ title: '提醒时间需为 1-168 小时', icon: 'none' })
				return
			}
			
			if (this.editingId) {
				const index = this.homeworkList.findIndex(item => item.id === this.editingId)
				if (index !== -1) {
					this.syncLegacyAttachmentFields()
					this.homeworkList[index] = {
						...this.homeworkList[index],
						subject: this.form.subject,
						deadline,
						deadlineDate: this.form.deadlineDate,
						deadlineTime: this.form.deadlineTime,
						reminderOffsetHours,
						imagePaths: [...this.form.imagePaths],
						audios: this.form.audios.map(audio => ({ ...audio })),
						imagePath: this.form.imagePath,
						audioPath: this.form.audioPath,
						audioDuration: this.form.audioDuration,
						note: this.form.note.trim()
					}
					this.saveHomeworkList()
					this.resetHomeworkLoading()
					resetNotificationStatus(this.homeworkList[index].id)
					setHomeworkReminder(this.homeworkList[index])
				}
			}
			
			this.resetForm()
			uni.showToast({ title: '已更新', icon: 'success' })
		},
		resetForm() {
			if (this.isRecording) {
				this.cancelFormRecord()
			}
			this.showForm = false
			this.editingId = ''
			this.newSubjectName = ''
			this.form = this.createEmptyForm()
		},
		onTouchStart(event, id) {
			if (this.completingId) return
			const touch = event.changedTouches[0]
			this.touchStartX = touch.clientX
			this.touchStartY = touch.clientY
			this.touchingId = id
			this.swipeOffsetX = 0
			this.isHorizontalSwiping = false
			this.longPressTriggered = false
		},
		onTouchMove(event, id) {
			if (this.completingId || this.touchingId !== id || this.longPressTriggered) return
			const touch = event.changedTouches[0]
			const distanceX = touch.clientX - this.touchStartX
			const distanceY = touch.clientY - this.touchStartY
			if (!this.isHorizontalSwiping && Math.abs(distanceX) < 10) return
			if (!this.isHorizontalSwiping && Math.abs(distanceY) > Math.abs(distanceX)) return

			this.isHorizontalSwiping = true
			const maxOffset = 150
			const absDistance = Math.abs(distanceX)
			const dampedDistance = absDistance > maxOffset ? maxOffset + (absDistance - maxOffset) * 0.25 : absDistance
			this.swipeOffsetX = Math.round((distanceX < 0 ? -1 : 1) * dampedDistance)
		},
		onTouchEnd(event, item) {
			if (this.completingId || this.touchingId !== item.id || this.longPressTriggered) {
				this.resetSwipeState()
				return
			}
			const endX = event.changedTouches[0].clientX
			const distanceX = endX - this.touchStartX
			const shouldComplete = !item.completed && distanceX > 80
			const shouldRestore = item.completed && distanceX < -80
			if (this.isHorizontalSwiping || Math.abs(distanceX) > 10) {
				this.suppressNextClick = true
				setTimeout(() => {
					this.suppressNextClick = false
				}, 260)
			}
			this.resetSwipeState(() => {
				if (shouldComplete) {
					this.playCompleteAnimation(item.id)
				} else if (shouldRestore) {
					this.restoreHomework(item.id)
				}
			})
		},
		onTouchCancel() {
			this.resetSwipeState()
		},
		resetSwipeState(callback) {
			this.touchStartX = 0
			this.touchStartY = 0
			this.touchingId = ''
			this.swipeOffsetX = 0
			this.isHorizontalSwiping = false
			if (typeof callback === 'function') {
				setTimeout(callback, 220)
			}
		},
		onLongPress(item) {
			this.longPressTriggered = true
			this.confirmDeleteHomework(item)
		},
		playCompleteAnimation(id) {
			this.completingId = id
			if (this.completeTimer) {
				clearTimeout(this.completeTimer)
			}
			this.completeTimer = setTimeout(() => {
				this.markCompleted(id)
				this.completingId = ''
				this.completeTimer = null
			}, 420)
		},
		markCompleted(id) {
			this.homeworkList = this.homeworkList.map(item => {
				if (item.id !== id) return item
				cancelHomeworkReminder(id)
				return {
					...item,
					completed: true,
					completedAt: new Date().toISOString()
				}
			})
			this.saveHomeworkList()
			this.resetHomeworkLoading()
			uni.showToast({ title: '已标记完成', icon: 'success' })
		},
		restoreHomework(id) {
			this.homeworkList = this.homeworkList.map(item => {
				if (item.id !== id) return item
				const restoredItem = {
					...item,
					completed: false,
					completedAt: null
				}
				resetNotificationStatus(restoredItem.id)
				setHomeworkReminder(restoredItem)
				return restoredItem
			})
			this.saveHomeworkList()
			this.resetHomeworkLoading()
			uni.showToast({ title: '已恢复未完成', icon: 'none' })
		},
		confirmDeleteHomework(item) {
			uni.showModal({
				title: '删除作业',
				content: `确定删除"${item.subject}"这条作业吗？`,
				confirmText: '删除',
				confirmColor: '#ef4444',
				success: res => {
					if (res.confirm) {
						this.deleteHomework(item.id)
					}
				}
			})
		},
		deleteHomework(id) {
			cancelHomeworkReminder(id)
			this.homeworkList = this.homeworkList.filter(item => item.id !== id)
			this.saveHomeworkList()
			this.resetHomeworkLoading()
			uni.showToast({ title: '已删除', icon: 'success' })
		},
		playAudio(path) {
			if (!path) return
			const audio = uni.createInnerAudioContext()
			audio.src = path
			audio.onEnded(() => audio.destroy())
			audio.onError(() => {
				audio.destroy()
				uni.showToast({ title: '语音播放失败', icon: 'none' })
			})
			audio.play()
		},
		previewImage(path, paths) {
			if (!path) return
			uni.previewImage({ urls: paths && paths.length ? paths : [path], current: path })
		},
		getStatusText(item) {
			if (item.completed) return '已完成'
			if (this.isOverdue(item)) return '已逾期'
			if (this.isUrgent(item)) return '即将截止'
			return '未完成'
		},
		getDeadlineClass(item) {
			if (this.isOverdue(item)) return 'status-overdue'
			if (this.isUrgent(item)) return 'status-urgent'
			return ''
		},
		isUrgent(item) {
			const diff = new Date(item.deadline).getTime() - Date.now()
			return diff > 0 && diff <= 24 * 60 * 60 * 1000
		},
		isOverdue(item) {
			return new Date(item.deadline).getTime() < Date.now()
		},
		formatDeadline(value) {
			if (!value) return '未设置'
			return value.replace('T', ' ').slice(0, 16)
		},
		formatDate(date) {
			const year = date.getFullYear()
			const month = `${date.getMonth() + 1}`.padStart(2, '0')
			const day = `${date.getDate()}`.padStart(2, '0')
			return `${year}-${month}-${day}`
		},
		formatTime(date) {
			const hour = `${date.getHours()}`.padStart(2, '0')
			const minute = `${date.getMinutes()}`.padStart(2, '0')
			return `${hour}:${minute}`
		},
		getDefaultDeadlineOffsetHours() {
			const saved = Number(uni.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY))
			return saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS
		},
		getDefaultReminderOffsetHours() {
			const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY))
			return saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS
		},
		getDefaultDeadlineDate() {
			const deadline = new Date()
			deadline.setHours(deadline.getHours() + this.getDefaultDeadlineOffsetHours())
			return deadline
		},
		createId() {
			return `${Date.now()}_${Math.random().toString(16).slice(2)}`
		}
	}
}
</script>

<style>
.page {
	min-height: 100vh;
	padding: 28rpx 28rpx 60rpx;
	box-sizing: border-box;
	background: #f4f7fb;
	padding-bottom: 120rpx;
}

.top-panel {
	position: relative;
	overflow: hidden;
	max-height: 720rpx;
	margin-bottom: 0;
	transform-origin: top center;
	transition: max-height 0.34s cubic-bezier(0.22, 1, 0.36, 1), margin-bottom 0.34s cubic-bezier(0.22, 1, 0.36, 1);
	will-change: max-height;
}

.top-panel.is-collapsed {
	max-height: 148rpx;
	margin-bottom: 14rpx;
}

.collapsed-bar {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	height: 0;
	margin-top: 0;
	opacity: 0;
	transform: translateY(-18rpx) scale(0.96);
	transition: height 0.3s cubic-bezier(0.22, 1, 0.36, 1), margin-top 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	pointer-events: none;
	will-change: height, opacity, transform;
}

.top-panel.is-collapsed .collapsed-bar {
	height: 76rpx;
	margin-top: 60rpx;
	opacity: 1;
	transform: translateY(0) scale(1);
	pointer-events: auto;
}

.expand-icon {
	width: 40rpx;
	height: 40rpx;
	transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.top-panel.is-collapsed .expand-icon {
	transform: rotate(180deg);
}

.collapsed-title {
	font-size: 24rpx;
	font-weight: 700;
	color: #6b7280;
}

.top-panel.is-collapsed .custom-nav,
.top-panel.is-collapsed .import-form,
.top-panel.is-collapsed .stats,
.top-panel.is-collapsed .filter-card {
	opacity: 0;
	transform: translateY(-28rpx) scale(0.98);
	pointer-events: none;
}

.custom-nav {
	padding: 44rpx 0 28rpx;
	text-align: center;
	transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), padding 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	will-change: opacity, transform;
}

.import-form,
.stats,
.filter-card {
	transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	will-change: opacity, transform;
}

.nav-title {
	font-size: 38rpx;
	font-weight: 800;
	color: #2563eb;
}

.nav-share-wrap {
	position: absolute;
	top: 42rpx;
	right: 0;
	z-index: 20;
}

.nav-share-btn {
	width: 88rpx;
	height: 56rpx;
	line-height: 56rpx;
	margin: 0;
	padding: 0;
	border-radius: 999rpx;
	background: #eef2ff;
	color: #3155d4;
	font-size: 24rpx;
	font-weight: 700;
}

.share-menu {
	position: absolute;
	top: 72rpx;
	right: 0;
	width: 260rpx;
	padding: 18rpx;
	border-radius: 24rpx;
	background: #ffffff;
	box-shadow: 0 16rpx 42rpx rgba(31, 45, 61, 0.16);
}

.share-menu::before {
	content: '';
	position: absolute;
	top: -10rpx;
	right: 34rpx;
	width: 20rpx;
	height: 20rpx;
	background: #ffffff;
	transform: rotate(45deg);
}

.share-menu-tip {
	display: block;
	margin-bottom: 12rpx;
	font-size: 22rpx;
	color: #6b7280;
	text-align: left;
}

.share-menu-item {
	width: 100%;
	height: 64rpx;
	line-height: 64rpx;
	margin: 12rpx 0 0;
	padding: 0 16rpx;
	border-radius: 18rpx;
	background: #f8fafc;
	color: #1f2937;
	font-size: 24rpx;
	font-weight: 700;
	text-align: center;
}

.share-menu-item.primary {
	background: #2563eb;
	color: #ffffff;
}

.import-form {
	margin-top: 20rpx;
}

.import-textarea {
	box-sizing: border-box;
	width: 100%;
	height: 200rpx;
	margin-top: 24rpx;
	padding: 18rpx 22rpx;
	border-radius: 18rpx;
	background: #f8fafc;
	font-size: 28rpx;
	color: #111827;
}

.import-btns {
	display: flex;
	gap: 16rpx;
	margin-top: 20rpx;
}

.paste-btn,
.import-btns .save-btn {
	flex: 1;
	margin-top: 0;
}

.paste-btn {
	padding: 20rpx;
	border-radius: 18rpx;
	background: #f0f9ff;
	color: #2563eb;
	font-size: 28rpx;
	font-weight: 500;
	text-align: center;
	border: 2rpx solid #bfdbfe;
}

.stats {
	display: flex;
	gap: 18rpx;
	margin: 28rpx 0;
}

.stat-card {
	flex: 1;
	padding: 24rpx 18rpx;
	border: 3rpx solid transparent;
	border-radius: 24rpx;
	background: #fff;
	box-shadow: 0 10rpx 28rpx rgba(31, 45, 61, 0.06);
	transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.stat-card.active {
	border-color: #2979ff;
	box-shadow: 0 14rpx 34rpx rgba(41, 121, 255, 0.18);
	transform: translateY(-4rpx);
}

.stat-card.warn {
	background: #fff7ed;
}

.stat-card.done {
	background: #f0fdf4;
}

.stat-num {
	display: block;
	font-size: 40rpx;
	font-weight: 800;
	color: #1f2937;
}

.stat-label {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #6b7280;
}

.modal-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 99;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 80rpx 32rpx calc(120rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
	background: rgba(15, 23, 42, 0.38);
}

.edit-modal-card {
	width: 100%;
	max-height: 78vh;
	margin: 0;
	overflow-y: auto;
	box-shadow: 0 30rpx 80rpx rgba(15, 23, 42, 0.22);
}

.form-card {
	padding: 28rpx;
	margin-bottom: 34rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.form-title-row,
.section-title-row,
.card-top,
.quick-subject,
.date-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.form-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.form-close,
.section-tip {
	font-size: 24rpx;
	color: #6b7280;
}

.attachment-edit-actions {
	display: flex;
	gap: 16rpx;
	margin: 20rpx 0 4rpx;
}

.attachment-add-btn {
	flex: 1;
	height: 68rpx;
	line-height: 68rpx;
	border-radius: 999rpx;
	background: #eef6ff;
	color: #2979ff;
	font-size: 25rpx;
	font-weight: 700;
	text-align: center;
}

.attachment-add-btn.recording {
	background: #fee2e2;
	color: #ef4444;
}

.remove-attachment {
	position: absolute;
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	box-shadow: 0 6rpx 16rpx rgba(239, 68, 68, 0.32);
}

.form-preview-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-top: 24rpx;
}

.preview-tile {
	position: relative;
	width: 160rpx;
	height: 160rpx;
	border-radius: 22rpx;
	flex-shrink: 0;
}

.preview {
	width: 160rpx;
	height: 160rpx;
	border-radius: 22rpx;
	background: #eef2ff;
}

.audio-preview-tile {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	background: linear-gradient(135deg, #f8fbff, #eef8ff);
}

.preview-remove {
	right: -10rpx;
	top: -10rpx;
	z-index: 2;
}

.audio-form-preview {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	background: linear-gradient(135deg, #f8fbff, #eef8ff);
}

.field {
	margin-top: 24rpx;
}

.field.half {
	width: 48%;
}

.label {
	display: block;
	margin-bottom: 12rpx;
	font-size: 25rpx;
	font-weight: 700;
	color: #374151;
}

.picker-box,
.subject-input,
.note {
	box-sizing: border-box;
	width: 100%;
	border-radius: 18rpx;
	background: #f8fafc;
	font-size: 28rpx;
	color: #111827;
}

.picker-box,
.subject-input {
	height: 82rpx;
	line-height: 82rpx;
	padding: 0 22rpx;
}

.quick-subject {
	gap: 16rpx;
	margin-top: 18rpx;
}

.subject-input {
	flex: 1;
}

.small-btn {
	width: 132rpx;
	height: 82rpx;
	line-height: 82rpx;
	margin: 0;
	border-radius: 18rpx;
	background: #111827;
	color: #fff;
	font-size: 26rpx;
}

.note {
	height: 150rpx;
	padding: 18rpx 22rpx;
}

.save-btn {
	margin-top: 28rpx;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 999rpx;
	background: #2979ff;
	color: #fff;
	font-size: 30rpx;
	font-weight: 700;
}

.filter-card {
	margin-bottom: 24rpx;
	padding: 24rpx;
	border-radius: 24rpx;
	background: #ffffff;
	box-shadow: 0 10rpx 28rpx rgba(31, 45, 61, 0.06);
}

.filter-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 18rpx;
}

.filter-title {
	font-size: 28rpx;
	font-weight: 800;
	color: #111827;
}

.filter-count {
	font-size: 24rpx;
	color: #6b7280;
}

.subject-filter-scroll {
	width: 100%;
	white-space: nowrap;
}

.subject-filter-list {
	display: inline-flex;
	gap: 14rpx;
	padding-bottom: 4rpx;
}

.filter-chip {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 112rpx;
	padding: 14rpx 24rpx;
	border-radius: 999rpx;
	background: #f3f4f6;
	color: #4b5563;
	font-size: 25rpx;
	font-weight: 700;
}

.filter-chip.active {
	background: #2979ff;
	color: #ffffff;
	box-shadow: 0 8rpx 20rpx rgba(41, 121, 255, 0.22);
}

.section-title-row {
	align-items: flex-start;
	margin: 12rpx 0 20rpx;
}

.section-subtitle {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #6b7280;
}

.section-title {
	font-size: 34rpx;
	font-weight: 800;
	color: #111827;
}

.homework-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.homework-card {
	position: relative;
	display: flex;
	overflow: hidden;
	padding: 20rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
	cursor: pointer;
	animation: homeworkCardEnter 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
	transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
	will-change: transform, opacity;
}

.homework-card.is-swiping {
	transition: opacity 0.2s ease, box-shadow 0.2s ease;
	box-shadow: 0 22rpx 48rpx rgba(31, 45, 61, 0.15);
}

.homework-card.is-swiping::before {
	position: absolute;
	inset: 0;
	content: '';
	opacity: calc(0.18 + var(--swipe-progress, 0) * 0.36);
	pointer-events: none;
}

.homework-card.swipe-right::before {
	background: linear-gradient(90deg, rgba(34, 197, 94, 0.34), rgba(34, 197, 94, 0.04));
}

.homework-card.swipe-left::before {
	background: linear-gradient(270deg, rgba(59, 130, 246, 0.34), rgba(59, 130, 246, 0.04));
}

.homework-card.swipe-disabled::before {
	background: linear-gradient(90deg, rgba(148, 163, 184, 0.22), rgba(148, 163, 184, 0.04));
}

.homework-card.swipe-ready {
	box-shadow: 0 26rpx 56rpx rgba(34, 197, 94, 0.22);
}

.homework-card.swipe-left.swipe-ready {
	box-shadow: 0 26rpx 56rpx rgba(59, 130, 246, 0.2);
}

.swipe-action {
	position: absolute;
	top: 50%;
	z-index: 3;
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 12rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(17, 24, 39, 0.78);
	color: #ffffff;
	opacity: calc(0.42 + var(--swipe-progress, 0) * 0.58);
	transform: translateY(-50%) scale(calc(0.92 + var(--swipe-progress, 0) * 0.08));
	pointer-events: none;
}

.homework-card.swipe-right .swipe-action {
	left: 24rpx;
	background: #16a34a;
}

.homework-card.swipe-left .swipe-action {
	right: 24rpx;
	background: #2563eb;
}

.homework-card.swipe-disabled .swipe-action {
	background: #94a3b8;
}

.swipe-action-icon,
.swipe-action-text {
	display: block;
	font-weight: 800;
}

.swipe-action-icon {
	font-size: 30rpx;
}

.swipe-action-text {
	font-size: 24rpx;
}

.homework-card.is-entering {
	opacity: 0;
	animation: homeworkCardEnter 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.homework-card.is-completing {
	animation: completeCard 0.42s ease both;
	box-shadow: 0 18rpx 44rpx rgba(22, 163, 74, 0.22);
}

.homework-card.is-completing::after {
	position: absolute;
	inset: 0;
	content: '';
	background: linear-gradient(90deg, rgba(34, 197, 94, 0.18), rgba(240, 253, 244, 0.02));
	animation: completeGlow 0.42s ease both;
	pointer-events: none;
}

.homework-card.is-done {
	opacity: 0.56;
}

.complete-badge {
	position: absolute;
	right: 24rpx;
	top: 50%;
	z-index: 2;
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 12rpx 18rpx;
	border-radius: 999rpx;
	background: #16a34a;
	color: #ffffff;
	box-shadow: 0 10rpx 24rpx rgba(22, 163, 74, 0.24);
	transform: translateY(-50%);
	animation: completeBadge 0.42s ease both;
}

.complete-check,
.complete-text {
	display: block;
}

.complete-check {
	font-size: 28rpx;
	font-weight: 900;
}

.complete-text {
	font-size: 24rpx;
	font-weight: 700;
}

.card-attachment-scroll {
	width: 168rpx;
	flex-shrink: 0;
}

.card-attachment-row {
	display: inline-flex;
	align-items: center;
	gap: 12rpx;
}

.thumb {
	width: 168rpx;
	height: 168rpx;
	border-radius: 22rpx;
	background: #e5e7eb;
	flex-shrink: 0;
}

.audio-thumb {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	background: linear-gradient(135deg, #f8fbff, #eef8ff);
}

.audio-thumb-icon {
	width: 64rpx;
	height: 64rpx;
}

.audio-thumb-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #2979ff;
}

.audio-wave {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.audio-wave view {
	width: 12rpx;
	border-radius: 999rpx;
	background: #2979ff;
}

.audio-wave view:nth-child(1) {
	height: 42rpx;
}

.audio-wave view:nth-child(2) {
	height: 72rpx;
}

.audio-wave view:nth-child(3) {
	height: 42rpx;
}

.text-thumb {
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #eef2ff, #dbeafe);
	color: #2979ff;
	font-size: 58rpx;
	font-weight: 800;
}

.audio-note {
	display: block;
	margin-top: 12rpx;
	font-size: 25rpx;
	font-weight: 700;
	color: #2979ff;
}

.card-body {
	flex: 1;
	min-width: 0;
	margin-left: 20rpx;
}

.subject-tag {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: #eef2ff;
	color: #3155d4;
	font-size: 24rpx;
	font-weight: 700;
}

.status {
	font-size: 23rpx;
	color: #2979ff;
}

.status-urgent {
	color: #f97316;
}

.status-overdue {
	color: #ef4444;
}

.status-done {
	color: #16a34a;
}

.deadline {
	display: block;
	margin-top: 18rpx;
	font-size: 27rpx;
	font-weight: 700;
	color: #111827;
}

.card-note {
	display: block;
	margin-top: 12rpx;
	font-size: 25rpx;
	line-height: 1.45;
	color: #4b5563;
}

.muted {
	color: #9ca3af;
}

.load-more-row {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 14rpx;
	min-height: 86rpx;
	margin: 24rpx 0 8rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.72);
	color: #6b7280;
	font-size: 24rpx;
	font-weight: 700;
}

.load-more-row.is-end {
	background: transparent;
	color: #9ca3af;
}

.load-spinner {
	width: 30rpx;
	height: 30rpx;
	border: 4rpx solid #dbeafe;
	border-top-color: #2979ff;
	border-radius: 50%;
	animation: loadSpin 0.78s linear infinite;
}

.empty {
	padding: 80rpx 30rpx;
	text-align: center;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.empty-title {
	display: block;
	font-size: 34rpx;
	font-weight: 800;
	color: #111827;
}

.empty-tip {
	display: block;
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #6b7280;
}

.footer {
	margin-top: 40rpx;
	padding: 30rpx 0;
	text-align: center;
}

.footer-text {
	font-size: 24rpx;
	color: #9ca3af;
}

@keyframes loadSpin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

@keyframes homeworkCardEnter {
	0% {
		opacity: 0;
		transform: translateY(72rpx) scale(0.98);
	}
	70% {
		opacity: 1;
	}
	100% {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes completeCard {
	0% {
		transform: translateX(0) scale(1);
	}
	45% {
		transform: translateX(34rpx) scale(1.02);
	}
	100% {
		transform: translateX(0) scale(1);
	}
}

@keyframes completeGlow {
	0% {
		opacity: 0;
	}
	35% {
		opacity: 1;
	}
	100% {
		opacity: 0;
	}
}

@keyframes completeBadge {
	0% {
		opacity: 0;
		transform: translate(24rpx, -50%) scale(0.82);
	}
	40% {
		opacity: 1;
		transform: translate(0, -50%) scale(1.08);
	}
	100% {
		opacity: 1;
		transform: translate(0, -50%) scale(1);
	}
}

.date-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}
</style>