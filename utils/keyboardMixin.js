/**
 * 全局键盘高度 mixin
 *
 * 用途：
 *   各页面在 .page 容器上绑定 :style="kbStyle"，
 *   平时不占空间；键盘弹起时自动补出与键盘等高的占位 padding，
 *   防止输入框被键盘遮挡 / 布局错乱。
 *
 * 暴露：
 *   data: keyboardHeight (px)
 *   computed: kbStyle  -> { paddingBottom: 'XXXpx' }
 *   computed: kbActive -> boolean
 */
export default {
	data() {
		return {
			keyboardHeight: 0
		}
	},
	computed: {
		kbActive() {
			return this.keyboardHeight > 0
		},
		kbStyle() {
			return this.keyboardHeight > 0
				? { paddingBottom: `${this.keyboardHeight}px` }
				: {}
		}
	},
	mounted() {
		// #ifdef APP-PLUS || MP-WEIXIN || H5
		this.__onKb = res => {
			const h = (res && res.height) || 0
			this.keyboardHeight = h > 0 ? h : 0
		}
		try {
			uni.onKeyboardHeightChange(this.__onKb)
		} catch (e) {}
		// #endif
	},
	beforeUnmount() {
		// #ifdef APP-PLUS || MP-WEIXIN || H5
		try {
			if (this.__onKb) uni.offKeyboardHeightChange(this.__onKb)
		} catch (e) {}
		this.__onKb = null
		// #endif
	},
	// 兼容 vue2 写法
	beforeDestroy() {
		// #ifdef APP-PLUS || MP-WEIXIN || H5
		try {
			if (this.__onKb) uni.offKeyboardHeightChange(this.__onKb)
		} catch (e) {}
		this.__onKb = null
		// #endif
	}
}
