<template>
	<view class="page" :style="kbStyle">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">数据清理</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="card">
			<view class="cell-main">
				<text class="cell-title">作业清理</text>
				<text class="cell-desc">仅删除已标记完成的作业，未完成作业不受影响。</text>
			</view>
			<button class="danger-btn" @click="clearCompletedHomework">清除全部已完成的作业</button>
		</view>
	</view>
</template>

<script>
const HOMEWORK_KEY = 'homework_list'

export default {
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
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
	padding: 28rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
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

.danger-btn {
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

.danger-btn::after {
	border: 0;
}
</style>
