<template>
	<view class="page">
		<view class="custom-nav">
			<text class="nav-title">设置</text>
		</view>

		<view class="group-card">
			<view class="group-title">提醒与时间</view>
			<view class="entry-item" hover-class="entry-item-hover" @click="goTo('reminder')">
				<view class="entry-icon entry-icon-blue">
					<text class="entry-emoji">🔔</text>
				</view>
				<view class="entry-main">
					<text class="entry-title">提醒设置</text>
					<text class="entry-desc">微信服务通知 · 默认提醒/截止时间</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
			<view class="entry-item" hover-class="entry-item-hover" @click="goTo('semester')">
				<view class="entry-icon entry-icon-purple">
					<text class="entry-emoji">📅</text>
				</view>
				<view class="entry-main">
					<text class="entry-title">课表设置</text>
					<text class="entry-desc">开学日期 · 节次时间</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
			<view class="entry-item" hover-class="entry-item-hover" @click="goTo('appearance')">
				<view class="entry-icon entry-icon-pink">
					<text class="entry-emoji">🎨</text>
				</view>
				<view class="entry-main">
					<text class="entry-title">课表外观</text>
					<text class="entry-desc">背景图片 · 透明度 · 课程配色</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
		</view>

		<view class="group-card">
			<view class="group-title">作业内容</view>
			<view class="entry-item" hover-class="entry-item-hover" @click="goTo('subjects')">
				<view class="entry-icon entry-icon-green">
					<text class="entry-emoji">📚</text>
				</view>
				<view class="entry-main">
					<text class="entry-title">学科管理</text>
					<text class="entry-desc">新增、改名或删除学科</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
			<view class="entry-item" hover-class="entry-item-hover" @click="goTo('data')">
				<view class="entry-icon entry-icon-red">
					<text class="entry-emoji">🧹</text>
				</view>
				<view class="entry-main">
					<text class="entry-title">数据清理</text>
					<text class="entry-desc">一键清除已完成作业</text>
				</view>
				<text class="entry-arrow">›</text>
			</view>
		</view>

		<view class="footer">
			<text class="footer-text">联系开发者 QQ：3383623610</text>
		</view>
	</view>
</template>

<script>
const ROUTE_MAP = {
	reminder: '/pages/settings/reminder/reminder',
	semester: '/pages/settings/semester/semester',
	appearance: '/pages/settings/appearance/appearance',
	subjects: '/pages/settings/subjects/subjects',
	data: '/pages/settings/data/data'
}

export default {
	methods: {
		goTo(key) {
			const url = ROUTE_MAP[key]
			if (!url) return
			uni.navigateTo({ url })
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

.group-card {
	margin-bottom: 28rpx;
	padding: 18rpx 24rpx 8rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.group-title {
	padding: 14rpx 4rpx 18rpx;
	font-size: 24rpx;
	font-weight: 700;
	color: #9ca3af;
	letter-spacing: 1rpx;
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

.entry-icon-purple {
	background: #efeaff;
}

.entry-icon-green {
	background: #e6f7ee;
}

.entry-icon-red {
	background: #fdecec;
}

.entry-icon-pink {
	background: #ffeaf2;
}

.entry-emoji {
	font-size: 38rpx;
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
