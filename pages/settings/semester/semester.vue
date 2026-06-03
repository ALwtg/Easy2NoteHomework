<template>
	<view class="page">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">课表设置</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="card">
			<view class="cell cell-block">
				<view class="cell-main">
					<text class="cell-title">开学日期</text>
					<text class="cell-desc">用于课表周次计算，选择本学期第 1 周的周一</text>
				</view>
				<view class="input-row">
					<picker mode="date" :value="semesterStart" @change="onSemesterStartChange">
						<view class="picker-box">{{ semesterStart || '选择开学日期' }}</view>
					</picker>
					<button v-if="semesterStart" class="ghost-btn" @click="clearSemesterStart">清除</button>
				</view>
			</view>
		</view>

		<view class="card">
			<view class="cell-main top-tip">
				<text class="cell-title">节次时间</text>
				<text class="cell-desc">配置每节课时长、课间休息及上下午晚的开始时间，课表会自动重新生成。</text>
			</view>

			<view class="form-row">
				<text class="form-label">每节课时长</text>
				<input class="num-input" type="number" v-model="form.classMinutes" maxlength="3" />
				<text class="input-unit">分钟</text>
			</view>
			<view class="form-row">
				<text class="form-label">课间休息</text>
				<input class="num-input" type="number" v-model="form.breakMinutes" maxlength="3" />
				<text class="input-unit">分钟</text>
			</view>

			<view class="divider"></view>

			<view class="form-row">
				<text class="form-label">上午第 1 节</text>
				<picker mode="time" :value="form.morningStart" @change="onTimeChange('morningStart', $event)">
					<view class="picker-box small">{{ form.morningStart }}</view>
				</picker>
				<text class="input-unit">开始</text>
			</view>
			<view class="form-row">
				<text class="form-label">上午节数</text>
				<input class="num-input" type="number" v-model="form.morningCount" maxlength="2" />
				<text class="input-unit">节</text>
			</view>

			<view class="divider"></view>

			<view class="form-row">
				<text class="form-label">下午第 1 节</text>
				<picker mode="time" :value="form.afternoonStart" @change="onTimeChange('afternoonStart', $event)">
					<view class="picker-box small">{{ form.afternoonStart }}</view>
				</picker>
				<text class="input-unit">开始</text>
			</view>
			<view class="form-row">
				<text class="form-label">下午节数</text>
				<input class="num-input" type="number" v-model="form.afternoonCount" maxlength="2" />
				<text class="input-unit">节</text>
			</view>

			<view class="divider"></view>

			<view class="form-row">
				<text class="form-label">晚上第 1 节</text>
				<picker mode="time" :value="form.eveningStart" @change="onTimeChange('eveningStart', $event)">
					<view class="picker-box small">{{ form.eveningStart }}</view>
				</picker>
				<text class="input-unit">开始</text>
			</view>
			<view class="form-row">
				<text class="form-label">晚上节数</text>
				<input class="num-input" type="number" v-model="form.eveningCount" maxlength="2" />
				<text class="input-unit">节</text>
			</view>

			<view class="action-row">
				<button class="ghost-btn full" @click="resetPeriodConfig">恢复默认</button>
				<button class="primary-btn full" @click="savePeriodConfigForm">保存</button>
			</view>

			<view class="preview-card">
				<text class="preview-title">预览节次时间</text>
				<view class="preview-list">
					<view v-for="(item, index) in previewTimes" :key="index" class="preview-item">
						<text class="preview-num">第{{ index + 1 }}节</text>
						<text class="preview-time">{{ item.start }} - {{ item.end }}</text>
					</view>
					<view v-if="!previewTimes.length" class="preview-empty">
						<text>请至少设置一个时段的节数</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import {
	loadSemesterStartDate,
	saveSemesterStartDate,
	loadPeriodConfig,
	savePeriodConfig,
	buildPeriodTimes,
	mergePeriodConfig,
	DEFAULT_PERIOD_CONFIG
} from '@/utils/schedule.js'

function toForm(config) {
	const cfg = mergePeriodConfig(config)
	return {
		classMinutes: `${cfg.classMinutes}`,
		breakMinutes: `${cfg.breakMinutes}`,
		morningStart: cfg.morningStart,
		morningCount: `${cfg.morningCount}`,
		afternoonStart: cfg.afternoonStart,
		afternoonCount: `${cfg.afternoonCount}`,
		eveningStart: cfg.eveningStart,
		eveningCount: `${cfg.eveningCount}`
	}
}

export default {
	data() {
		return {
			semesterStart: '',
			form: toForm(DEFAULT_PERIOD_CONFIG)
		}
	},
	computed: {
		previewTimes() {
			return buildPeriodTimes({
				classMinutes: Number(this.form.classMinutes),
				breakMinutes: Number(this.form.breakMinutes),
				morningStart: this.form.morningStart,
				morningCount: Number(this.form.morningCount),
				afternoonStart: this.form.afternoonStart,
				afternoonCount: Number(this.form.afternoonCount),
				eveningStart: this.form.eveningStart,
				eveningCount: Number(this.form.eveningCount)
			})
		}
	},
	onShow() {
		this.semesterStart = loadSemesterStartDate()
		this.form = toForm(loadPeriodConfig())
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
		onSemesterStartChange(event) {
			const value = event.detail.value || ''
			this.semesterStart = value
			saveSemesterStartDate(value)
			uni.showToast({ title: '已保存开学日期', icon: 'success' })
		},
		clearSemesterStart() {
			this.semesterStart = ''
			saveSemesterStartDate('')
			uni.showToast({ title: '已清除', icon: 'none' })
		},
		onTimeChange(field, event) {
			this.form[field] = event.detail.value
		},
		validateForm() {
			const classMinutes = Number(this.form.classMinutes)
			if (!Number.isInteger(classMinutes) || classMinutes <= 0 || classMinutes > 240) {
				uni.showToast({ title: '每节课时长应为 1-240 分钟', icon: 'none' })
				return null
			}
			const breakMinutes = Number(this.form.breakMinutes)
			if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) {
				uni.showToast({ title: '课间休息应为 0-240 分钟', icon: 'none' })
				return null
			}
			const checks = [
				['morningCount', '上午'],
				['afternoonCount', '下午'],
				['eveningCount', '晚上']
			]
			for (const [key, label] of checks) {
				const n = Number(this.form[key])
				if (!Number.isInteger(n) || n < 0 || n > 12) {
					uni.showToast({ title: `${label}节数应为 0-12`, icon: 'none' })
					return null
				}
			}
			return {
				classMinutes,
				breakMinutes,
				morningStart: this.form.morningStart,
				morningCount: Number(this.form.morningCount),
				afternoonStart: this.form.afternoonStart,
				afternoonCount: Number(this.form.afternoonCount),
				eveningStart: this.form.eveningStart,
				eveningCount: Number(this.form.eveningCount)
			}
		},
		savePeriodConfigForm() {
			const valid = this.validateForm()
			if (!valid) return
			const total = valid.morningCount + valid.afternoonCount + valid.eveningCount
			if (total <= 0) {
				uni.showToast({ title: '至少配置一个时段', icon: 'none' })
				return
			}
			const saved = savePeriodConfig(valid)
			this.form = toForm(saved)
			uni.showToast({ title: '已保存', icon: 'success' })
		},
		resetPeriodConfig() {
			uni.showModal({
				title: '恢复默认',
				content: '确定恢复节次时间为默认配置吗？',
				confirmText: '恢复',
				success: res => {
					if (!res.confirm) return
					const saved = savePeriodConfig(DEFAULT_PERIOD_CONFIG)
					this.form = toForm(saved)
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
	padding: 24rpx 28rpx;
	border-radius: 28rpx;
	background: #fff;
	box-shadow: 0 12rpx 34rpx rgba(31, 45, 61, 0.07);
}

.cell {
	padding: 20rpx 0;
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

.top-tip {
	margin-bottom: 8rpx;
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
	margin: 8rpx 0;
}

.input-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.form-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 14rpx 0;
}

.form-label {
	flex: 0 0 200rpx;
	font-size: 28rpx;
	font-weight: 700;
	color: #1f2937;
}

.num-input {
	box-sizing: border-box;
	width: 160rpx;
	height: 76rpx;
	padding: 0 20rpx;
	border-radius: 18rpx;
	background: #f4f6fb;
	font-size: 30rpx;
	font-weight: 700;
	color: #111827;
	text-align: center;
}

.input-unit {
	flex: 1;
	font-size: 26rpx;
	color: #6b7280;
}

.picker-box {
	box-sizing: border-box;
	flex: 1;
	height: 82rpx;
	line-height: 82rpx;
	padding: 0 22rpx;
	border-radius: 18rpx;
	background: #f4f6fb;
	font-size: 28rpx;
	color: #111827;
}

.picker-box.small {
	flex: 0 0 200rpx;
	font-weight: 700;
	text-align: center;
}

.action-row {
	display: flex;
	gap: 18rpx;
	margin-top: 24rpx;
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
	background: #fef2f2;
	color: #ef4444;
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

.preview-card {
	margin-top: 24rpx;
	padding: 20rpx 22rpx;
	border-radius: 20rpx;
	background: #f8fafc;
}

.preview-title {
	font-size: 26rpx;
	font-weight: 700;
	color: #1f2937;
	display: block;
	margin-bottom: 12rpx;
}

.preview-list {
	display: flex;
	flex-wrap: wrap;
	gap: 14rpx;
}

.preview-item {
	flex: 0 0 calc(50% - 7rpx);
	box-sizing: border-box;
	padding: 12rpx 16rpx;
	border-radius: 14rpx;
	background: #fff;
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.preview-num {
	font-size: 22rpx;
	color: #6b7280;
}

.preview-time {
	font-size: 26rpx;
	font-weight: 700;
	color: #111827;
}

.preview-empty {
	width: 100%;
	padding: 18rpx 0;
	text-align: center;
	font-size: 24rpx;
	color: #9ca3af;
}
</style>
