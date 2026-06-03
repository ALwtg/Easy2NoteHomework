import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const SCHOOL_ORIGIN = 'http://ehall.njit.edu.cn'

function dropFrameHeaders(proxyRes) {
	delete proxyRes.headers['x-frame-options']
	delete proxyRes.headers['content-security-policy']
	delete proxyRes.headers['content-security-policy-report-only']
}

export default defineConfig({
	plugins: [uni()],
	server: {
		proxy: {
			'/njit-ehall': {
				target: SCHOOL_ORIGIN,
				changeOrigin: true,
				rewrite: path => path.replace(/^\/njit-ehall/, ''),
				configure: proxy => {
					proxy.on('proxyRes', dropFrameHeaders)
				}
			},
			'/jwglxt': {
				target: SCHOOL_ORIGIN,
				changeOrigin: true,
				configure: proxy => {
					proxy.on('proxyRes', dropFrameHeaders)
				}
			}
		}
	}
})
