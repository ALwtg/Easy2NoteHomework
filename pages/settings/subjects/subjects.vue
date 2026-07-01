<template>
	<view class="page" :style="kbStyle">
		<view class="custom-nav">
			<view class="nav-back" @click="goBack">
				<text class="nav-arrow">‹</text>
			</view>
			<text class="nav-title">学科管理</text>
			<view class="nav-placeholder"></view>
		</view>

		<view class="card">
			<view class="cell-main top-tip">
				<text class="cell-title">学科列表</text>
				<text class="cell-desc">可增删改当前学科</text>
			</view>

			<view class="add-row">
				<input class="subject-input" v-model="newSubjectName" placeholder="输入新学科名称" maxlength="20" />
				<button class="primary-btn" @click="addSubject">新增</button>
			</view>

			<scroll-view v-if="subjectList.length" class="subject-list" scroll-y show-scrollbar="false" @scroll="onListScroll">
				<view
					class="subject-item"
					v-for="(item, idx) in subjectList"
					:key="item.id"
					:class="{ 'is-dragging': subjectDrag && subjectDrag.active && subjectDrag.dragIndex === idx, 'is-drag-target': subjectDrag && subjectDrag.active && subjectDrag.targetIndex === idx }"
				>
					<image
						class="drag-handle"
						src="/static/move.png"
						mode="aspectFit"
						@touchstart.stop.prevent="onHandleTouchStart(idx, $event)"
						@touchmove.stop.prevent="onHandleTouchMove($event)"
						@touchend.stop.prevent="onHandleTouchEnd($event)"
						@touchcancel.stop.prevent="onHandleTouchEnd($event)"
					></image>
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
</template>

<script>
import { loadSubjects, saveSubjects, createSubject } from '@/utils/subjects.js'

const HOMEWORK_KEY = 'homework_list'

export default {
	data() {
		return {
			subjectList: [],
			newSubjectName: '',
			// 学科拖动排序状态
			subjectDrag: null // { dragIndex, targetIndex, startY, currentY, active, longPressTimer }
		}
	},
	created() {
		// 实测坐标缓存：列表顶部 Y、单项高度、滚动偏移
		this.__listTop = 0
		this.__itemHeight = 0
		this.__scrollTop = 0
	},
	onShow() {
		this.loadSubjects()
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
		loadSubjects() {
			this.subjectList = loadSubjects()
		},
		saveSubjects() {
			saveSubjects(this.subjectList)
		},
		// === 学科拖动排序 ===
		// 异步实测列表顶部 Y 与单项高度，缓存到实例属性（仅 touchStart 时调用一次）
		measureListGeometry() {
			try {
				const query = uni.createSelectorQuery().in(this)
				query.select('.subject-list').boundingClientRect()
				query.selectAll('.subject-item').boundingClientRect()
				query.exec(res => {
					const listRect = res && res[0]
					const itemRects = res && res[1]
					if (listRect) this.__listTop = listRect.top
					if (Array.isArray(itemRects) && itemRects.length) {
						// 用前两项 top 差作 itemHeight（更稳健），否则用单项 height
						if (itemRects.length >= 2 && itemRects[1] && itemRects[0]) {
							this.__itemHeight = itemRects[1].top - itemRects[0].top
						}
						if ((!this.__itemHeight || this.__itemHeight <= 0) && itemRects[0]) {
							this.__itemHeight = itemRects[0].height
						}
					}
				})
			} catch (e) {}
		},
		onListScroll(e) {
			this.__scrollTop = (e && e.detail ? Number(e.detail.scrollTop) || 0 : 0)
		},
		onHandleTouchStart(index, e) {
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			// 触摸开始即异步测量列表几何（长按 400ms 内必定完成，touchmove 时数据就绪）
			this.measureListGeometry()
			if (this.subjectDrag && this.subjectDrag.longPressTimer) {
				clearTimeout(this.subjectDrag.longPressTimer)
			}
			const drag = {
				dragIndex: index,
				targetIndex: index,
				startY: touch.clientY,
				currentY: touch.clientY,
				active: false,
				longPressTimer: null
			}
			drag.longPressTimer = setTimeout(() => {
				if (this.subjectDrag && this.subjectDrag.dragIndex === index) {
					this.subjectDrag.active = true
					try { uni.vibrateShort && uni.vibrateShort({ type: 'light' }) } catch (err) {}
				}
			}, 400)
			this.subjectDrag = drag
		},
		onHandleTouchMove(e) {
			if (!this.subjectDrag) return
			const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!touch) return
			const dy = touch.clientY - this.subjectDrag.startY
			// 未激活前：轻微移动取消长按
			if (!this.subjectDrag.active) {
				if (Math.abs(dy) > 8) {
					if (this.subjectDrag.longPressTimer) {
						clearTimeout(this.subjectDrag.longPressTimer)
						this.subjectDrag.longPressTimer = null
					}
					this.subjectDrag = null
				}
				return
			}
			this.subjectDrag = {
				...this.subjectDrag,
				currentY: touch.clientY,
				targetIndex: this.computeTargetIndex(touch.clientY)
			}
			// 若目标索引变化则交换数组顺序
			if (this.subjectDrag.targetIndex !== this.subjectDrag.dragIndex) {
				const from = this.subjectDrag.dragIndex
				const to = this.subjectDrag.targetIndex
				if (from >= 0 && from < this.subjectList.length && to >= 0 && to < this.subjectList.length) {
					const list = this.subjectList.slice()
					const [moved] = list.splice(from, 1)
					list.splice(to, 0, moved)
					this.subjectList = list
					this.subjectDrag = { ...this.subjectDrag, dragIndex: to }
					this.saveSubjects()
				}
			}
		},
		onHandleTouchEnd() {
			if (!this.subjectDrag) return
			if (this.subjectDrag.longPressTimer) {
				clearTimeout(this.subjectDrag.longPressTimer)
				this.subjectDrag.longPressTimer = null
			}
			if (this.subjectDrag.active) {
				this.saveSubjects()
				uni.showToast({ title: '顺序已更新', icon: 'none' })
			}
			this.subjectDrag = null
		},
		// 根据触摸 Y 坐标计算落在哪个学科项上（用实测列表 top + item 高度 + 滚动偏移）
		computeTargetIndex(clientY) {
			try {
				const itemHeight = this.__itemHeight || 0
				const listTop = this.__listTop || 0
				const scrollTop = this.__scrollTop || 0
				if (itemHeight <= 0) {
					// 测量未就绪时的兜底：保持原索引
					return this.subjectDrag ? this.subjectDrag.dragIndex : 0
				}
				// 相对列表内容区的 Y（需加上滚动偏移，因为 boundingClientRect.top 是视口坐标）
				const relativeY = clientY - listTop + scrollTop
				let idx = Math.floor(relativeY / itemHeight)
				if (idx < 0) idx = 0
				if (idx > this.subjectList.length - 1) idx = this.subjectList.length - 1
				return idx
			} catch (e) {
				return this.subjectDrag ? this.subjectDrag.dragIndex : 0
			}
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

			this.subjectList.unshift(createSubject(name))
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

.top-tip {
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

.add-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-top: 24rpx;
}

.subject-input,
.subject-name {
	box-sizing: border-box;
	flex: 1;
	height: 82rpx;
	padding: 0 22rpx;
	border-radius: 18rpx;
	background: #f4f6fb;
	font-size: 28rpx;
	color: #111827;
}

.primary-btn,
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

.primary-btn {
	background: #2979ff;
	color: #fff;
}

.delete-btn {
	background: #fef2f2;
	color: #ef4444;
}

.primary-btn::after,
.delete-btn::after {
	border: 0;
}

.subject-list {
	max-height: 70vh;
	margin-top: 22rpx;
	padding: 8rpx 10rpx;
	box-sizing: border-box;
	border: 2rpx solid #eef2f7;
	border-radius: 18rpx;
	background: #fff;
}

.subject-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #eef2f7;
	transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.subject-item:last-child {
	border-bottom: 0;
}

.subject-item.is-dragging {
	opacity: 0.85;
	box-shadow: 0 8rpx 24rpx rgba(41, 121, 255, 0.22);
	transform: scale(1.02);
}

.subject-item.is-drag-target {
	background: #eef6ff;
}

.drag-handle {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
	opacity: 0.55;
}

.drag-handle:active {
	opacity: 0.9;
}

.empty {
	padding: 48rpx 0 24rpx;
	text-align: center;
	font-size: 26rpx;
	color: #9ca3af;
}
</style>
