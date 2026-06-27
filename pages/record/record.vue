<template>
	<view class="page" :style="kbStyle">
		<view class="custom-nav">
			<text class="nav-title">记录作业</text>
		</view>

		<view class="camera-panel">
			<button class="camera-circle" @click="takePhoto">
				<view class="camera-icon">
					<view class="camera-lens"></view>
				</view>
			</button>
			<text class="camera-title">拍照记录作业</text>
			<text class="camera-subtitle">拍下黑板或作业内容，快速保存提醒</text>
		</view>

		<view class="input-section">
			<view class="photo-action-mask" v-if="showPhotoAction" @click="closePhotoAction">
				<scroll-view scroll-x class="photo-action-scroll" @click.stop>
					<view class="photo-action-card">
						<view v-for="(path, index) in form.imagePaths" :key="`image-${index}-${path}`" class="attachment-tile image-attachment-tile">
							<image class="attachment-thumb" :src="path" mode="aspectFill" @click="previewImage(path)"></image>
							<image class="remove-attachment" src="/static/delete.png" mode="aspectFit" @click.stop="removeImageAttachment(index)"></image>
						</view>
						<view v-for="(audio, index) in form.audios" :key="`audio-${index}-${audio.path}`" class="attachment-tile audio-attachment-tile" @click="playAudio(audio.path)">
							<image class="audio-attachment-img" src="/static/audio.png" mode="aspectFit"></image>
							<text class="audio-attachment-text">{{ audio.duration || 1 }}秒</text>
							<image class="remove-attachment" src="/static/delete.png" mode="aspectFit" @click.stop="removeAudioAttachment(index)"></image>
						</view>
					</view>
				</scroll-view>
			</view>

			<view v-if="!isRecording" :class="['message-input-bar', (inputFocused || form.note.trim() || hasAttachment) ? 'expanded' : '']" :style="inputBarStyle">
				<view :class="['voice-btn', isRecording ? 'recording' : '']" @click="toggleVoiceRecord">
					<image class="bar-icon" :src="isRecording ? '/static/stop.png' : '/static/audio.png'" mode="aspectFit"></image>
				</view>
				<textarea class="message-input" v-model="form.note" :style="messageInputStyle" :placeholder="isRecording ? '正在录音，再点一次停止...' : '文字记录'" maxlength="200" :auto-height="false" :show-confirm-bar="false" @focus="inputFocused = true" @blur="inputFocused = false" />
				<view class="right-actions">
					<view class="bar-camera" @click="hasAttachment || form.note.trim() ? chooseImage() : takePhoto()">
						<image v-if="!hasAttachment && !form.note.trim()" class="bar-icon camera-bar-icon" src="/static/camera.png" mode="aspectFit"></image>
						<image v-else class="bar-icon" src="/static/plus.png" mode="aspectFit"></image>
					</view>
					<view :class="['bar-plus', (hasAttachment || form.note.trim()) ? 'next' : '']" @click="hasAttachment || form.note.trim() ? openForm() : chooseImage()">
						<image v-if="!hasAttachment && !form.note.trim()" class="bar-icon" src="/static/plus.png" mode="aspectFit"></image>
						<image v-else class="bar-icon send-icon" src="/static/send.png" mode="aspectFit"></image>
					</view>
				</view>
			</view>

			<view class="recording-card" v-if="isRecording" @click="stopVoiceRecord">
				<view class="recording-pulse">
					<view class="pulse-ring"></view>
					<view class="pulse-dot"></view>
				</view>
				<view class="recording-info">
					<text class="recording-title">正在录音</text>
					<text class="recording-subtitle">再次点击麦克风或点此停止，录音会作为附件保存</text>
				</view>
				<view class="recording-wave">
					<view></view>
					<view></view>
					<view></view>
					<view></view>
				</view>
			</view>
		</view>



		<view v-if="showForm" class="form-mask" @click="closeForm">
			<scroll-view scroll-y class="form-card" @click.stop>
				<view class="form-title-row">
					<text class="form-title">{{ editingId ? '编辑作业' : (hasAttachment ? '保存作业' : '保存文字作业') }}</text>
					<text class="form-close" @click="closeForm">取消</text>
				</view>

				<view class="attachment-edit-actions">
					<view class="attachment-add-btn" @click="chooseImage">添加图片</view>
					<view :class="['attachment-add-btn', isRecording ? 'recording' : '']" @click="toggleVoiceRecord">{{ isRecording ? '停止录音' : '添加录音' }}</view>
				</view>

				<view v-if="form.imagePaths.length || form.audios.length" class="form-preview-grid">
					<view v-for="(path, index) in form.imagePaths" :key="`form-image-${index}-${path}`" class="preview-tile">
						<image class="preview" :src="path" mode="aspectFill" @click="previewImage(path)"></image>
						<image class="remove-attachment preview-remove" src="/static/delete.png" mode="aspectFit" @click.stop="removeImageAttachment(index)"></image>
					</view>
					<view v-for="(audio, index) in form.audios" :key="`form-audio-${index}-${audio.path}`" class="preview-tile audio-preview-tile" @click="playAudio(audio.path)">
						<image class="audio-attachment-img" src="/static/audio.png" mode="aspectFit"></image>
						<text class="audio-attachment-text">{{ audio.duration || 1 }}秒</text>
						<image class="remove-attachment preview-remove" src="/static/delete.png" mode="aspectFit" @click.stop="removeAudioAttachment(index)"></image>
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
					<text class="label">{{ hasAttachment ? '备注' : '作业内容' }}</text>
					<textarea class="note" v-model="form.note" :placeholder="hasAttachment ? '例如：第 3 章习题、需要提交实验报告' : '请输入老师布置的作业内容'" maxlength="200" />
				</view>

				<button class="save-btn" @click="saveHomework">{{ editingId ? '保存修改' : (hasAttachment ? '保存到看板' : '保存文字作业') }}</button>
			</scroll-view>
		</view>
	</view>
</template>

<script>
import { 
	requestNotificationPermission, 
	setHomeworkReminder, 
	resetNotificationStatus
} from '@/utils/notification.js'

const HOMEWORK_KEY = 'homework_list'
const SUBJECT_KEY = 'subject_list'
const DEFAULT_DEADLINE_OFFSET_KEY = 'default_deadline_offset_hours'
const DEFAULT_DEADLINE_OFFSET_HOURS = 24
const DEFAULT_REMINDER_OFFSET_KEY = 'default_reminder_offset_hours'
const DEFAULT_REMINDER_OFFSET_HOURS = 23
const DEFAULT_SUBJECTS = ['高等数学', '大学英语', '程序设计', '数据结构', '线性代数']
const PRELOAD_ICON_PATHS = [
	'/static/audio.png',
	'/static/camera.png',
	'/static/logo.png',
	'/static/more.png',
	'/static/plus.png',
	'/static/send.png',
	'/static/setting-active.png',
	'/static/setting.png',
	'/static/stop.png',
	'/static/tab-record-active.png',
	'/static/tab-record.png',
	'/static/tab-schedule-active.png',
	'/static/tab-schedule.png',
	'/static/tab-view-active.png',
	'/static/tab-view.png'
]
let viewPagePreloaded = false
let iconImagesPreloaded = false

export default {
	data() {
		return {
			homeworkList: [],
			subjectList: [],
			showForm: false,
			showPhotoAction: false,
			inputFocused: false,
			newSubjectName: '',
			editingId: '',
			isRecording: false,
			isRecordStopping: false,
			recordCanceled: false,
			recordStartTime: 0,
			recorderManager: null,
			form: this.createEmptyForm()
		}
	},
	computed: {
		subjectNames() {
			return this.subjectList.map(item => item.name)
		},
		hasAttachment() {
			return Boolean(this.form.imagePaths.length || this.form.audios.length)
		},
		inputLineCount() {
			const text = this.form.note || ''
			if (!text) return 1
			const visualLines = text.split('\n').reduce((total, line) => {
				return total + Math.max(1, Math.ceil(line.length / 18))
			}, 0)
			return Math.min(4, visualLines)
		},
		messageInputHeight() {
			return Math.min(206, 82 + (this.inputLineCount - 1) * 48)
		},
		inputBarStyle() {
			if (!this.inputFocused && !this.form.note.trim() && !this.hasAttachment) return ''
			return `height: ${Math.min(320, 114 + this.messageInputHeight)}rpx;`
		},
		messageInputStyle() {
			if (!this.inputFocused && !this.form.note.trim() && !this.hasAttachment) return ''
			return `height: ${this.messageInputHeight}rpx;`
		}
	},
	onLoad() {
		this.loadSubjects()
		this.loadHomework()
		this.initRecorder()
	},
	onShow() {
		this.loadHomework()
	},
	onUnload() {
		if (this.isRecording) {
			this.cancelVoiceRecord()
		}
	},
	onReady() {
		this.preloadViewPage()
		this.preloadIconImages()
	},
	methods: {
		preloadIconImages() {
			if (iconImagesPreloaded) return
			iconImagesPreloaded = true

			const preloadNext = index => {
				const src = PRELOAD_ICON_PATHS[index]
				if (!src) return

				uni.getImageInfo({
					src,
					complete: () => preloadNext(index + 1)
				})
			}

			preloadNext(0)
		},
		preloadViewPage() {
			if (viewPagePreloaded || typeof uni.preloadPage !== 'function') return
			viewPagePreloaded = true
			uni.preloadPage({
				url: '/pages/view/view',
				fail: () => {
					viewPagePreloaded = false
				}
			})
			uni.preloadPage({
				url: '/pages/settings/settings'
			})
			uni.preloadPage({
				url: '/pages/schedule/schedule'
			})
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
		logAudioRecord(step, detail = {}) {
			console.log(`[作业助手][录音] ${step}`, {
				...detail,
				isRecording: this.isRecording,
				isRecordStopping: this.isRecordStopping,
				recordCanceled: this.recordCanceled,
				recordStartTime: this.recordStartTime,
				audioCount: this.form.audios.length,
				time: new Date().toISOString()
			})
		},
		resetRecordingUiState(reason) {
			this.isRecording = false
			this.inputFocused = false
			this.logAudioRecord('录音 UI 状态已重置', { reason })
			this.$nextTick(() => {
				if (this.isRecording) {
					this.isRecording = false
					this.logAudioRecord('录音 UI 状态二次兜底重置', { reason })
				}
			})
		},
		resetRecordingRuntimeState(reason) {
			this.isRecording = false
			this.isRecordStopping = false
			this.recordCanceled = false
			this.recordStartTime = 0
			this.logAudioRecord('录音运行状态已重置', { reason })
		},
		initRecorder() {
			if (this.recorderManager) {
				this.logAudioRecord('录音管理器已存在，跳过重复初始化')
				return
			}
			if (typeof uni.getRecorderManager !== 'function') {
				this.logAudioRecord('当前运行环境不支持 uni.getRecorderManager')
				uni.showToast({ title: '当前环境不支持录音', icon: 'none' })
				return
			}

			this.recorderManager = uni.getRecorderManager()
			this.logAudioRecord('录音管理器初始化完成')
			this.recorderManager.onStart(() => {
				this.logAudioRecord('录音开始回调触发')
			})
			this.recorderManager.onStop(async res => {
				const rawDurationMs = Number((res && res.duration) || 0)
				const elapsedMs = this.recordStartTime ? Date.now() - this.recordStartTime : 0
				const durationMs = rawDurationMs || elapsedMs
				const duration = Math.ceil(durationMs / 1000)
				const canceled = this.recordCanceled

				this.logAudioRecord('录音停止回调触发', {
					res,
					rawDurationMs,
					elapsedMs,
					durationMs,
					duration,
					canceled,
					tempFilePath: res && res.tempFilePath
				})
				this.resetRecordingUiState('onStop')

				if (canceled) {
					this.resetRecordingRuntimeState('onStop canceled')
					this.logAudioRecord('录音已取消，不保存文件')
					return
				}
				if (durationMs < 800) {
					this.resetRecordingRuntimeState('onStop too short')
					this.logAudioRecord('录音时间太短，不保存文件', { durationMs, res })
					uni.showToast({ title: '录音时间太短，请重试', icon: 'none' })
					return
				}
				if (!res || !res.tempFilePath) {
					this.resetRecordingRuntimeState('onStop empty tempFilePath')
					this.logAudioRecord('录音停止但没有返回 tempFilePath', { res })
					uni.showToast({ title: '录音文件无效，请重试', icon: 'none' })
					return
				}
				try {
					await this.attachAudioHomework(res.tempFilePath, duration)
					this.resetRecordingRuntimeState('onStop attachAudioHomework done')
					this.resetRecordingUiState('onStop attachAudioHomework done')
				} catch (e) {
					this.resetRecordingRuntimeState('onStop attachAudioHomework error')
					this.logAudioRecord('添加录音附件异常', { error: e })
					uni.showToast({ title: '录音保存失败，请重试', icon: 'none' })
				}
			})
			this.recorderManager.onError(err => {
				this.logAudioRecord('录音错误回调触发', { err })
				this.resetRecordingUiState('onError')
				this.resetRecordingRuntimeState('onError')
				uni.showToast({ title: '录音失败，请重试', icon: 'none' })
			})
		},
		startVoiceRecord() {
			this.initRecorder()
			if (!this.recorderManager) {
				this.logAudioRecord('启动录音失败：录音管理器不存在')
				return
			}
			if (this.isRecording || this.isRecordStopping) {
				this.logAudioRecord('启动录音被忽略：当前正在录音或正在停止录音')
				uni.showToast({ title: '录音处理中，请稍候', icon: 'none' })
				return
			}
			this.isRecording = true
			this.isRecordStopping = false
			this.recordCanceled = false
			this.recordStartTime = Date.now()
			const options = {
				duration: 60000,
				format: 'mp3'
			}
			this.logAudioRecord('准备启动录音', { options })
			try {
				this.recorderManager.start(options)
			} catch (e) {
				this.logAudioRecord('调用 recorderManager.start 抛出异常', { error: e })
				this.resetRecordingUiState('start exception')
				this.resetRecordingRuntimeState('start exception')
				uni.showToast({ title: '录音启动失败', icon: 'none' })
			}
		},
		stopVoiceRecord() {
			if (!this.recorderManager) {
				this.logAudioRecord('停止录音失败：录音管理器不存在')
				this.resetRecordingUiState('stop without recorderManager')
				this.resetRecordingRuntimeState('stop without recorderManager')
				return
			}
			if (this.isRecordStopping) {
				this.logAudioRecord('停止录音被忽略：录音正在停止中')
				return
			}
			if (!this.isRecording) {
				this.logAudioRecord('停止录音被忽略：当前不在录音')
				return
			}
			this.logAudioRecord('准备停止录音')
			this.isRecordStopping = true
			this.resetRecordingUiState('stopVoiceRecord immediate')
			try {
				this.recorderManager.stop()
			} catch (e) {
				this.logAudioRecord('调用 recorderManager.stop 抛出异常', { error: e })
				this.resetRecordingUiState('stop exception')
				this.resetRecordingRuntimeState('stop exception')
				uni.showToast({ title: '停止录音失败', icon: 'none' })
			}
		},
		toggleVoiceRecord() {
			this.logAudioRecord('切换录音状态')
			if (this.isRecordStopping) {
				this.logAudioRecord('切换录音状态被忽略：录音正在停止中')
				uni.showToast({ title: '录音处理中，请稍候', icon: 'none' })
				return
			}
			if (this.isRecording) {
				this.stopVoiceRecord()
				return
			}
			this.startVoiceRecord()
		},
		cancelVoiceRecord() {
			this.logAudioRecord('准备取消录音')
			if (this.recorderManager && this.isRecording && !this.isRecordStopping) {
				this.recordCanceled = true
				this.isRecordStopping = true
				this.resetRecordingUiState('cancelVoiceRecord immediate')
				try {
					this.recorderManager.stop()
				} catch (e) {
					this.logAudioRecord('取消录音时 stop 抛出异常', { error: e })
					this.resetRecordingUiState('cancel exception')
					this.resetRecordingRuntimeState('cancel exception')
				}
				return
			}
			this.resetRecordingUiState('cancel without active recording')
			if (!this.isRecordStopping) {
				this.resetRecordingRuntimeState('cancel without active recording')
			}
		},
		async saveAudioFile(tempFilePath) {
			this.logAudioRecord('准备保存录音文件', { tempFilePath, hasSaveFile: typeof uni.saveFile === 'function' })
			if (!tempFilePath) {
				this.logAudioRecord('保存录音失败：tempFilePath 为空')
				uni.showToast({ title: '录音文件无效，请重试', icon: 'none' })
				return ''
			}
			if (typeof uni.saveFile !== 'function') {
				this.logAudioRecord('当前环境不支持 uni.saveFile，使用临时路径作为录音附件', { tempFilePath })
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
				this.logAudioRecord('uni.saveFile 返回结果', { res, savedFilePath })
				if (!savedFilePath) {
					this.logAudioRecord('uni.saveFile 未返回保存路径，回退到临时路径', { res, tempFilePath })
					return tempFilePath
				}
				return savedFilePath
			} catch (e) {
				this.logAudioRecord('uni.saveFile 保存失败，回退到临时路径', { error: e, tempFilePath })
				return tempFilePath
			}
		},
		async attachAudioHomework(audioPath, duration) {
			this.logAudioRecord('准备添加录音附件', { audioPath, duration })
			const savedAudioPath = await this.saveAudioFile(audioPath)
			if (!savedAudioPath) {
				this.logAudioRecord('添加录音附件失败：保存路径为空', { audioPath, duration })
				return
			}
			this.form.audios.push({
				path: savedAudioPath,
				duration
			})
			this.syncLegacyAttachmentFields()
			this.form.subject = this.subjectNames[0] || ''
			this.showPhotoAction = true
			this.logAudioRecord('录音附件已添加到表单', {
				savedAudioPath,
				duration,
				audios: this.form.audios,
				audioPath: this.form.audioPath,
				audioDuration: this.form.audioDuration
			})
			uni.showToast({ title: '录音已添加', icon: 'success' })
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
			this.homeworkList = Array.isArray(saved) ? saved : []
		},
		saveSubjects() {
			uni.setStorageSync(SUBJECT_KEY, this.subjectList)
		},
		saveHomeworkList() {
			uni.setStorageSync(HOMEWORK_KEY, this.homeworkList)
		},
		takePhoto() {
			uni.chooseImage({
				count: 1,
				sourceType: ['camera'],
				success: res => {
					this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || [])
					this.syncLegacyAttachmentFields()
					this.form.subject = this.subjectNames[0] || ''
					this.showPhotoAction = true
				},
				fail: () => {
					uni.showToast({ title: '未完成拍照', icon: 'none' })
				}
			})
		},
		chooseImage() {
			uni.chooseImage({
				count: 9,
				sourceType: ['album', 'camera'],
				success: res => {
					this.form.imagePaths = this.form.imagePaths.concat(res.tempFilePaths || [])
					this.syncLegacyAttachmentFields()
					this.form.subject = this.subjectNames[0] || ''
					this.showPhotoAction = !this.showForm
				},
				fail: () => {
					uni.showToast({ title: '未选择图片', icon: 'none' })
				}
			})
		},
		closePhotoAction() {
			this.showPhotoAction = false
		},
		removeImageAttachment(index) {
			this.form.imagePaths.splice(index, 1)
			this.syncLegacyAttachmentFields()
			if (!this.hasAttachment) {
				this.showPhotoAction = false
			}
		},
		removeAudioAttachment(index) {
			this.form.audios.splice(index, 1)
			this.syncLegacyAttachmentFields()
			if (!this.hasAttachment) {
				this.showPhotoAction = false
			}
		},
		removeAttachment() {
			this.form.imagePaths = []
			this.form.audios = []
			this.syncLegacyAttachmentFields()
			this.showPhotoAction = false
		},
		removePhoto() {
			this.removeImageAttachment(0)
		},
		syncLegacyAttachmentFields() {
			const firstAudio = this.form.audios[0] || {}
			this.form.imagePath = this.form.imagePaths[0] || ''
			this.form.audioPath = firstAudio.path || ''
			this.form.audioDuration = firstAudio.duration || 0
		},
		openForm() {
			if (!this.form.note.trim() && !this.hasAttachment) {
				uni.showToast({ title: '请输入作业内容或添加附件', icon: 'none' })
				return
			}
			this.form.subject = this.subjectNames[0] || ''
			this.showPhotoAction = false
			this.showForm = true
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
		async saveHomework() {
			if (!this.hasAttachment && !this.form.note.trim()) {
				uni.showToast({ title: '请输入作业内容或添加附件', icon: 'none' })
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

			this.loadHomework()
			
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
						audios: this.form.audios.map(item => ({ ...item })),
						imagePath: this.form.imagePath,
						audioPath: this.form.audioPath,
						audioDuration: this.form.audioDuration,
						note: this.form.note.trim()
					}
					this.saveHomeworkList()
					resetNotificationStatus(this.homeworkList[index].id)
					setHomeworkReminder(this.homeworkList[index])
				}
			} else {
				this.syncLegacyAttachmentFields()
				const newHomework = {
					id: this.createId(),
					subject: this.form.subject,
					deadline,
					deadlineDate: this.form.deadlineDate,
					deadlineTime: this.form.deadlineTime,
					imagePaths: [...this.form.imagePaths],
					audios: this.form.audios.map(item => ({ ...item })),
					imagePath: this.form.imagePath,
					audioPath: this.form.audioPath,
					audioDuration: this.form.audioDuration,
					note: this.form.note.trim(),
					completed: false,
					createdAt: new Date().toISOString(),
					completedAt: null
				}
				
				this.homeworkList.unshift(newHomework)
				this.saveHomeworkList()
				
				let noticeEnabled = false
				try {
					noticeEnabled = await requestNotificationPermission()
				} catch (e) {
					console.warn('通知权限请求失败：', e)
				}
				
				if (noticeEnabled) {
					setHomeworkReminder(newHomework)
				}
			}
			
			this.resetForm()
			uni.showToast({ title: this.editingId ? '已更新' : '已保存', icon: 'success' })
		},
		closeForm() {
			if (this.isRecording) {
				this.cancelVoiceRecord()
			}
			this.showForm = false
			this.showPhotoAction = this.hasAttachment
		},
		resetForm() {
			this.showForm = false
			this.showPhotoAction = false
			this.editingId = ''
			this.newSubjectName = ''
			this.form = this.createEmptyForm()
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
		previewImage(path) {
			if (!path) return
			uni.previewImage({ urls: this.form.imagePaths.length ? this.form.imagePaths : [path], current: path })
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
	height: 100vh;
	min-height: 100vh;
	padding: 28rpx 32rpx 0;
	box-sizing: border-box;
	overflow: hidden;
	background: linear-gradient(180deg, #f7faff 0%, #eef3fb 100%);
}

.custom-nav {
	padding: 44rpx 0 24rpx;
	text-align: center;
	border-bottom: 4rpx solid #d1d5db;
}

.nav-title {
	font-size: 38rpx;
	font-weight: 800;
	color: #2563eb;
}

.camera-panel {
	height: calc(100vh - 280rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 40rpx 20rpx 180rpx;
	box-sizing: border-box;
}

.camera-circle {
	width: 240rpx;
	height: 240rpx;
	line-height: 240rpx;
	margin: 0;
	padding: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: linear-gradient(135deg, #2f80ff, #6aa7ff);
	box-shadow: 0 30rpx 64rpx rgba(41, 121, 255, 0.3);
}

.camera-circle::after {
	border: 0;
}

.camera-icon {
	position: relative;
	width: 118rpx;
	height: 86rpx;
	border-radius: 22rpx;
	background: #fff;
}

.camera-icon::before {
	content: '';
	position: absolute;
	left: 30rpx;
	top: -20rpx;
	width: 58rpx;
	height: 30rpx;
	border-radius: 16rpx 16rpx 5rpx 5rpx;
	background: #fff;
}

.camera-lens {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 48rpx;
	height: 48rpx;
	transform: translate(-50%, -50%);
	border: 9rpx solid #2f80ff;
	border-radius: 50%;
	box-sizing: border-box;
}

.camera-title {
	margin-top: 34rpx;
	font-size: 36rpx;
	font-weight: 800;
	color: #111827;
}

.camera-subtitle {
	margin-top: 14rpx;
	font-size: 25rpx;
	color: #6b7280;
}

.input-section {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(112rpx + constant(safe-area-inset-bottom));
	bottom: calc(112rpx + env(safe-area-inset-bottom));
	z-index: 40;
	padding: 10rpx 0 0;
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}

.message-input-bar {
	position: relative;
	display: flex;
	align-items: center;
	gap: 24rpx;
	min-height: 112rpx;
	max-height: 320rpx;
	padding: 18rpx 28rpx;
	border: 3rpx solid #e5e7eb;
	border-radius: 56rpx;
	background: #ffffff;
	box-shadow: 0 10rpx 26rpx rgba(17, 24, 39, 0.06);
	box-sizing: border-box;
	overflow: hidden;
	transition: height 0.2s ease, min-height 0.2s ease, max-height 0.2s ease, border-radius 0.2s ease;
}

.message-input-bar.expanded {
	flex-direction: column;
	align-items: stretch;
	justify-content: flex-start;
	min-height: 208rpx;
	max-height: 320rpx;
	border-radius: 42rpx;
}

.right-actions {
	order: 3;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.message-input-bar.expanded .voice-btn {
	position: absolute;
	left: 28rpx;
	bottom: 18rpx;
	z-index: 3;
	order: 2;
}

.message-input-bar.expanded .right-actions {
	position: absolute;
	right: 28rpx;
	bottom: 18rpx;
	z-index: 3;
	align-self: auto;
	margin-top: 0;
}

.voice-btn,
.bar-camera,
.bar-plus {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.voice-btn,
.bar-plus {
	width: 72rpx;
	height: 72rpx;
}

.voice-btn.recording {
	transform: scale(0.96);
	opacity: 0.72;
}

.bar-icon {
	width: 52rpx;
	height: 52rpx;
	display: block;
}

.message-input {
	flex: 1;
	order: 2;
	height: 48rpx;
	min-height: 48rpx;
	max-height: 176rpx;
	padding: 0;
	font-size: 34rpx;
	line-height: 48rpx;
	color: #111827;
	box-sizing: border-box;
	overflow-y: auto;
}

.message-input-bar.expanded .message-input {
	order: 1;
	width: 100%;
	max-height: 206rpx;
	padding-top: 28rpx;
	padding-bottom: 34rpx;
	box-sizing: border-box;
}



.bar-camera {
	width: 72rpx;
	height: 72rpx;
}

.camera-bar-icon {
	width: 54rpx;
	height: 54rpx;
}

.bar-plus {
	width: 72rpx;
	height: 72rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
}

.bar-plus.next {
	border-radius: 50%;
}

.next-arrow {
	font-size: 48rpx;
	line-height: 72rpx;
	font-weight: 800;
	color: #ffffff;
}

.recording-card {
	margin: 18rpx 0 0;
	padding: 20rpx 22rpx;
	display: flex;
	align-items: center;
	gap: 18rpx;
	border: 2rpx solid rgba(239, 68, 68, 0.18);
	border-radius: 28rpx;
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 241, 242, 0.98));
	box-shadow: 0 18rpx 48rpx rgba(239, 68, 68, 0.14);
	box-sizing: border-box;
}

.recording-pulse {
	position: relative;
	width: 58rpx;
	height: 58rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.pulse-ring {
	position: absolute;
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	background: rgba(239, 68, 68, 0.16);
	animation: recordPulse 1.35s ease-out infinite;
}

.pulse-dot {
	position: relative;
	width: 26rpx;
	height: 26rpx;
	border-radius: 50%;
	background: #ef4444;
	box-shadow: 0 0 0 10rpx rgba(239, 68, 68, 0.12);
}

.recording-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.recording-title {
	font-size: 28rpx;
	font-weight: 800;
	color: #991b1b;
}

.recording-subtitle {
	font-size: 22rpx;
	line-height: 32rpx;
	color: #ef4444;
}

.recording-wave {
	height: 42rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 6rpx;
}

.recording-wave view {
	width: 6rpx;
	height: 20rpx;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #fb7185, #ef4444);
	animation: recordWave 0.8s ease-in-out infinite;
}

.recording-wave view:nth-child(2) {
	animation-delay: 0.12s;
}

.recording-wave view:nth-child(3) {
	animation-delay: 0.24s;
}

.recording-wave view:nth-child(4) {
	animation-delay: 0.36s;
}

@keyframes recordPulse {
	0% {
		transform: scale(0.72);
		opacity: 0.9;
	}
	100% {
		transform: scale(1.35);
		opacity: 0;
	}
}

@keyframes recordWave {
	0%, 100% {
		height: 16rpx;
	}
	50% {
		height: 40rpx;
	}
}

.photo-action-mask {
	position: relative;
	z-index: 1;
	padding: 0;
	background: transparent;
	box-sizing: border-box;
}

.photo-action-scroll {
	width: 100%;
}

.photo-action-card {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 18rpx;
	min-width: 100%;
	padding: 22rpx;
	background: #ffffff;
	border-radius: 22rpx;
	box-shadow: 0 18rpx 50rpx rgba(17, 24, 39, 0.12);
	box-sizing: border-box;
}

.attachment-tile {
	position: relative;
	width: 136rpx;
	height: 136rpx;
	padding: 8rpx;
	border-radius: 20rpx;
	background: #f8fafc;
	box-sizing: border-box;
	flex-shrink: 0;
}

.attachment-thumb {
	width: 120rpx;
	height: 120rpx;
	border-radius: 16rpx;
	background: #e5e7eb;
}

.audio-attachment-tile {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	background: linear-gradient(135deg, #f8fbff, #eef8ff);
}

.audio-attachment-img {
	width: 54rpx;
	height: 54rpx;
}

.audio-attachment-text {
	max-width: 100%;
	font-size: 22rpx;
	font-weight: 700;
	color: #2979ff;
}

.remove-attachment {
	position: absolute;
	right: 0;
	top: 0;
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	box-shadow: 0 6rpx 16rpx rgba(239, 68, 68, 0.32);
}

.image-preview-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-top: 20rpx;
	padding: 16rpx;
	background: #ffffff;
	border-radius: 18rpx;
	box-shadow: 0 10rpx 26rpx rgba(17, 24, 39, 0.05);
}

.form-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 50;
	display: flex;
	align-items: flex-end;
	padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
	background: rgba(17, 24, 39, 0.22);
}

.form-card {
	width: 100%;
	height: 82vh;
	max-height: 82vh;
	overflow-y: auto;
	padding: 28rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
	box-sizing: border-box;
}

.form-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.form-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.form-close {
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
	display: flex;
	align-items: center;
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

.footer {
	margin-top: 40rpx;
	padding: 30rpx 0;
	text-align: center;
}

.footer-text {
	font-size: 24rpx;
	color: #9ca3af;
}

.date-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.reminder-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.reminder-input {
	box-sizing: border-box;
	width: 180rpx;
	height: 82rpx;
	padding: 0 22rpx;
	border-radius: 18rpx;
	background: #f8fafc;
	font-size: 30rpx;
	font-weight: 700;
	color: #111827;
}

.reminder-unit {
	flex: 1;
	font-size: 28rpx;
	color: #6b7280;
}
</style>