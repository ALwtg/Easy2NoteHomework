<template>
	<view class="page" :style="kbStyle">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">课表外观</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="card">
			<view class="cell-main top-tip">
				<text class="cell-title">背景图片</text>
				<text class="cell-desc">为课表页设置一张背景图，可调透明度避免影响文字阅读。</text>
			</view>

			<view class="bg-preview" :style="bgPreviewStyle">
				<view v-if="!appearance.backgroundImage" class="bg-empty">
					<text>暂未设置背景</text>
				</view>
			</view>

			<view class="action-row">
				<button class="primary-btn full" @click="chooseBackground">选择图片</button>
				<button class="ghost-btn full" @click="clearBackground" :disabled="!appearance.backgroundImage">清除</button>
			</view>

			<view class="form-row form-row-block">
				<view class="form-row-head">
					<text class="form-label-strong">背景透明度</text>
					<text class="form-value">{{ Math.round(appearance.backgroundOpacity * 100) }}%</text>
				</view>
				<slider
					:value="bgOpacityPercent"
					:min="10"
					:max="100"
					:step="5"
					show-value
					activeColor="#2979ff"
					@change="onBgOpacityChange"
				/>
			</view>

			<view class="form-row form-row-block">
				<view class="form-row-head">
					<text class="form-label-strong">课程卡片透明度</text>
					<text class="form-value">{{ Math.round(appearance.cardOpacity * 100) }}%</text>
				</view>
				<slider
					:value="cardOpacityPercent"
					:min="40"
					:max="100"
					:step="5"
					show-value
					activeColor="#2979ff"
					@change="onCardOpacityChange"
				/>
			</view>

			<view class="form-row form-row-block">
				<view class="form-row-head">
					<text class="form-label-strong">重叠课程切换时长</text>
					<text class="form-value">{{ blinkCycleSecondsText }} 秒</text>
				</view>
				<text class="cell-desc">同一时段存在多门课时，按设定时长依次淡入/淡出循环显示。</text>
				<slider
					:value="blinkCycleTenth"
					:min="10"
					:max="100"
					:step="5"
					activeColor="#2979ff"
					@change="onBlinkCycleChange"
				/>
			</view>
		</view>

		<view class="card">
			<view class="cell-main top-tip">
				<text class="cell-title">课程颜色</text>
				<text class="cell-desc">点击课程选择颜色，导入和手动添加的课程都可调整。</text>
			</view>

			<view v-if="!subjects.length" class="empty">
				<text>还没有课程，导入或手动添加后即可设置颜色。</text>
			</view>

			<view v-else class="subject-grid">
				<view
					v-for="item in subjects"
					:key="item.subject"
					class="subject-row"
					@click="openColorPicker(item)"
				>
					<view class="subject-swatch" :style="{ background: item.color }"></view>
					<view class="subject-info">
						<text class="subject-name">{{ item.subject }}</text>
						<text v-if="item.teachers" class="subject-meta">{{ item.teachers }}</text>
					</view>
					<text v-if="colorMap[item.subject]" class="subject-tag">已自定义</text>
					<text class="subject-arrow">›</text>
				</view>
			</view>

			<view v-if="subjects.length" class="action-row">
				<button class="ghost-btn full" @click="resetAllColors">恢复默认配色</button>
			</view>
		</view>

		<view v-if="pickerVisible" class="picker-mask" @click="closeColorPicker">
			<view class="picker-card" @click.stop>
				<view class="picker-head">
					<text class="picker-title">{{ pickerTarget && pickerTarget.subject }}</text>
					<text class="picker-close" @click="closeColorPicker">×</text>
				</view>
				<view class="picker-current">
					<view class="picker-preview" :style="{ background: pickerColor }"></view>
					<text class="picker-hex">{{ pickerColor }}</text>
				</view>
				<view class="picker-grid">
					<view
						v-for="color in colorPresets"
						:key="color"
						class="picker-swatch"
						:class="{ active: pickerColor === color }"
						:style="{ background: color }"
						@click="pickerColor = color"
					></view>
				</view>
				<view class="picker-actions">
					<button class="ghost-btn full" @click="resetCourseColor">恢复默认</button>
					<button class="primary-btn full" @click="confirmCourseColor">应用</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import {
	loadCourses,
	loadCourseColorMap,
	saveCourseColorMap,
	setCourseColor,
	pickCourseColor,
	resolveCourseColor,
	loadAppearance,
	saveAppearance,
	COURSE_COLOR_PRESETS
} from '@/utils/schedule.js'

export default {
	data() {
		return {
			appearance: loadAppearance(),
			courses: [],
			colorMap: {},
			pickerVisible: false,
			pickerTarget: null,
			pickerColor: '',
			colorPresets: COURSE_COLOR_PRESETS
		}
	},
	computed: {
		bgPreviewStyle() {
			const base = 'background-color:#eef2f7;'
			if (!this.appearance.backgroundImage) return base
			return `${base}background-image:url('${this.appearance.backgroundImage}');background-size:cover;background-position:center;opacity:${this.appearance.backgroundOpacity};`
		},
		bgOpacityPercent() {
			return Math.round(this.appearance.backgroundOpacity * 100)
		},
		cardOpacityPercent() {
			return Math.round(this.appearance.cardOpacity * 100)
		},
		blinkCycleTenth() {
			// slider 以 0.1 秒为单位，范围 10~100（即 1.0s ~ 10.0s）
			const ms = Number(this.appearance.overlapBlinkCycleMs) || 5000
			return Math.round(ms / 100)
		},
		blinkCycleSecondsText() {
			const ms = Number(this.appearance.overlapBlinkCycleMs) || 5000
			return (ms / 1000).toFixed(1)
		},
		subjects() {
			const map = new Map()
			this.courses.forEach(course => {
				const subject = `${course.subject || ''}`.trim()
				if (!subject) return
				if (!map.has(subject)) {
					map.set(subject, {
						subject,
						teachers: new Set(),
						fallback: course.color || pickCourseColor(subject)
					})
				}
				if (course.teacher) map.get(subject).teachers.add(course.teacher)
			})
			return Array.from(map.values()).map(item => ({
				subject: item.subject,
				teachers: Array.from(item.teachers).join(' / '),
				color: resolveCourseColor(item.subject, item.fallback, this.colorMap)
			}))
		}
	},
	onShow() {
		this.refresh()
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
		refresh() {
			this.appearance = loadAppearance()
			this.courses = loadCourses()
			this.colorMap = loadCourseColorMap()
		},
		chooseBackground() {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				sourceType: ['album', 'camera'],
				success: res => {
					const path = (res.tempFilePaths && res.tempFilePaths[0]) || ''
					if (!path) return
					this.persistBackground(path)
				},
				fail: () => {
					uni.showToast({ title: '取消选择', icon: 'none' })
				}
			})
		},
		persistBackground(path) {
			// #ifdef APP-PLUS
			try {
				const target = `_doc/schedule_bg_${Date.now()}.jpg`
				plus.io.resolveLocalFileSystemURL(path, entry => {
					plus.io.resolveLocalFileSystemURL('_doc/', root => {
						entry.copyTo(root, target.replace('_doc/', ''), () => {
							const localUrl = plus.io.convertLocalFileSystemURL(target)
							this.savePersistentBackground(localUrl || path)
						}, () => this.savePersistentBackground(path))
					}, () => this.savePersistentBackground(path))
				}, () => this.savePersistentBackground(path))
				return
			} catch (e) {
				this.savePersistentBackground(path)
				return
			}
			// #endif
			this.savePersistentBackground(path)
		},
		savePersistentBackground(path) {
			this.appearance = saveAppearance({ ...this.appearance, backgroundImage: path })
			uni.showToast({ title: '已设置', icon: 'success' })
		},
		clearBackground() {
			this.appearance = saveAppearance({ ...this.appearance, backgroundImage: '' })
			uni.showToast({ title: '已清除', icon: 'none' })
		},
		onBgOpacityChange(event) {
			const value = Number(event.detail.value) / 100
			this.appearance = saveAppearance({ ...this.appearance, backgroundOpacity: value })
		},
		onCardOpacityChange(event) {
			const value = Number(event.detail.value) / 100
			this.appearance = saveAppearance({ ...this.appearance, cardOpacity: value })
		},
		onBlinkCycleChange(event) {
			// slider 值单位为 0.1 秒，× 100 还原为毫秒
			const ms = Number(event.detail.value) * 100
			this.appearance = saveAppearance({ ...this.appearance, overlapBlinkCycleMs: ms })
		},
		openColorPicker(item) {
			this.pickerTarget = item
			this.pickerColor = item.color
			this.pickerVisible = true
		},
		closeColorPicker() {
			this.pickerVisible = false
			this.pickerTarget = null
		},
		confirmCourseColor() {
			if (!this.pickerTarget) return
			this.colorMap = setCourseColor(this.pickerTarget.subject, this.pickerColor)
			uni.showToast({ title: '已应用', icon: 'success' })
			this.closeColorPicker()
		},
		resetCourseColor() {
			if (!this.pickerTarget) return
			this.colorMap = setCourseColor(this.pickerTarget.subject, '')
			uni.showToast({ title: '已恢复', icon: 'none' })
			this.closeColorPicker()
		},
		resetAllColors() {
			uni.showModal({
				title: '恢复默认配色',
				content: '将清除所有课程的自定义颜色，确定继续？',
				confirmText: '恢复',
				confirmColor: '#ef4444',
				success: res => {
					if (!res.confirm) return
					this.colorMap = saveCourseColorMap({})
					uni.showToast({ title: '已恢复', icon: 'success' })
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
	margin-bottom: 24rpx;
	padding: 24rpx 28rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.cell-main {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.top-tip {
	margin-bottom: 16rpx;
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

.bg-preview {
	height: 280rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	margin-bottom: 18rpx;
}

.bg-empty {
	color: #9ca3af;
	font-size: 26rpx;
}

.action-row {
	display: flex;
	gap: 18rpx;
	margin-top: 12rpx;
}

.primary-btn,
.ghost-btn {
	height: 80rpx;
	line-height: 80rpx;
	margin: 0;
	padding: 0 24rpx;
	border-radius: 18rpx;
	font-size: 26rpx;
	font-weight: 700;
}

.primary-btn {
	background: #2979ff;
	color: #fff;
}

.ghost-btn {
	background: #f4f6fb;
	color: #111827;
	min-width: 132rpx;
}

.primary-btn.full,
.ghost-btn.full {
	flex: 1;
}

.primary-btn::after,
.ghost-btn::after {
	border: 0;
}

.form-row-block {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	padding: 18rpx 0 4rpx;
}

.form-row-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.form-label-strong {
	font-size: 28rpx;
	font-weight: 700;
	color: #1f2937;
}

.form-value {
	font-size: 26rpx;
	font-weight: 700;
	color: #2979ff;
}

.empty {
	padding: 40rpx 0;
	text-align: center;
	font-size: 26rpx;
	color: #9ca3af;
}

.subject-grid {
	display: flex;
	flex-direction: column;
	gap: 4rpx;
	margin-top: 8rpx;
}

.subject-row {
	display: flex;
	align-items: center;
	gap: 18rpx;
	padding: 22rpx 8rpx;
	border-top: 2rpx solid #f1f3f7;
}

.subject-row:first-of-type {
	border-top: 0;
}

.subject-swatch {
	width: 56rpx;
	height: 56rpx;
	border-radius: 16rpx;
	box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.14);
}

.subject-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.subject-name {
	font-size: 28rpx;
	font-weight: 700;
	color: #111827;
}

.subject-meta {
	font-size: 22rpx;
	color: #9ca3af;
}

.subject-tag {
	font-size: 22rpx;
	color: #2979ff;
	padding: 4rpx 12rpx;
	background: #eaf2ff;
	border-radius: 999rpx;
}

.subject-arrow {
	font-size: 36rpx;
	color: #cbd5e1;
}

.picker-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	background: rgba(15, 23, 42, 0.45);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 99;
	padding: 0 40rpx;
}

.picker-card {
	width: 100%;
	background: #fff;
	border-radius: 28rpx;
	padding: 28rpx;
	box-sizing: border-box;
}

.picker-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
}

.picker-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #111827;
}

.picker-close {
	font-size: 44rpx;
	font-weight: 600;
	color: #94a3b8;
	line-height: 1;
}

.picker-current {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-bottom: 20rpx;
	padding: 16rpx;
	border-radius: 18rpx;
	background: #f8fafc;
}

.picker-preview {
	width: 72rpx;
	height: 72rpx;
	border-radius: 16rpx;
}

.picker-hex {
	font-size: 28rpx;
	font-weight: 700;
	color: #1f2937;
	letter-spacing: 1rpx;
}

.picker-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 18rpx;
	padding: 8rpx 4rpx 18rpx;
}

.picker-swatch {
	width: 80rpx;
	height: 80rpx;
	border-radius: 18rpx;
	box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.12);
	border: 4rpx solid transparent;
	box-sizing: border-box;
}

.picker-swatch.active {
	border-color: #111827;
}

.picker-actions {
	display: flex;
	gap: 18rpx;
}
</style>
