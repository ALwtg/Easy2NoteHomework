const NOTIFIED_KEY = 'notified_homework_ids'
const NOTICE_STATUS_KEY = 'homework_notice_enabled'
const NOTICE_FIRST_REQUEST_KEY = 'homework_notice_first_requested'
export const REMINDER_MODE_KEY = 'homework_reminder_mode'
export const SMART_REMINDER_OFFSET_MINUTES_KEY = 'smart_reminder_offset_minutes'
export const REMINDER_MODE_TRADITIONAL = 'traditional'
export const REMINDER_MODE_SMART = 'smart'
const NOTICE_TEMPLATE_ID = '_VTD5RnbyzssDWFq7RhAuOavo1BZB8FUro6mNNwODfc'
const HOMEWORK_KEY = 'homework_list'
const DEFAULT_SMART_REMINDER_OFFSET_MINUTES = 60

let notificationPermission = false
let reminderDaemonTimer = null


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

export function getReminderMode() {
	const mode = uni.getStorageSync(REMINDER_MODE_KEY)
	return mode === REMINDER_MODE_TRADITIONAL ? REMINDER_MODE_TRADITIONAL : REMINDER_MODE_SMART
}

export function saveReminderMode(mode) {
	const next = mode === REMINDER_MODE_TRADITIONAL ? REMINDER_MODE_TRADITIONAL : REMINDER_MODE_SMART
	uni.setStorageSync(REMINDER_MODE_KEY, next)
	return next
}

export function getSmartReminderOffsetMinutes() {
	const value = Number(uni.getStorageSync(SMART_REMINDER_OFFSET_MINUTES_KEY))
	return Number.isInteger(value) && value > 0 ? value : DEFAULT_SMART_REMINDER_OFFSET_MINUTES
}

export function saveSmartReminderOffsetMinutes(minutes) {
	const value = Number(minutes)
	const safe = Number.isInteger(value) && value > 0 && value <= 10080 ? value : DEFAULT_SMART_REMINDER_OFFSET_MINUTES
	uni.setStorageSync(SMART_REMINDER_OFFSET_MINUTES_KEY, safe)
	return safe
}

export function getSmartReminderOffsetParts() {
	const minutes = getSmartReminderOffsetMinutes()
	return {
		hours: Math.floor(minutes / 60),
		minutes: minutes % 60,
		totalMinutes: minutes
	}
}

function ensureAndroidNotificationChannel() {
	// #ifdef APP-PLUS
	try {
		if (getPlatform() !== 'app-android') return
		const main = plus.android.runtimeMainActivity()
		const BuildVersion = plus.android.importClass('android.os.Build$VERSION')
		if (BuildVersion.SDK_INT < 26) return
		const NotificationManager = plus.android.importClass('android.app.NotificationManager')
		const Context = plus.android.importClass('android.content.Context')
		const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
		const channel = plus.android.newObject('android.app.NotificationChannel', 'homework_reminder', '作业提醒', NotificationManager.IMPORTANCE_HIGH)
		plus.android.invoke(channel, 'setDescription', '作业截止与上课前提醒')
		plus.android.invoke(nm, 'createNotificationChannel', channel)
	} catch (e) {
		console.warn('创建 Android 通知通道失败：', e)
	}
	// #endif
}

export function keepReminderDaemonAlive() {
	// #ifdef APP-PLUS
	try {
		if (getPlatform() === 'app-android' && plus.device && typeof plus.device.setWakelock === 'function') {
			plus.device.setWakelock(true)
		}
	} catch (e) {}
	// #endif
}

export function getNotificationPermissionStatus() {
	try {
		notificationPermission = !!uni.getStorageSync(NOTICE_STATUS_KEY)
		return notificationPermission
	} catch (e) {
		return notificationPermission
	}
}

// 获取系统真实通知权限状态（APP 端查询 Android/iOS 系统设置）
export function getSystemNotificationPermissionStatus() {
	// #ifdef MP-WEIXIN
	return getNotificationPermissionStatus()
	// #endif

	// #ifdef APP-PLUS
	try {
		const platform = getPlatform()
		if (platform === 'app-android') {
			const main = plus.android.runtimeMainActivity()
			const NotificationManagerCompat = plus.android.importClass('androidx.core.app.NotificationManagerCompat')
			if (NotificationManagerCompat && NotificationManagerCompat.from) {
				const compat = NotificationManagerCompat.from(main)
				return !!compat.areNotificationsEnabled()
			}
			// 兼容旧版：通过 NotificationManager 检查
			const Context = plus.android.importClass('android.content.Context')
			const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
			if (nm && typeof nm.areNotificationsEnabled === 'function') {
				return !!nm.areNotificationsEnabled()
			}
			return !!getNotificationPermissionStatus()
		}
		if (platform === 'app-ios') {
			const UIApplication = plus.ios.importClass('UIApplication')
			const app = UIApplication.sharedApplication()
			const settings = plus.ios.invoke(app, 'currentUserNotificationSettings')
			if (settings) {
				const types = plus.ios.invoke(settings, 'types')
				return (types & 1) !== 0 // UIUserNotificationTypeAlert = 1 << 0
			}
			return !!getNotificationPermissionStatus()
		}
	} catch (e) {
		console.warn('查询系统通知权限失败：', e)
	}
	return !!getNotificationPermissionStatus()
	// #endif

	// #ifndef MP-WEIXIN || APP-PLUS
	return !!getNotificationPermissionStatus()
	// #endif
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

// APP 端请求系统通知权限（Android 直接查询，iOS 跳转设置）
function requestAppSystemNotificationPermission() {
	// #ifdef APP-PLUS
	try {
		const platform = getPlatform()
		if (platform === 'app-android') {
			// Android 通知权限默认开启，直接查询当前状态
			return getSystemNotificationPermissionStatus()
		}
		if (platform === 'app-ios') {
			// iOS 跳转系统设置请求权限
			const UIApplication = plus.ios.importClass('UIApplication')
			const app = UIApplication.sharedApplication()
			const settings = plus.ios.invoke(app, 'currentUserNotificationSettings')
			if (settings) {
				const types = plus.ios.invoke(settings, 'types')
				return (types & 1) !== 0
			}
			// 未授权则跳转设置页
			const settingsUrl = plus.ios.invoke(app, 'openURL:', 'app-settings:')
			return false
		}
	} catch (e) {
		console.warn('请求 APP 系统通知权限失败：', e)
	}
	return false
	// #endif

	// #ifndef APP-PLUS
	return false
	// #endif
}

// 打开系统通知设置页（APP 端）
export function openSystemNotificationSettings() {
	// #ifdef APP-PLUS
	try {
		const platform = getPlatform()
		if (platform === 'app-android') {
			const main = plus.android.runtimeMainActivity()
			const packageName = main.getPackageName()
			// Android 8+ 通知设置页必须使用官方 extra key，否则部分系统会提示“在已安装的应用列表中找不到该应用”
			try {
				const intent = plus.android.newObject('android.content.Intent', 'android.settings.APP_NOTIFICATION_SETTINGS')
				plus.android.invoke(intent, 'putExtra', 'android.provider.extra.APP_PACKAGE', packageName)
				plus.android.invoke(main, 'startActivity', intent)
				return true
			} catch (e1) {
				console.warn('跳转 APP_NOTIFICATION_SETTINGS 失败，回退到应用详情页：', e1)
			}
			// 回退：跳转「应用详情页」，用户可手动进入通知设置
			try {
				const Uri = plus.android.importClass('android.net.Uri')
				const uri = plus.android.invoke(Uri, 'parse', 'package:' + packageName)
				const intent = plus.android.newObject('android.content.Intent', 'android.settings.APPLICATION_DETAILS_SETTINGS', uri)
				plus.android.invoke(main, 'startActivity', intent)
				return true
			} catch (e2) {
				console.warn('回退跳转应用详情页失败：', e2)
			}
			return false
		}
		if (platform === 'app-ios') {
			const UIApplication = plus.ios.importClass('UIApplication')
			const app = UIApplication.sharedApplication()
			plus.ios.invoke(app, 'openURL:', 'app-settings:')
			return true
		}
	} catch (e) {
		console.warn('打开系统通知设置失败：', e)
	}
	return false
	// #endif

	// #ifndef APP-PLUS
	return false
	// #endif
}

// 检查「获取已安装应用列表」权限（QUERY_ALL_PACKAGES，Android 11+ 包可见性）
// 返回 true 表示已获取（或非 Android 平台）
export function getInstalledAppsListPermissionStatus() {
	// #ifdef APP-PLUS
	try {
		if (getPlatform() !== 'app-android') return true
		const main = plus.android.runtimeMainActivity()
		const pm = main.getPackageManager()
		const packageName = main.getPackageName()
		const PackageManager = plus.android.importClass('android.content.pm.PackageManager')
		const granted = plus.android.invoke(pm, 'checkPermission', 'android.permission.QUERY_ALL_PACKAGES', packageName)
		return granted === PackageManager.PERMISSION_GRANTED
	} catch (e) {
		console.warn('查询已安装应用列表权限失败：', e)
	}
	return true
	// #endif

	// #ifndef APP-PLUS
	return true
	// #endif
}

// 请求「获取已安装应用列表」权限（Android 11+）
// 返回 Promise<boolean>，true 表示已获取
export function requestInstalledAppsListPermission() {
	return new Promise(resolve => {
		// #ifdef APP-PLUS
		try {
			if (getPlatform() !== 'app-android') { resolve(true); return }
			const perm = 'android.permission.QUERY_ALL_PACKAGES'
			if (getInstalledAppsListPermissionStatus()) { resolve(true); return }
			if (plus.android && typeof plus.android.requestPermissions === 'function') {
				plus.android.requestPermissions(
					[perm],
					() => resolve(getInstalledAppsListPermissionStatus()),
					() => resolve(getInstalledAppsListPermissionStatus())
				)
				return
			}
			try {
				const main = plus.android.runtimeMainActivity()
				const ActivityCompat = plus.android.importClass('androidx.core.app.ActivityCompat')
				const StringClass = plus.android.importClass('java.lang.String')
				const ReflectArray = plus.android.importClass('java.lang.reflect.Array')
				const javaArray = plus.android.invoke(ReflectArray, 'newInstance', StringClass, 1)
				plus.android.invoke(ReflectArray, 'set', javaArray, 0, perm)
				plus.android.invoke(ActivityCompat, 'requestPermissions', main, javaArray, 0x2001)
				setTimeout(() => resolve(getInstalledAppsListPermissionStatus()), 800)
				return
			} catch (e1) {
				console.warn('requestPermissions 调用失败：', e1)
			}
			resolve(getInstalledAppsListPermissionStatus())
		} catch (e) {
			console.warn('请求已安装应用列表权限失败：', e)
			resolve(getInstalledAppsListPermissionStatus())
		}
		return
		// #endif

		// #ifndef APP-PLUS
		resolve(true)
		// #endif
	})
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
			// APP 端：请求系统通知权限（跳转或弹窗授权），并查询真实状态
			const granted = requestAppSystemNotificationPermission()
			setNoticeStatus(granted)
			if (showToast || !silent) {
				uni.showToast({ title: granted ? '通知已开启' : '未开启通知', icon: 'none' })
			}
			return granted
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
		return sendWechatServiceNotification(title, content, id, homework)
	} else if (platform === 'app-android') {
		return sendAndroidNotification(title, content, delay, id)
	} else if (platform === 'app-ios') {
		return sendIOSNotification(title, content, delay, id)
	}
	return false
}

export async function testReminderNotification(targetPlatform) {
	const platform = getPlatform()
	if (targetPlatform && platform !== targetPlatform) {
		uni.showToast({ title: targetPlatform === 'app-android' ? '请在安卓 App 中测试' : '请在微信小程序中测试', icon: 'none' })
		return false
	}
	if (platform !== 'app-android' && platform !== 'mp-weixin') {
		uni.showToast({ title: '当前环境不支持测试通知', icon: 'none' })
		return false
	}

	const enabled = await requestNotificationPermission({ silent: false, showToast: false })
	if (!enabled) {
		uni.showToast({ title: '请先开启通知权限', icon: 'none' })
		return false
	}

	const now = Date.now()
	const homework = {
		id: `test_${now}`,
		subject: '测试科目',
		note: '通知提醒测试',
		deadline: new Date(now + 60 * 60 * 1000).toISOString(),
		completed: false
	}
	const sent = sendLocalNotification({
		title: platform === 'app-android' ? '安卓提醒测试' : '小程序提醒测试',
		content: '这是一条作业助手提醒测试通知。',
		delay: 0,
		id: now % 2147483647,
		homework
	})
	if (platform === 'app-android' && sent) {
		uni.showToast({ title: '测试通知已发送', icon: 'success' })
	}
	return !!sent
}

function sendWechatServiceNotification(title, content, id, homework) {
	// #ifdef MP-WEIXIN
	if (!getNotificationPermissionStatus()) return false
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
	return true
	// #endif
	
	// #ifndef MP-WEIXIN
	uni.showModal({
		title,
		content,
		showCancel: false
	})
	return true
	// #endif
}

function sendAndroidNotification(title, content, delay, id) {
	// #ifdef APP-PLUS
	try {
		if (plus.push && typeof plus.push.createMessage === 'function') {
			plus.push.createMessage(content, { id: `${id || Date.now()}` }, {
				title,
				sound: 'system',
				cover: false,
				when: new Date(Date.now() + delay)
			})
			return true
		}
	} catch (e) {
		console.warn('plus.push 通知发送失败，尝试原生通知：', e)
	}

	try {
		ensureAndroidNotificationChannel()
		const main = plus.android.runtimeMainActivity()
		const Intent = plus.android.importClass('android.content.Intent')
		const PendingIntent = plus.android.importClass('android.app.PendingIntent')
		const Notification = plus.android.importClass('android.app.Notification')
		const NotificationManager = plus.android.importClass('android.app.NotificationManager')
		const Context = plus.android.importClass('android.content.Context')
		const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
		const intent = plus.android.newObject('android.content.Intent', main, main.getClass())
		plus.android.invoke(intent, 'setFlags', Intent.FLAG_ACTIVITY_SINGLE_TOP)
		const pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT | (PendingIntent.FLAG_IMMUTABLE || 0)
		const pendingIntent = PendingIntent.getActivity(main, parseInt(id) || 0, intent, pendingIntentFlags)
		const builder = plus.android.newObject('android.app.Notification$Builder', main)
		plus.android.invoke(builder, 'setSmallIcon', main.getApplicationInfo().icon)
		plus.android.invoke(builder, 'setContentTitle', title)
		plus.android.invoke(builder, 'setContentText', content)
		plus.android.invoke(builder, 'setAutoCancel', true)
		plus.android.invoke(builder, 'setContentIntent', pendingIntent)
		const BuildVersion = plus.android.importClass('android.os.Build$VERSION')
		if (BuildVersion.SDK_INT >= 26) {
			plus.android.invoke(builder, 'setChannelId', 'homework_reminder')
		}
		const notification = plus.android.invoke(builder, 'build')
		notification.defaults = Notification.DEFAULT_SOUND
		nm.notify(parseInt(id) || Date.now(), notification)
		return true
	} catch (e) {
		console.error('Android 通知发送失败：', e)
		uni.showToast({ title: '通知发送失败，请查看控制台', icon: 'none' })
		return false
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

function getHomeworkReminderTime(homework) {
	if (homework && homework.reminderAt) {
		const reminderAt = new Date(homework.reminderAt).getTime()
		if (!Number.isNaN(reminderAt)) return reminderAt
	}
	const deadlineTime = new Date(homework.deadline).getTime()
	if (Number.isNaN(deadlineTime)) return 0
	const reminderOffsetHours = Number(homework.reminderOffsetHours) > 0 ? Number(homework.reminderOffsetHours) : 23
	return deadlineTime - reminderOffsetHours * 60 * 60 * 1000
}

export function setHomeworkReminder(homework) {
	if (!homework || homework.completed) return
	if (isNotified(homework.id)) return
	
	const deadlineTime = new Date(homework.deadline).getTime()
	const now = Date.now()
	const reminderTime = getHomeworkReminderTime(homework)
	
	if (!deadlineTime || deadlineTime <= now) return
	if (!reminderTime || reminderTime > now) return
	
	const mode = homework.reminderMode || getReminderMode()
	const content = mode === REMINDER_MODE_SMART
		? `下一次“${homework.subject}”课快开始了，请记得完成作业！`
		: `“${homework.subject}”的作业即将截止，请及时完成！`
	sendLocalNotification({
		title: mode === REMINDER_MODE_SMART ? '上课前作业提醒' : '作业即将截止',
		content,
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
	;(Array.isArray(homeworkList) ? homeworkList : []).forEach(homework => {
		if (!homework.completed) {
			setHomeworkReminder(homework)
		}
	})
}

export function startReminderDaemon() {
	keepReminderDaemonAlive()
	ensureAndroidNotificationChannel()
	const run = () => {
		try {
			const list = uni.getStorageSync(HOMEWORK_KEY)
			checkAndSetReminders(Array.isArray(list) ? list : [])
		} catch (e) {}
	}
	run()
	if (reminderDaemonTimer) return
	reminderDaemonTimer = setInterval(run, 60 * 1000)
}

export function stopReminderDaemon() {
	if (reminderDaemonTimer) {
		clearInterval(reminderDaemonTimer)
		reminderDaemonTimer = null
	}
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
