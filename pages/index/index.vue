<template>
	<view class="page">
		<text class="redirect-text">正在跳转...</text>
	</view>
</template>

<script>
export default {
	onLoad() {
		// 跳转到记录作业页面
		uni.switchTab({
			url: '/pages/record/record'
		})
	}
}
</script>

<style>
.page {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f4f7fb;
}

.redirect-text {
	font-size: 28rpx;
	color: #6b7280;
}
</style>