<template>
	<view class="page" :style="kbStyle">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">关于</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="brand">
			<image class="brand-logo" src="/static/logo.png" mode="aspectFit"></image>
			<text class="brand-name">记作业助手</text>
			<text class="brand-version">版本 {{ version }}</text>
		</view>

		<view class="card">
			<view class="entry-item" hover-class="entry-item-hover" @click="copyQQGroup">
				<view class="entry-icon entry-icon-blue">
					<image class="entry-img" src="/static/qq-group.png" mode="aspectFit"></image>
				</view>
				<view class="entry-main">
					<text class="entry-title">交流 Q 群</text>
					<text class="entry-desc">{{ qqGroup }} · 点击复制</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
			<view class="entry-item" hover-class="entry-item-hover" @click="checkUpdate">
				<view class="entry-icon entry-icon-green">
					<image class="entry-img" src="/static/check-update.png" mode="aspectFit"></image>
				</view>
				<view class="entry-main">
					<text class="entry-title">检查版本</text>
					<text class="entry-desc">查看最新版本与更新日志</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
		</view>

		<view class="footer">
			<text class="footer-text">© 记作业助手</text>
		</view>
	</view>
</template>

<script>
import manifest from '@/manifest.json'

const UPDATE_URL = 'https://my.feishu.cn/wiki/D0RdwUftFiLFXFkWGAqcvZQWnhb'
const QQ_GROUP = '635879894'

export default {
	data() {
		return {
			version: '',
			qqGroup: QQ_GROUP
		}
	},
	onLoad() {
		this.version = this.getAppVersion()
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
		getAppVersion() {
			let v = ''
			try {
				if (manifest && manifest.versionName) {
					v = manifest.versionName
				}
			} catch (e) {}
			// #ifdef APP-PLUS
			try {
				if (typeof plus !== 'undefined' && plus.runtime && plus.runtime.version) {
					v = plus.runtime.version
				}
			} catch (e) {}
			// #endif
			// #ifdef MP-WEIXIN
			try {
				const info = uni.getAccountInfoSync && uni.getAccountInfoSync()
				if (info && info.miniProgram && info.miniProgram.version) {
					v = info.miniProgram.version
				}
			} catch (e) {}
			// #endif
			return v || '1.0.0'
		},
		copyQQGroup() {
			uni.setClipboardData({
				data: QQ_GROUP,
				success: () => {
					uni.showToast({ title: 'Q 群号已复制', icon: 'success' })
				}
			})
		},
		checkUpdate() {
			// #ifdef APP-PLUS
			plus.runtime.openURL(UPDATE_URL)
			return
			// #endif
			// #ifdef MP-WEIXIN
			uni.setClipboardData({
				data: UPDATE_URL,
				success: () => {
					uni.showModal({
						title: '检查版本',
						content: '已复制更新链接，请在浏览器中打开查看最新版本。',
						showCancel: false,
						confirmText: '我知道了'
					})
				}
			})
			return
			// #endif
			// #ifdef H5
			window.open(UPDATE_URL, '_blank')
			// #endif
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

.brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16rpx;
	padding: 60rpx 0 50rpx;
}

.brand-logo {
	width: 160rpx;
	height: 160rpx;
	border-radius: 36rpx;
	box-shadow: 0 14rpx 30rpx rgba(37, 99, 235, 0.18);
	background: #fff;
}

.brand-name {
	font-size: 36rpx;
	font-weight: 800;
	color: #111827;
}

.brand-version {
	font-size: 24rpx;
	color: #9ca3af;
}

.card {
	padding: 18rpx 24rpx 8rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.entry-item {
	display: flex;
	align-items: center;
	gap: 22rpx;
	padding: 26rpx 4rpx;
	border-top: 2rpx solid #f1f3f7;
}

.entry-item:first-of-type {
	border-top: 0;
}

.entry-item-hover {
	background: #f8fafc;
	border-radius: 16rpx;
}

.entry-icon {
	width: 72rpx;
	height: 72rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.entry-icon-blue {
	background: #eaf2ff;
}

.entry-icon-green {
	background: #e6f7ee;
}

.entry-emoji {
	font-size: 38rpx;
}

.entry-img {
	width: 44rpx;
	height: 44rpx;
}

.entry-main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.entry-title {
	font-size: 30rpx;
	font-weight: 800;
	color: #111827;
}

.entry-desc {
	font-size: 24rpx;
	color: #9ca3af;
}

.entry-arrow {
	font-size: 40rpx;
	font-weight: 600;
	color: #cbd5e1;
	margin-left: 8rpx;
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
