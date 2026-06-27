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

			<scroll-view v-if="subjectList.length" class="subject-list" scroll-y show-scrollbar="false">
				<view class="subject-item" v-for="item in subjectList" :key="item.id">
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
const SUBJECT_KEY = 'subject_list'
const HOMEWORK_KEY = 'homework_list'
const DEFAULT_SUBJECTS = ['高等数学', '大学英语', '程序设计', '数据结构', '线性代数']

export default {
	data() {
		return {
			subjectList: [],
			newSubjectName: ''
		}
	},
	onShow() {
		this.loadSubjects()
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},
		loadSubjects() {
			const saved = uni.getStorageSync(SUBJECT_KEY)
			if (Array.isArray(saved) && saved.length) {
				this.subjectList = saved
				return
			}

			this.subjectList = DEFAULT_SUBJECTS.map(name => ({
				id: this.createId(),
				name,
				createdAt: new Date().toISOString()
			}))
			this.saveSubjects()
		},
		saveSubjects() {
			uni.setStorageSync(SUBJECT_KEY, this.subjectList)
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

			this.subjectList.unshift({
				id: this.createId(),
				name,
				createdAt: new Date().toISOString()
			})
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
		},
		createId() {
			return `${Date.now()}_${Math.random().toString(16).slice(2)}`
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
}

.subject-item:last-child {
	border-bottom: 0;
}

.empty {
	padding: 48rpx 0 24rpx;
	text-align: center;
	font-size: 26rpx;
	color: #9ca3af;
}
</style>
