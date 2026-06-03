// 从南京工程学院教务系统（zfsoft）导入课表
// APP 端使用 plus.webview 自动提取；网页端使用内嵌教务网页自动抓取。
import {
	normalizeCourseFromZf,
	loadCourses,
	saveCourses,
	saveScheduleMeta,
	loadClearManualOnImport
} from './schedule.js'

// 把导入到的课表与既有手动课合并：
// - 默认保留所有 manual 课程
// - 若用户在课表页打开"重新导入清除手动课"，则丢弃 manual 课
function mergeWithManualCourses(importedCourses) {
	const list = Array.isArray(importedCourses) ? importedCourses.slice() : []
	if (loadClearManualOnImport()) return list
	const existing = loadCourses()
	const manualCourses = existing.filter(item => item && item.manual)
	return list.concat(manualCourses)
}

export const ZF_LOGIN_URL = 'http://ehall.njit.edu.cn/new/index.html'
export const ZF_H5_LOGIN_URL = '/njit-ehall/new/index.html'

const STORAGE_DATA_KEY = 'zf_schedule_data'
const STORAGE_DONE_KEY = 'zf_schedule_done'
const STORAGE_ERR_KEY = 'zf_schedule_error'

// 注入到 webview 内执行的抓取脚本：调用教务系统课表查询接口，
// 将 JSON 写入 plus.storage 由原生层读取。
const FETCH_SCRIPT = `
(function() {
	if (window.__zfHwFetching) return;
	window.__zfHwFetching = true;
	try {
		if (typeof plus === 'undefined' || !plus.storage) {
			alert('plus 对象未注入，无法回传数据，请重试');
			window.__zfHwFetching = false;
			return;
		}
		var $ = window.jQuery || window.$;
		if (!$ || !$.ajax) {
			plus.storage.setItem('${STORAGE_ERR_KEY}', '当前页面缺少 jQuery，请确认已进入"个人课表查询"页');
			plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
			window.__zfHwFetching = false;
			return;
		}
		function pickValue(id) {
			var el = document.getElementById(id);
			if (!el) return '';
			if (el.value) return el.value;
			var sel = el.querySelector('option[selected]');
			return sel ? sel.value : '';
		}
		var xnm = pickValue('xnm');
		var xqm = pickValue('xqm');
		if (!xnm || !xqm) {
			plus.storage.setItem('${STORAGE_ERR_KEY}', '未读取到学年学期，请先在课表查询页选择学年学期');
			plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
			window.__zfHwFetching = false;
			return;
		}
		$.ajax({
			url: '/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151',
			type: 'POST',
			dataType: 'json',
			data: { xnm: xnm, xqm: xqm, kblx: '1' },
			success: function(data) {
				try {
					plus.storage.setItem('${STORAGE_DATA_KEY}', JSON.stringify({ data: data, xnm: xnm, xqm: xqm }));
					plus.storage.setItem('${STORAGE_DONE_KEY}', 'success');
				} catch (e) {
					plus.storage.setItem('${STORAGE_ERR_KEY}', '数据写入失败：' + (e && e.message));
					plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
				}
				window.__zfHwFetching = false;
			},
			error: function(xhr) {
				plus.storage.setItem('${STORAGE_ERR_KEY}', '请求课表接口失败 ' + (xhr && xhr.status));
				plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
				window.__zfHwFetching = false;
			}
		});
	} catch (e) {
		try {
			plus.storage.setItem('${STORAGE_ERR_KEY}', '注入异常：' + (e && e.message));
			plus.storage.setItem('${STORAGE_DONE_KEY}', 'error');
		} catch (e2) {}
		window.__zfHwFetching = false;
	}
})();
`

function clearStorageKeys() {
	// #ifdef APP-PLUS
	try {
		plus.storage.removeItem(STORAGE_DATA_KEY)
		plus.storage.removeItem(STORAGE_DONE_KEY)
		plus.storage.removeItem(STORAGE_ERR_KEY)
	} catch (e) {}
	// #endif
}

function pickSchedulePayload(parsed) {
	if (Array.isArray(parsed)) return { list: parsed, metaSource: {} }
	if (!parsed || typeof parsed !== 'object') return { list: [], metaSource: {} }
	if (Array.isArray(parsed.kbList)) return { list: parsed.kbList, metaSource: parsed }
	if (parsed.data && Array.isArray(parsed.data.kbList)) return { list: parsed.data.kbList, metaSource: { ...parsed.data, ...parsed } }
	if (parsed.datas && Array.isArray(parsed.datas.kbList)) return { list: parsed.datas.kbList, metaSource: { ...parsed.datas, ...parsed } }
	if (parsed.result && Array.isArray(parsed.result.kbList)) return { list: parsed.result.kbList, metaSource: { ...parsed.result, ...parsed } }
	return { list: [], metaSource: parsed }
}

function parseJsonLikeText(rawText) {
	const text = `${rawText || ''}`.trim()
	if (!text) throw new Error('请先粘贴课表 JSON 或页面源码')

	try {
		return JSON.parse(text)
	} catch (e) {}

	const jsonMatch = text.match(/\{[\s\S]*"kbList"[\s\S]*\}/)
	if (jsonMatch) {
		try {
			return JSON.parse(jsonMatch[0])
		} catch (e) {}
	}

	const arrayMatch = text.match(/"kbList"\s*:\s*(\[[\s\S]*?\])\s*[,}]/)
	if (arrayMatch) {
		try {
			return { kbList: JSON.parse(arrayMatch[1]) }
		} catch (e) {}
	}

	throw new Error('未识别到课表数据。网页端请粘贴接口返回 JSON，或包含 kbList 的页面源码。')
}

export function parseScheduleImportText(rawText) {
	const parsed = parseJsonLikeText(rawText)
	const payload = pickSchedulePayload(parsed)
	const courses = payload.list.map(normalizeCourseFromZf).filter(Boolean)
	if (!courses.length) {
		throw new Error('未解析到有效课程，请确认粘贴的是课表接口 JSON 数据')
	}
	return {
		courses,
		meta: {
			xnm: payload.metaSource.xnm || '',
			xqm: payload.metaSource.xqm || '',
			xqmmc: payload.metaSource.xqmmc || '',
			xnmc: payload.metaSource.xnmc || '',
			importMode: 'web-paste',
			importedAt: new Date().toISOString(),
			courseCount: courses.length
		}
	}
}

export function importScheduleFromText(rawText) {
	const result = parseScheduleImportText(rawText)
	saveCourses(mergeWithManualCourses(result.courses))
	saveScheduleMeta(result.meta)
	return result
}

// 从 webview 当前 URL 判断是否处于课表查询页
function isOnCoursePage(url) {
	return /xskbcx/i.test(`${url || ''}`)
}

export function importScheduleFromZf({ onSuccess, onCancel, onError } = {}) {
	// #ifndef APP-PLUS
	uni.showToast({ title: '请在 App 端使用此功能', icon: 'none' })
	onError && onError(new Error('platform-not-supported'))
	return
	// #endif

	// #ifdef APP-PLUS
	clearStorageKeys()

	const BACK_BTN_TEXT = '返回课表页面'
	const EXTRACT_BTN_TEXT = '提取课表'

	let statusBarHeight = 24
	try {
		const sysInfo = uni.getSystemInfoSync()
		statusBarHeight = Number(sysInfo && sysInfo.statusBarHeight) || 24
	} catch (e) {}
	const webviewTop = `${statusBarHeight}px`
	const buttonTop = statusBarHeight + 8
	const buttonGap = 8
	const buttonHeight = 34
	const buttonLeft = '10px'
	const buttonWidth = '118px'

	const bgWv = plus.webview.create('about:blank', 'zfScheduleImportBg', {
		top: '0px',
		bottom: '0px',
		background: '#ffffff',
		scrollIndicator: 'none'
	})

	const wv = plus.webview.create(ZF_LOGIN_URL, 'zfScheduleImport', {
		top: webviewTop,
		bottom: '0px',
		plusrequire: 'ahead',
		scrollIndicator: 'none',
		popGesture: 'close',
		scalable: true
	})

	let backHomeBtn = null
	let extractBtn = null
	try {
		backHomeBtn = new plus.nativeObj.View('zfBackHomeBtn', {
			top: `${buttonTop}px`,
			left: buttonLeft,
			width: buttonWidth,
			height: `${buttonHeight}px`
		}, [
			{
				tag: 'rect',
				color: 'rgba(41,121,255,0.92)',
				rectStyles: { radius: '17px' },
				position: { top: '0px', left: '0px', width: '100%', height: '100%' }
			},
			{
				tag: 'font',
				text: BACK_BTN_TEXT,
				textStyles: { color: '#ffffff', size: '13px', weight: 'bold' },
				position: { top: '0px', left: '0px', width: '100%', height: '100%' }
			}
		])
		backHomeBtn.setStyle({ mask: 'rgba(0,0,0,0)' })
	} catch (e) {
		backHomeBtn = null
	}
	try {
		extractBtn = new plus.nativeObj.View('zfExtractBtn', {
			top: `${buttonTop + buttonHeight + buttonGap}px`,
			left: buttonLeft,
			width: buttonWidth,
			height: `${buttonHeight}px`
		}, [
			{
				tag: 'rect',
				color: 'rgba(41,121,255,0.92)',
				rectStyles: { radius: '17px' },
				position: { top: '0px', left: '0px', width: '100%', height: '100%' }
			},
			{
				tag: 'font',
				text: EXTRACT_BTN_TEXT,
				textStyles: { color: '#ffffff', size: '13px', weight: 'bold' },
				position: { top: '0px', left: '0px', width: '100%', height: '100%' }
			}
		])
		extractBtn.setStyle({ mask: 'rgba(0,0,0,0)' })
	} catch (e) {
		extractBtn = null
	}

	let pollTimer = null
	let closed = false
	let succeed = false

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer)
			pollTimer = null
		}
	}

	function goHome() {
		setTimeout(() => {
			uni.switchTab({ url: '/pages/schedule/schedule' })
		}, 120)
	}

	function closeNativeButtons() {
		try { if (backHomeBtn) backHomeBtn.close() } catch (e) {}
		try { if (extractBtn) extractBtn.close() } catch (e) {}
		backHomeBtn = null
		extractBtn = null
	}

	function closeImportWebviews() {
		try { wv.close('auto') } catch (e) {}
		try { bgWv.close('none') } catch (e) {}
	}

	function safeCloseWebview(redirectHome = false) {
		if (closed) return
		closed = true
		stopPolling()
		closeNativeButtons()
		closeImportWebviews()
		if (redirectHome) goHome()
	}

	wv.addEventListener('close', () => {
		stopPolling()
		closeNativeButtons()
		try { bgWv.close('none') } catch (e) {}
		const wasClosedBySelf = closed
		closed = true
		// 仅当不是因为成功提取而主动关闭时，才视为用户取消并跳回首页 tab
		if (!succeed) {
			if (!wasClosedBySelf) onCancel && onCancel()
			goHome()
		}
	})

	function handleExtractClick() {
		let url = ''
		try {
			url = typeof wv.getURL === 'function' ? wv.getURL() : ''
		} catch (e) {
			url = ''
		}
		if (!isOnCoursePage(url)) {
			plus.nativeUI.toast('请先登录并进入"个人课表查询"页面')
			return
		}

		clearStorageKeys()
		plus.nativeUI.showWaiting('正在提取课表...')
		try {
			wv.evalJS(FETCH_SCRIPT)
		} catch (e) {
			plus.nativeUI.closeWaiting()
			plus.nativeUI.toast('注入脚本失败')
			return
		}

		stopPolling()
		let elapsed = 0
		pollTimer = setInterval(() => {
			elapsed += 400
			let status = ''
			try { status = plus.storage.getItem(STORAGE_DONE_KEY) || '' } catch (e) {}
			if (status === 'success') {
				stopPolling()
				let raw = ''
				try { raw = plus.storage.getItem(STORAGE_DATA_KEY) || '' } catch (e) {}
				plus.nativeUI.closeWaiting()
				try {
					const parsed = JSON.parse(raw || '{}')
					const data = parsed.data || {}
					const list = data.kbList || []
					const courses = list.map(normalizeCourseFromZf).filter(Boolean)
					if (!courses.length) {
						plus.nativeUI.toast('该学期暂无课表数据')
						return
					}
					saveCourses(mergeWithManualCourses(courses))
					saveScheduleMeta({
						xnm: parsed.xnm,
						xqm: parsed.xqm,
						xqmmc: data.xqmmc || '',
						xnmc: data.xnmc || '',
						importedAt: new Date().toISOString(),
						courseCount: courses.length
					})
					succeed = true
					safeCloseWebview()
					setTimeout(() => {
						onSuccess && onSuccess({
							courses,
							xnm: parsed.xnm,
							xqm: parsed.xqm,
							xnmc: data.xnmc,
							xqmmc: data.xqmmc
						})
					}, 220)
				} catch (e) {
					plus.nativeUI.toast('解析课表失败：' + (e && e.message))
					onError && onError(e)
				}
			} else if (status === 'error') {
				stopPolling()
				let err = ''
				try { err = plus.storage.getItem(STORAGE_ERR_KEY) || '' } catch (e) {}
				plus.nativeUI.closeWaiting()
				plus.nativeUI.toast(err || '提取失败，请重试')
				onError && onError(new Error(err || 'extract failed'))
			} else if (elapsed > 45000) {
				stopPolling()
				plus.nativeUI.closeWaiting()
				plus.nativeUI.toast('提取超时，请重试')
				onError && onError(new Error('timeout'))
			}
		}, 400)
	}

	try { bgWv.show('none') } catch (e) {}

	if (backHomeBtn) {
		backHomeBtn.addEventListener('click', () => {
			safeCloseWebview()
		})
		try { wv.append(backHomeBtn) } catch (e) {
			try { plus.webview.currentWebview().append(backHomeBtn) } catch (e2) {}
		}
		try { backHomeBtn.show() } catch (e) {}
	}

	if (extractBtn) {
		extractBtn.addEventListener('click', handleExtractClick)
		try { wv.append(extractBtn) } catch (e) {
			try { plus.webview.currentWebview().append(extractBtn) } catch (e2) {}
		}
		try { extractBtn.show() } catch (e) {}
	}

	wv.show('slide-in-right')
	// #endif
}
