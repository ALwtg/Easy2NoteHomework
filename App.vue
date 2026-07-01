<script>
	import { requestNotificationPermissionOnFirstLaunch, startReminderDaemon } from '@/utils/notification.js'

	export default {
		onLaunch: function() {
			console.log('App Launch')
			requestNotificationPermissionOnFirstLaunch()
			startReminderDaemon()
		},
		onShow: function() {
			console.log('App Show')
			startReminderDaemon()
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	page {
		min-height: 100%;
		background: #f4f7fb;
		font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
	}

	button::after {
		border: none;
	}
</style>
