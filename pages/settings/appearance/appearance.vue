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
					<text class="form-label-strong">重叠显示模式</text>
				</view>
				<text class="cell-desc">同一时段存在多门课时，可选择"切换显示"（轮流闪烁）或"重叠显示"（按学科顺序分层同时显示）。</text>
				<view class="mode-row">
					<view :class="['mode-chip', appearance.overlapDisplayMode === 'switch' ? 'active' : '']" @click="setOverlapMode('switch')">切换显示</view>
					<view :class="['mode-chip', appearance.overlapDisplayMode === 'overlap' ? 'active' : '']" @click="setOverlapMode('overlap')">重叠显示</view>
				</view>
			</view>

			<view class="form-row form-row-block">
				<view class="form-row-head">
					<text class="form-label-strong">最低透明度</text>
					<text class="form-value">{{ Math.round(appearance.overlapMinOpacity * 100) }}%</text>
				</view>
				<text class="cell-desc">切换显示模式下非激活课程的最低可见度；重叠显示模式下最底层课程的透明度。</text>
				<slider
					:value="minOpacityPercent"
					:min="0"
					:max="50"
					:step="5"
					show-value
					activeColor="#2979ff"
					@change="onMinOpacityChange"
				/>
			</view>

			<view v-if="appearance.overlapDisplayMode === 'switch'" class="form-row form-row-block">
				<view class="form-row-head">
					<text class="form-label-strong">切换频率</text>
					<text class="form-value">{{ switchFrequencySecondsText }} 秒</text>
				</view>
				<text class="cell-desc">切换显示模式下，每节课的停留时长（含淡入淡出）。</text>
				<slider
					:value="switchFrequencyTenth"
					:min="10"
					:max="100"
					:step="5"
					activeColor="#2979ff"
					@change="onSwitchFrequencyChange"
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
					@click="onPresetPick(color)"
				></view>
			</view>
			<view class="picker-wheel">
				<view class="wheel-row">
					<text class="wheel-label">色相</text>
					<slider
						class="wheel-slider hue-slider"
						:min="0"
						:max="360"
						:step="1"
						:value="pickerHue"
						:activeColor="`hsl(${pickerHue},100%,50%)`"
						background-color="#9ca3af"
						block-size="20"
						@changing="onHueChanging"
						@change="onHueChange"
					/>
					<text class="wheel-value">{{ pickerHue }}</text>
				</view>
				<view class="wheel-row">
					<text class="wheel-label">饱和度</text>
					<slider
						class="wheel-slider"
						:min="0"
						:max="100"
						:step="1"
						:value="pickerSat"
						:activeColor="`hsl(${pickerHue},${pickerSat}%,50%)`"
						background-color="#e5e7eb"
						block-size="20"
						@changing="onSatChanging"
						@change="onSatChange"
					/>
					<text class="wheel-value">{{ pickerSat }}%</text>
				</view>
				<view class="wheel-row">
					<text class="wheel-label">明度</text>
					<slider
						class="wheel-slider"
						:min="0"
						:max="100"
						:step="1"
						:value="pickerLight"
						:activeColor="`hsl(${pickerHue},${pickerSat}%,${pickerLight}%)`"
						background-color="#e5e7eb"
						block-size="20"
						@changing="onLightChanging"
						@change="onLightChange"
					/>
					<text class="wheel-value">{{ pickerLight }}%</text>
				</view>
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
			colorPresets: COURSE_COLOR_PRESETS,
			pickerHue: 0,
			pickerSat: 100,
			pickerLight: 50
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
		switchFrequencyTenth() {
			const ms = Number(this.appearance.overlapSwitchFrequency) || 2000
			return Math.round(ms / 100)
		},
		switchFrequencySecondsText() {
			const ms = Number(this.appearance.overlapSwitchFrequency) || 2000
			return (ms / 1000).toFixed(1)
		},
		minOpacityPercent() {
			return Math.round((this.appearance.overlapMinOpacity || 0.1) * 100)
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
			this.appearance = saveAppearance({ ...this.appearance, backgroundImage: path, updatedAt: Date.now() })
			uni.showToast({ title: '已设置', icon: 'success' })
		},
		clearBackground() {
			this.appearance = saveAppearance({ ...this.appearance, backgroundImage: '', updatedAt: Date.now() })
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
			// slider 值单位为 0.1 秒，× 100 还原为毫秒（废弃，迁移到 overlapSwitchFrequency）
			const ms = Number(event.detail.value) * 100
			this.appearance = saveAppearance({ ...this.appearance, overlapBlinkCycleMs: ms, overlapSwitchFrequency: ms })
		},
		onSwitchFrequencyChange(event) {
			const ms = Number(event.detail.value) * 100
			this.appearance = saveAppearance({ ...this.appearance, overlapSwitchFrequency: ms })
		},
		onMinOpacityChange(event) {
			const value = Number(event.detail.value) / 100
			this.appearance = saveAppearance({ ...this.appearance, overlapMinOpacity: value })
		},
		setOverlapMode(mode) {
			this.appearance = saveAppearance({ ...this.appearance, overlapDisplayMode: mode })
		},
		openColorPicker(item) {
			this.pickerTarget = item
			this.pickerColor = item.color
			this.syncHslFromColor(item.color)
			this.pickerVisible = true
		},
		closeColorPicker() {
			this.pickerVisible = false
			this.pickerTarget = null
		},
		// === HSL 色环调色 ===
		// hex -> { h, s, l }（h:0-360, s/l:0-100）
		hexToHsl(hex) {
			const m = `${hex || ''}`.replace('#', '')
			let r = 0, g = 0, b = 0
			if (m.length === 3) {
				r = parseInt(m[0] + m[0], 16)
				g = parseInt(m[1] + m[1], 16)
				b = parseInt(m[2] + m[2], 16)
			} else if (m.length === 6) {
				r = parseInt(m.slice(0, 2), 16)
				g = parseInt(m.slice(2, 4), 16)
				b = parseInt(m.slice(4, 6), 16)
			}
			r /= 255; g /= 255; b /= 255
			const max = Math.max(r, g, b), min = Math.min(r, g, b)
			let h = 0, s = 0
			const l = (max + min) / 2
			if (max !== min) {
				const d = max - min
				s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
				switch (max) {
					case r: h = ((g - b) / d + (g < b ? 6 : 0)); break
					case g: h = ((b - r) / d + 2); break
					case b: h = ((r - g) / d + 4); break
				}
				h *= 60
			}
			return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
		},
		// { h, s, l } -> hex
		hslToHex(h, s, l) {
			h = ((h % 360) + 360) % 360
			s = Math.max(0, Math.min(100, s)) / 100
			l = Math.max(0, Math.min(100, l)) / 100
			const c = (1 - Math.abs(2 * l - 1)) * s
			const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
			const m2 = l - c / 2
			let r = 0, g = 0, b = 0
			if (h < 60) { r = c; g = x; b = 0 }
			else if (h < 120) { r = x; g = c; b = 0 }
			else if (h < 180) { r = 0; g = c; b = x }
			else if (h < 240) { r = 0; g = x; b = c }
			else if (h < 300) { r = x; g = 0; b = c }
			else { r = c; g = 0; b = x }
			const toHex = n => `${Math.round((n + m2) * 255).toString(16).padStart(2, '0')}`
			return `#${toHex(r)}${toHex(g)}${toHex(b)}`
		},
		syncHslFromColor(color) {
			const hsl = this.hexToHsl(color)
			this.pickerHue = hsl.h
			this.pickerSat = hsl.s
			this.pickerLight = hsl.l
		},
		onPresetPick(color) {
			this.pickerColor = color
			this.syncHslFromColor(color)
		},
		applyHslToColor() {
			this.pickerColor = this.hslToHex(this.pickerHue, this.pickerSat, this.pickerLight)
		},
		onHueChanging(e) { this.pickerHue = Number(e.detail.value); this.applyHslToColor() },
		onHueChange(e) { this.pickerHue = Number(e.detail.value); this.applyHslToColor() },
		onSatChanging(e) { this.pickerSat = Number(e.detail.value); this.applyHslToColor() },
		onSatChange(e) { this.pickerSat = Number(e.detail.value); this.applyHslToColor() },
		onLightChanging(e) { this.pickerLight = Number(e.detail.value); this.applyHslToColor() },
		onLightChange(e) { this.pickerLight = Number(e.detail.value); this.applyHslToColor() },
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

.picker-wheel {
	margin: 4rpx 0 16rpx;
	padding: 16rpx 4rpx 4rpx;
	border-top: 2rpx solid #f1f3f7;
}

.wheel-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-bottom: 12rpx;
}

.wheel-label {
	flex: 0 0 96rpx;
	font-size: 24rpx;
	font-weight: 700;
	color: #6b7280;
}

.wheel-slider {
	flex: 1;
	margin: 0;
}

.hue-slider {
	background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
	border-radius: 8rpx;
}

.wheel-value {
	flex: 0 0 90rpx;
	font-size: 24rpx;
	font-weight: 700;
	color: #1f2937;
	text-align: right;
}

.picker-actions {
	display: flex;
	gap: 18rpx;
}

.mode-row {
	display: flex;
	gap: 16rpx;
	margin-top: 8rpx;
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
</style>
