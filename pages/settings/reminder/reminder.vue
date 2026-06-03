<template>
	<view class="page">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">提醒设置</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="card">
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">微信服务通知</text>
					<text class="cell-desc">开启后，作业临近截止时会通过微信服务通知提醒你。</text>
				</view>
				<button class="primary-btn" @click="requestNoticePermission">{{ noticeEnabled ? '已开启' : '去授权' }}</button>
			</view>
		</view>

		<view class="card">
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">默认提醒时间</text>
					<text class="cell-desc">新作业默认在截止前 N 小时提醒</text>
				</view>
				<view class="input-row">
					<input class="num-input" type="number" v-model="defaultReminderOffsetHours" placeholder="23" maxlength="3" />
					<text class="input-unit">小时前提醒</text>
					<button class="primary-btn" @click="saveDefaultReminderOffset">保存</button>
				</view>
			</view>

			<view class="divider"></view>

			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">默认截止时间</text>
					<text class="cell-desc">新作业默认设为当前时间后 N 小时</text>
				</view>
				<view class="input-row">
					<input class="num-input" type="number" v-model="defaultDeadlineOffsetHours" placeholder="24" maxlength="3" />
					<text class="input-unit">小时后</text>
					<button class="primary-btn" @click="saveDefaultDeadlineOffset">保存</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { requestNotificationPermission, getNotificationPermissionStatus } from '@/utils/notification.js'

const DEFAULT_DEADLINE_OFFSET_KEY = 'default_deadline_offset_hours'
const DEFAULT_DEADLINE_OFFSET_HOURS = 24
const DEFAULT_REMINDER_OFFSET_KEY = 'default_reminder_offset_hours'
const DEFAULT_REMINDER_OFFSET_HOURS = 23

export default {
	data() {
		return {
			noticeEnabled: false,
			defaultDeadlineOffsetHours: `${DEFAULT_DEADLINE_OFFSET_HOURS}`,
			defaultReminderOffsetHours: `${DEFAULT_REMINDER_OFFSET_HOURS}`
		}
	},
	onShow() {
		this.loadNoticeStatus()
		this.loadDefaultDeadlineOffset()
		this.loadDefaultReminderOffset()
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
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
	display: flex;
	align-items: center;
	padding: 44rpx 0 28rpx;
}

.nav-back,
.nav-placeholder {
	width: 80rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav-arrow {
	font-size: 48rpx;
	font-weight: 600;
	color: #2563eb;
	line-height: 1;
}

.nav-title {
	flex: 1;
	text-align: center;
	font-size: 36rpx;
	font-weight: 800;
	color: #2563eb;
}

.card {
	margin-bottom: 24rpx;
	padding: 8rpx 28rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.cell {
	padding: 28rpx 0;
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.cell-block {
	flex-direction: column;
	align-items: stretch;
	gap: 18rpx;
}

.cell-main {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.cell-title {
	font-size: 30rpx;
	font-weight: 800;
	color: #111827;
}

.cell-desc {
	font-size: 24rpx;
	color: #9ca3af;
	line-height: 1.5;
}

.divider {
	height: 2rpx;
	background: #f1f3f7;
}

.input-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.num-input {
	box-sizing: border-box;
	width: 180rpx;
	height: 80rpx;
	padding: 0 22rpx;
	border-radius: 18rpx;
	background: #f4f6fb;
	font-size: 30rpx;
	font-weight: 700;
	color: #111827;
}

.input-unit {
	flex: 1;
	font-size: 28rpx;
	color: #6b7280;
}

.primary-btn {
	height: 76rpx;
	line-height: 76rpx;
	margin: 0;
	padding: 0 28rpx;
	min-width: 132rpx;
	border-radius: 18rpx;
	background: #2979ff;
	color: #fff;
	font-size: 26rpx;
	font-weight: 700;
}

.primary-btn::after {
	border: 0;
}
</style>
