<template>
	<view class="page">
		<view class="custom-nav">
			<text class="nav-title">设置</text>
		</view>

		<view class="settings-card">
			<view class="notice-card setting-section">
				<view class="notice-main">
					<text class="notice-title">微信服务通知</text>
					<text class="notice-desc">开启后，作业临近截止时会通过微信服务通知提醒你。</text>
				</view>
				<button class="notice-btn" @click="requestNoticePermission">{{ noticeEnabled ? '已开启' : '去授权' }}</button>
			</view>

			<view class="deadline-card setting-section">
				<view class="section-title-row">
					<view>
						<text class="section-title">默认提醒时间</text>
						<text class="section-tip">新作业默认在截止前 N 小时提醒</text>
					</view>
				</view>
				<view class="deadline-row">
					<input class="deadline-input" type="number" v-model="defaultReminderOffsetHours" placeholder="23" maxlength="3" />
					<text class="deadline-unit">小时前提醒</text>
					<button class="save-deadline-btn" @click="saveDefaultReminderOffset">保存</button>
				</view>
			</view>

			<view class="deadline-card setting-section">
				<view class="section-title-row">
					<view>
						<text class="section-title">默认截止时间</text>
						<text class="section-tip">新作业默认设为当前时间后 N 小时</text>
					</view>
				</view>
				<view class="deadline-row">
					<input class="deadline-input" type="number" v-model="defaultDeadlineOffsetHours" placeholder="24" maxlength="3" />
					<text class="deadline-unit">小时后</text>
					<button class="save-deadline-btn" @click="saveDefaultDeadlineOffset">保存</button>
				</view>
			</view>

			<view class="subject-card setting-section">
				<view class="section-title-row">
					<text class="section-title">学科列表</text>
					<text class="section-tip">可增删改当前学科</text>
				</view>

				<view class="add-row">
					<input class="subject-input" v-model="newSubjectName" placeholder="输入新学科名称" maxlength="20" />
					<button class="add-btn" @click="addSubject">新增</button>
				</view>

				<scroll-view v-if="subjectList.length" class="subject-list" scroll-y show-scrollbar="false">
					<view class="subject-item" v-for="item in subjectList" :key="item.id">
						<input
							class="subject-name"
							:value="item.name"
							maxlength="20"
							@blur="renameSubject(item, $event.detail.value)"
						/>
						<button class="delete-btn" @click="deleteSubject(item)">删除</button>
					</view>
				</scroll-view>

				<view v-else class="empty">
					<text>暂无学科，请先新增</text>
				</view>
			</view>
		</view>


		<view class="danger-card">
			<view class="section-title-row">
				<view>
					<text class="section-title">作业清理</text>
					<text class="section-tip">仅删除已标记完成的作业</text>
				</view>
			</view>
			<button class="clear-completed-btn" @click="clearCompletedHomework">清除全部已完成的作业</button>
		</view>

		<view class="footer">
			<text class="footer-text">联系开发者 QQ：3383623610</text>
		</view>
	</view>
</template>

<script>
import { requestNotificationPermission, getNotificationPermissionStatus } from '@/utils/notification.js'

const SUBJECT_KEY = 'subject_list'
const HOMEWORK_KEY = 'homework_list'
const DEFAULT_DEADLINE_OFFSET_KEY = 'default_deadline_offset_hours'
const DEFAULT_DEADLINE_OFFSET_HOURS = 24
const DEFAULT_REMINDER_OFFSET_KEY = 'default_reminder_offset_hours'
const DEFAULT_REMINDER_OFFSET_HOURS = 23
const DEFAULT_SUBJECTS = ['高等数学', '大学英语', '程序设计', '数据结构', '线性代数']

export default {
	data() {
		return {
			subjectList: [],
			newSubjectName: '',
			noticeEnabled: false,
			defaultDeadlineOffsetHours: `${DEFAULT_DEADLINE_OFFSET_HOURS}`,
			defaultReminderOffsetHours: `${DEFAULT_REMINDER_OFFSET_HOURS}`
		}
	},
	onShow() {
		this.loadSubjects()
		this.loadNoticeStatus()
		this.loadDefaultDeadlineOffset()
		this.loadDefaultReminderOffset()
	},
	methods: {
		loadNoticeStatus() {
			this.noticeEnabled = getNotificationPermissionStatus()
		},
		async requestNoticePermission() {
			const enabled = await requestNotificationPermission({ showToast: true })
			this.noticeEnabled = enabled
		},
		loadDefaultDeadlineOffset() {
			const saved = Number(uni.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY))
			this.defaultDeadlineOffsetHours = `${saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS}`
		},
		loadDefaultReminderOffset() {
			const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY))
			this.defaultReminderOffsetHours = `${saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS}`
		},
		saveDefaultReminderOffset() {
			const hours = Number(this.defaultReminderOffsetHours)
			if (!Number.isInteger(hours) || hours <= 0 || hours > 168) {
				uni.showToast({ title: '请输入 1-168 小时', icon: 'none' })
				this.loadDefaultReminderOffset()
				return
			}
			uni.setStorageSync(DEFAULT_REMINDER_OFFSET_KEY, hours)
			this.defaultReminderOffsetHours = `${hours}`
			uni.showToast({ title: '已保存', icon: 'success' })
		},
		saveDefaultDeadlineOffset() {
			const hours = Number(this.defaultDeadlineOffsetHours)
			if (!Number.isInteger(hours) || hours <= 0 || hours > 168) {
				uni.showToast({ title: '请输入 1-168 小时', icon: 'none' })
				this.loadDefaultDeadlineOffset()
				return
			}
			uni.setStorageSync(DEFAULT_DEADLINE_OFFSET_KEY, hours)
			this.defaultDeadlineOffsetHours = `${hours}`
			uni.showToast({ title: '已保存', icon: 'success' })
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
		saveSubjects() {
			uni.setStorageSync(SUBJECT_KEY, this.subjectList)
		},
		addSubject() {
			const name = this.newSubjectName.trim()
			if (!name) {
				uni.showToast({ title: '请输入学科名称', icon: 'none' })
				return
			}
			if (this.subjectList.some(item => item.name === name)) {
				uni.showToast({ title: '学科已存在', icon: 'none' })
				return
			}

			this.subjectList.unshift({
				id: this.createId(),
				name,
				createdAt: new Date().toISOString()
			})
			this.newSubjectName = ''
			this.saveSubjects()
			uni.showToast({ title: '已新增', icon: 'success' })
		},
		renameSubject(item, value) {
			const name = value.trim()
			if (!name) {
				uni.showToast({ title: '学科不能为空', icon: 'none' })
				return
			}
			if (name === item.name) return
			if (this.subjectList.some(subject => subject.id !== item.id && subject.name === name)) {
				uni.showToast({ title: '学科已存在', icon: 'none' })
				return
			}

			const oldName = item.name
			item.name = name
			this.saveSubjects()
			this.renameHomeworkSubject(oldName, name)
			uni.showToast({ title: '已修改', icon: 'success' })
		},
		renameHomeworkSubject(oldName, newName) {
			const homeworkList = uni.getStorageSync(HOMEWORK_KEY)
			if (!Array.isArray(homeworkList)) return

			const nextList = homeworkList.map(item => {
				if (item.subject !== oldName) return item
				return { ...item, subject: newName }
			})
			uni.setStorageSync(HOMEWORK_KEY, nextList)
		},
		deleteSubject(item) {
			uni.showModal({
				title: '删除学科',
				content: `确定删除“${item.name}”吗？已记录的作业不会被删除。`,
				confirmText: '删除',
				confirmColor: '#ef4444',
				success: res => {
					if (!res.confirm) return
					this.subjectList = this.subjectList.filter(subject => subject.id !== item.id)
					this.saveSubjects()
					uni.showToast({ title: '已删除', icon: 'success' })
				}
			})
		},
		clearCompletedHomework() {
			const homeworkList = uni.getStorageSync(HOMEWORK_KEY)
			if (!Array.isArray(homeworkList) || !homeworkList.some(item => item.completed)) {
				uni.showToast({ title: '暂无已完成作业', icon: 'none' })
				return
			}

			const completedCount = homeworkList.filter(item => item.completed).length
			uni.showModal({
				title: '清除已完成作业',
				content: `确定清除 ${completedCount} 条已完成作业吗？`,
				confirmText: '清除',
				confirmColor: '#ef4444',
				success: res => {
					if (!res.confirm) return
					uni.setStorageSync(HOMEWORK_KEY, homeworkList.filter(item => !item.completed))
					uni.showToast({ title: '已清除', icon: 'success' })
				}
			})
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
	padding: 28rpx 28rpx 120rpx;
	box-sizing: border-box;
	background: #f4f7fb;
}

.custom-nav {
	padding: 44rpx 0 28rpx;
	text-align: center;
}

.nav-title {
	font-size: 38rpx;
	font-weight: 800;
	color: #2563eb;
}

.settings-card,
.danger-card {
	padding: 28rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.setting-section {
	padding: 0 0 30rpx;
	border-bottom: 2rpx solid #eef2f7;
}

.setting-section + .setting-section {
	padding-top: 30rpx;
}

.setting-section:last-child {
	padding-bottom: 0;
	border-bottom: 0;
}


.notice-card {
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.notice-main {
	flex: 1;
	min-width: 0;
}

.notice-title,
.notice-desc,
.section-title,
.section-tip {
	display: block;
}

.notice-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.notice-desc {
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.5;
	color: #6b7280;
}

.notice-btn {
	width: 150rpx;
	height: 72rpx;
	line-height: 72rpx;
	margin: 0;
	padding: 0;
	border-radius: 999rpx;
	background: #2979ff;
	color: #fff;
	font-size: 26rpx;
	font-weight: 700;
}

.danger-card {
	margin-top: 28rpx;
}


.clear-completed-btn {
	width: 100%;
	height: 86rpx;
	line-height: 86rpx;
	margin: 28rpx 0 0;
	padding: 0;
	border-radius: 20rpx;
	background: #fef2f2;
	color: #ef4444;
	font-size: 28rpx;
	font-weight: 800;
}

.deadline-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-top: 24rpx;
}

.deadline-input {
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

.deadline-unit {
	flex: 1;
	font-size: 28rpx;
	color: #6b7280;
}

.save-deadline-btn {
	width: 132rpx;
	height: 82rpx;
	line-height: 82rpx;
	margin: 0;
	padding: 0;
	border-radius: 18rpx;
	background: #2979ff;
	color: #fff;
	font-size: 26rpx;
	font-weight: 700;
}

.clear-completed-btn::after,
.save-deadline-btn::after {
	border: 0;
}

.section-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.section-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.section-tip {
	font-size: 24rpx;
	color: #9ca3af;
}

.add-row,
.subject-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.add-row {
	margin-top: 24rpx;
}

.subject-input,
.subject-name {
	box-sizing: border-box;
	flex: 1;
	height: 82rpx;
	padding: 0 22rpx;
	border-radius: 18rpx;
	background: #f8fafc;
	font-size: 28rpx;
	color: #111827;
}

.add-btn,
.delete-btn {
	width: 132rpx;
	height: 82rpx;
	line-height: 82rpx;
	margin: 0;
	padding: 0;
	border-radius: 18rpx;
	font-size: 26rpx;
	font-weight: 700;
}

.add-btn {
	background: #2979ff;
	color: #fff;
}

.subject-list {
	max-height: 560rpx;
	margin-top: 22rpx;
	padding: 8rpx 10rpx;
	box-sizing: border-box;
	border: 2rpx solid #e5e7eb;
	border-radius: 18rpx;
	background: #fff;
}



.subject-item {
	padding: 16rpx 0;
	border-bottom: 1rpx solid #eef2f7;
}

.subject-item:last-child {
	border-bottom: 0;
}

.delete-btn {
	background: #fef2f2;
	color: #ef4444;
}

.empty {
	padding: 48rpx 0 24rpx;
	text-align: center;
	font-size: 26rpx;
	color: #9ca3af;
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
</style>