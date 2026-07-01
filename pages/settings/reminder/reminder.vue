<template>
	<view class="page" :style="kbStyle">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">提醒设置</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="card">
			<!-- #ifdef MP-WEIXIN -->
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">微信服务通知</text>
					<text class="cell-desc">开启后，作业临近截止时会通过微信服务通知提醒你。</text>
				</view>
				<button class="primary-btn" @click="requestNoticePermission">{{ noticeEnabled ? '已开启' : '去授权' }}</button>
			</view>

			<view class="divider"></view>
			<!-- #endif -->

			<!-- #ifdef APP-PLUS -->
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">系统通知权限</text>
					<text class="cell-desc">{{ noticeEnabled ? '系统通知权限已开启，可正常接收作业提醒。' : '系统通知权限未开启，将无法接收作业提醒通知。' }}</text>
				</view>
				<view class="test-row">
					<button class="primary-btn test-btn" :class="{ 'is-ok': noticeEnabled }" :disabled="noticeEnabled" @click="openSysSettings">{{ noticeEnabled ? '权限正常' : '去开启' }}</button>
				</view>
			</view>

			<view class="divider"></view>
			<!-- #endif -->

			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">测试提醒通知</text>
					<text class="cell-desc">{{ testDesc }}</text>
				</view>
				<view class="test-row">
					<!-- #ifdef APP-PLUS -->
					<button class="primary-btn test-btn" @click="testAndroidNotice">测试 App 通知</button>
					<!-- #endif -->
					<!-- #ifdef MP-WEIXIN -->
					<button class="primary-btn test-btn" @click="testMiniProgramNotice">测试小程序</button>
					<!-- #endif -->
				</view>
			</view>
		</view>

		<view class="card">
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">提醒模式</text>
					<text class="cell-desc">智能模式会按课表在下一次对应课程开始前提醒；传统模式按截止前小时提醒。</text>
				</view>
				<view class="mode-row">
					<view :class="['mode-chip', reminderMode === smartMode ? 'active' : '']" @click="setReminderMode(smartMode)">智能提醒</view>
					<view :class="['mode-chip', reminderMode === traditionalMode ? 'active' : '']" @click="setReminderMode(traditionalMode)">传统提醒</view>
				</view>
			</view>

			<view v-if="reminderMode === smartMode" class="divider"></view>

			<view v-if="reminderMode === smartMode" class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">智能提醒时间</text>
					<text class="cell-desc">{{ smartReminderDesc }}</text>
				</view>
				<view class="input-row">
					<input class="num-input small" type="number" v-model="smartHours" placeholder="1" maxlength="3" />
					<text class="input-unit compact">小时</text>
					<input class="num-input small" type="number" v-model="smartMinutes" placeholder="0" maxlength="2" />
					<text class="input-unit compact">分钟</text>
					<button class="primary-btn" @click="saveSmartReminderOffset">保存</button>
				</view>
			</view>
		</view>

		<view v-if="reminderMode === traditionalMode" class="card">
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">默认提醒时间</text>
					<text class="cell-desc">传统模式下，新作业默认在截止前 N 小时提醒</text>
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
import {
	requestNotificationPermission,
	getNotificationPermissionStatus,
	getSystemNotificationPermissionStatus,
	openSystemNotificationSettings,
	getInstalledAppsListPermissionStatus,
	requestInstalledAppsListPermission,
	testReminderNotification,
	getReminderMode,
	saveReminderMode,
	getSmartReminderOffsetParts,
	saveSmartReminderOffsetMinutes,
	REMINDER_MODE_TRADITIONAL,
	REMINDER_MODE_SMART
} from '@/utils/notification.js'

const DEFAULT_DEADLINE_OFFSET_KEY = 'default_deadline_offset_hours'
const DEFAULT_DEADLINE_OFFSET_HOURS = 24
const DEFAULT_REMINDER_OFFSET_KEY = 'default_reminder_offset_hours'
const DEFAULT_REMINDER_OFFSET_HOURS = 23

export default {
	data() {
		return {
			noticeEnabled: false,
			defaultDeadlineOffsetHours: `${DEFAULT_DEADLINE_OFFSET_HOURS}`,
			defaultReminderOffsetHours: `${DEFAULT_REMINDER_OFFSET_HOURS}`,
			reminderMode: REMINDER_MODE_SMART,
			traditionalMode: REMINDER_MODE_TRADITIONAL,
			smartMode: REMINDER_MODE_SMART,
			smartHours: '1',
			smartMinutes: '0'
		}
	},
	computed: {
		smartReminderDesc() {
			const hours = Number(this.smartHours)
			const minutes = Number(this.smartMinutes)
			if (!Number.isInteger(hours) || hours < 0 || hours > 168 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || hours * 60 + minutes <= 0) {
				return '在下一次课开始前指定时间提醒你完成作业。'
			}
			const parts = []
			if (hours > 0) parts.push(`${hours}小时`)
			if (minutes > 0) parts.push(`${minutes}分钟`)
			return `将在下一次课开始前${parts.join('')}提醒你完成作业。`
		},
		testDesc() {
			// #ifdef APP-PLUS
			return '发送一条测试提醒，验证 App 本地通知是否正常。'
			// #endif
			// #ifdef MP-WEIXIN
			return '发送一条测试提醒，验证微信小程序服务通知是否正常。'
			// #endif
			// #ifndef APP-PLUS || MP-WEIXIN
			return '发送一条测试提醒，验证通知是否正常。'
			// #endif
		}
	},
	onShow() {
		this.loadNoticeStatus()
		this.loadDefaultDeadlineOffset()
		this.loadDefaultReminderOffset()
		this.loadReminderMode()
		this.loadSmartReminderOffset()
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
		loadNoticeStatus() {
			// APP 端查询系统真实权限；小程序端回退到存储值
			this.noticeEnabled = getSystemNotificationPermissionStatus()
		},
		async requestNoticePermission() {
			const enabled = await requestNotificationPermission({ showToast: true })
			this.noticeEnabled = enabled
		},
		async openSysSettings() {
			// Android 端：先检测「获取已安装应用列表」权限，未获取则请求获取
			// #ifdef APP-PLUS
			if (!getInstalledAppsListPermissionStatus()) {
				uni.showLoading({ title: '正在请求权限', mask: true })
				await requestInstalledAppsListPermission()
				uni.hideLoading()
				if (!getInstalledAppsListPermissionStatus()) {
					uni.showToast({ title: '未获取已安装应用列表权限', icon: 'none' })
				}
			}
			// #endif
			const ok = openSystemNotificationSettings()
			if (!ok) {
				uni.showToast({ title: '无法打开系统设置', icon: 'none' })
			}
		},
		async testAndroidNotice() {
			const sent = await testReminderNotification('app-android')
			if (sent) this.loadNoticeStatus()
		},
		async testMiniProgramNotice() {
			const sent = await testReminderNotification('mp-weixin')
			if (sent) this.loadNoticeStatus()
		},
		loadDefaultDeadlineOffset() {
			const saved = Number(uni.getStorageSync(DEFAULT_DEADLINE_OFFSET_KEY))
			this.defaultDeadlineOffsetHours = `${saved > 0 ? saved : DEFAULT_DEADLINE_OFFSET_HOURS}`
		},
		loadDefaultReminderOffset() {
			const saved = Number(uni.getStorageSync(DEFAULT_REMINDER_OFFSET_KEY))
			this.defaultReminderOffsetHours = `${saved > 0 ? saved : DEFAULT_REMINDER_OFFSET_HOURS}`
		},
		loadReminderMode() {
			this.reminderMode = getReminderMode()
		},
		loadSmartReminderOffset() {
			const parts = getSmartReminderOffsetParts()
			this.smartHours = `${parts.hours}`
			this.smartMinutes = `${parts.minutes}`
		},
		setReminderMode(mode) {
			this.reminderMode = saveReminderMode(mode)
			uni.showToast({ title: this.reminderMode === REMINDER_MODE_SMART ? '已启用智能提醒' : '已启用传统提醒', icon: 'none' })
		},
		saveSmartReminderOffset() {
			const hours = Number(this.smartHours)
			const minutes = Number(this.smartMinutes)
			if (!Number.isInteger(hours) || hours < 0 || hours > 168 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || hours * 60 + minutes <= 0) {
				uni.showToast({ title: '请输入有效的小时和分钟', icon: 'none' })
				this.loadSmartReminderOffset()
				return
			}
			const saved = saveSmartReminderOffsetMinutes(hours * 60 + minutes)
			this.smartHours = `${Math.floor(saved / 60)}`
			this.smartMinutes = `${saved % 60}`
			uni.showToast({ title: '已保存', icon: 'success' })
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
	padding: 28rpx 28rpx 40rpx;
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

.mode-row,
.test-row {
	display: flex;
	gap: 16rpx;
}

.test-btn {
	flex: 1;
}

.mode-chip {
	flex: 1;
	padding: 22rpx 0;
	border-radius: 18rpx;
	background: #f4f6fb;
	text-align: center;
	font-size: 28rpx;
	font-weight: 800;
	color: #6b7280;
}

.mode-chip.active {
	background: #2979ff;
	color: #ffffff;
}

.num-input.small {
	width: 120rpx;
}

.input-unit.compact {
	flex: 0 0 auto;
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

.primary-btn.is-ok {
	background: #e5f7ee;
	color: #10b981;
}

.primary-btn.is-ok[disabled] {
	opacity: 1;
}
</style>
