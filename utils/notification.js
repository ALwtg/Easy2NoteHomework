const NOTIFIED_KEY = 'notified_homework_ids'
const NOTICE_STATUS_KEY = 'homework_notice_enabled'
const NOTICE_FIRST_REQUEST_KEY = 'homework_notice_first_requested'
const NOTICE_TEMPLATE_ID = '_VTD5RnbyzssDWFq7RhAuOavo1BZB8FUro6mNNwODfc'

let notificationPermission = false

function limitText(text, maxLength) {
	return `${text || ''}`.slice(0, maxLength)
}

function formatWechatNoticeTime(deadline) {
	const date = new Date(deadline)
	if (Number.isNaN(date.getTime())) return ''
	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	const hour = `${date.getHours()}`.padStart(2, '0')
	const minute = `${date.getMinutes()}`.padStart(2, '0')
	return `${year}-${month}-${day} ${hour}:${minute}`
}

function buildWechatTemplateData(homework) {
	return {
		thing1: {
			value: limitText(`${homework.subject || '作业'}${homework.note ? `：${homework.note}` : ''}`, 20)
		},
		time3: {
			value: formatWechatNoticeTime(homework.deadline)
		},
		thing5: {
			value: '作业即将截止，请及时完成'
		},
		phrase6: {
			value: homework.completed ? '已完成' : '即将失效'
		}
	}
}

function getNotifiedIds() {
	try {
		return uni.getStorageSync(NOTIFIED_KEY) || []
	} catch (e) {
		return []
	}
}

function markAsNotified(homeworkId) {
	const ids = getNotifiedIds()
	if (!ids.includes(homeworkId)) {
		ids.push(homeworkId)
		uni.setStorageSync(NOTIFIED_KEY, ids)
	}
}

function isNotified(homeworkId) {
	return getNotifiedIds().includes(homeworkId)
}

function setNoticeStatus(enabled) {
	notificationPermission = enabled
	uni.setStorageSync(NOTICE_STATUS_KEY, enabled)
}

function getWechatSubscribeApi() {
	if (typeof uni.requestSubscribeMessage === 'function') return uni.requestSubscribeMessage
	// #ifdef MP-WEIXIN
	if (typeof wx !== 'undefined' && typeof wx.requestSubscribeMessage === 'function') {
		return wx.requestSubscribeMessage
	}
	// #endif
	return null
}

function isTemplateReady() {
	return NOTICE_TEMPLATE_ID && !NOTICE_TEMPLATE_ID.includes('请替换')
}

export function getNotificationPermissionStatus() {
	try {
		notificationPermission = !!uni.getStorageSync(NOTICE_STATUS_KEY)
		return notificationPermission
	} catch (e) {
		return notificationPermission
	}
}

export function shouldRequestNotificationOnFirstLaunch() {
	return !uni.getStorageSync(NOTICE_FIRST_REQUEST_KEY)
}

export function resetNotificationStatus(homeworkId) {
	const ids = getNotifiedIds()
	const index = ids.indexOf(homeworkId)
	if (index !== -1) {
		ids.splice(index, 1)
		uni.setStorageSync(NOTIFIED_KEY, ids)
	}
}

export function getPlatform() {
	// #ifdef MP-WEIXIN
	return 'mp-weixin'
	// #endif
	
	// #ifdef APP-PLUS
	if (uni.getSystemInfoSync().platform === 'android') {
		return 'app-android'
	} else if (uni.getSystemInfoSync().platform === 'ios') {
		return 'app-ios'
	}
	// #endif
	
	return 'unknown'
}

export async function requestNotificationPermission(options = {}) {
	const { silent = false, showToast = false } = options
	const platform = getPlatform()
	uni.setStorageSync(NOTICE_FIRST_REQUEST_KEY, true)
	
	try {
		if (platform === 'mp-weixin') {
			const requestSubscribeMessage = getWechatSubscribeApi()
			if (!requestSubscribeMessage) {
				if (!silent) uni.showToast({ title: '当前环境不支持服务通知', icon: 'none' })
				setNoticeStatus(false)
				return false
			}
			if (!isTemplateReady()) {
				if (!silent) uni.showToast({ title: '请先配置订阅消息模板ID', icon: 'none' })
				setNoticeStatus(false)
				return false
			}

			const res = await new Promise(resolve => {
				requestSubscribeMessage({
					tmplIds: [NOTICE_TEMPLATE_ID],
					success: resolve,
					fail: err => resolve({ errMsg: err.errMsg || 'fail' })
				})
			})
			const enabled = res[NOTICE_TEMPLATE_ID] === 'accept'
			setNoticeStatus(enabled)
			if (showToast || !silent) {
				uni.showToast({ title: enabled ? '通知已开启' : '未开启通知', icon: 'none' })
			}
			return enabled
		}

		if (platform === 'app-android' || platform === 'app-ios') {
			setNoticeStatus(true)
			if (showToast) uni.showToast({ title: '通知已开启', icon: 'success' })
			return true
		}
	} catch (e) {
		console.error('请求通知权限失败：', e)
	}
	
	setNoticeStatus(false)
	return false
}

export function requestNotificationPermissionOnFirstLaunch() {
	if (!shouldRequestNotificationOnFirstLaunch()) return
	setTimeout(() => {
		requestNotificationPermission({ silent: true })
	}, 800)
}

export function sendLocalNotification(options) {
	const { title, content, delay = 0, id, homework } = options
	const platform = getPlatform()
	
	if (platform === 'mp-weixin') {
		sendWechatServiceNotification(title, content, id, homework)
	} else if (platform === 'app-android') {
		sendAndroidNotification(title, content, delay, id)
	} else if (platform === 'app-ios') {
		sendIOSNotification(title, content, delay, id)
	}
}

function sendWechatServiceNotification(title, content, id, homework) {
	// #ifdef MP-WEIXIN
	if (!getNotificationPermissionStatus()) return
	const templateData = buildWechatTemplateData(homework || {})
	uni.$emit('homework-service-notice', {
		id,
		templateId: NOTICE_TEMPLATE_ID,
		page: '/pages/view/view',
		data: templateData,
		title,
		content,
		homework,
		createdAt: new Date().toISOString()
	})
	uni.showModal({
		title,
		content: `${content}`,
		showCancel: false
	})
	// #endif
	
	// #ifndef MP-WEIXIN
	uni.showModal({
		title,
		content,
		showCancel: false
	})
	// #endif
}

function sendAndroidNotification(title, content, delay, id) {
	// #ifdef APP-PLUS
	try {
		const main = plus.android.runtimeMainActivity()
		const NotificationManager = plus.android.importClass('android.app.NotificationManager')
		const Context = plus.android.importClass('android.content.Context')
		const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
		const builder = plus.android.newObject('androidx.core.app.NotificationCompat$Builder', main, 'homework_reminder')
		plus.android.invoke(builder, 'setSmallIcon', main.getApplicationInfo().icon)
		plus.android.invoke(builder, 'setContentTitle', title)
		plus.android.invoke(builder, 'setContentText', content)
		plus.android.invoke(builder, 'setAutoCancel', true)
		plus.android.invoke(builder, 'setPriority', 1)
		const notification = plus.android.invoke(builder, 'build')
		nm.notify(parseInt(id) || Date.now(), notification)
	} catch (e) {
		console.error('Android 通知发送失败：', e)
	}
	// #endif
}

function sendIOSNotification(title, content, delay, id) {
	// #ifdef APP-PLUS
	try {
		const UIApplication = plus.ios.importClass('UIApplication')
		const UILocalNotification = plus.ios.importClass('UILocalNotification')
		const NSDate = plus.ios.importClass('NSDate')
		const notification = plus.ios.newObject('UILocalNotification')
		notification.setFireDate(NSDate.dateWithTimeIntervalSinceNow(delay / 1000))
		notification.setAlertTitle(title)
		notification.setAlertBody(content)
		notification.setAlertAction('查看')
		notification.setSoundName('UILocalNotificationDefaultSoundName')
		notification.setApplicationIconBadgeNumber(1)
		notification.setUserInfo({ id: id || Date.now().toString() })
		UIApplication.sharedApplication().scheduleLocalNotification(notification)
		plus.ios.deleteObject(notification)
	} catch (e) {
		console.error('iOS 通知发送失败：', e)
	}
	// #endif
}

export function setHomeworkReminder(homework) {
	if (homework.completed) return
	if (isNotified(homework.id)) return
	
	const deadlineTime = new Date(homework.deadline).getTime()
	const now = Date.now()
	const reminderOffsetHours = Number(homework.reminderOffsetHours) > 0 ? Number(homework.reminderOffsetHours) : 23
	const reminderTime = deadlineTime - reminderOffsetHours * 60 * 60 * 1000
	
	if (deadlineTime <= now) return
	if (reminderTime > now) return
	
	sendLocalNotification({
		title: '作业即将截止',
		content: `“${homework.subject}”的作业将在${reminderOffsetHours}小时内截止，请及时完成！`,
		delay: 0,
		id: homework.id,
		homework
	})
	markAsNotified(homework.id)
}

export function cancelHomeworkReminder(homeworkId) {
	const platform = getPlatform()
	
	if (platform === 'app-android') {
		// #ifdef APP-PLUS
		try {
			const main = plus.android.runtimeMainActivity()
			const NotificationManager = plus.android.importClass('android.app.NotificationManager')
			const Context = plus.android.importClass('android.content.Context')
			const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
			nm.cancel(parseInt(homeworkId) || 0)
		} catch (e) {
			console.error('取消 Android 通知失败：', e)
		}
		// #endif
	} else if (platform === 'app-ios') {
		// #ifdef APP-PLUS
		try {
			const UIApplication = plus.ios.importClass('UIApplication')
			const app = UIApplication.sharedApplication()
			const notifications = app.scheduledLocalNotifications()
			const count = plus.ios.invoke(notifications, 'count')
			for (let i = 0; i < count; i++) {
				const notification = plus.ios.invoke(notifications, 'objectAtIndex:', i)
				const userInfo = plus.ios.invoke(notification, 'userInfo')
				const id = plus.ios.invoke(userInfo, 'objectForKey:', 'id')
				if (id === homeworkId) {
					app.cancelLocalNotification(notification)
					break
				}
			}
		} catch (e) {
			console.error('取消 iOS 通知失败：', e)
		}
		// #endif
	}
}

export function checkAndSetReminders(homeworkList) {
	homeworkList.forEach(homework => {
		if (!homework.completed) {
			setHomeworkReminder(homework)
		}
	})
}

export function clearAllNotifications() {
	const platform = getPlatform()
	
	if (platform === 'app-android') {
		// #ifdef APP-PLUS
		try {
			const main = plus.android.runtimeMainActivity()
			const NotificationManager = plus.android.importClass('android.app.NotificationManager')
			const Context = plus.android.importClass('android.content.Context')
			const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
			nm.cancelAll()
		} catch (e) {
			console.error('清除 Android 通知失败：', e)
		}
		// #endif
	} else if (platform === 'app-ios') {
		// #ifdef APP-PLUS
		try {
			const UIApplication = plus.ios.importClass('UIApplication')
			const app = UIApplication.sharedApplication()
			app.cancelAllLocalNotifications()
			app.setApplicationIconBadgeNumber(0)
		} catch (e) {
			console.error('清除 iOS 通知失败：', e)
		}
		// #endif
	}
}
