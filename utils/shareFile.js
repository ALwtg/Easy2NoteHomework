// 跨端文件分享 / 文件读取工具
// 设计目标：
// - exportTextAsFile：把文本写到本地后，调用系统原生分享菜单
// - pickAndReadTextFile：选择本地文件，读取并返回纯文本
// - 剪切板工具：读 / 写

// ----------------- 剪切板 -----------------
export function readClipboard() {
	return new Promise((resolve, reject) => {
		uni.getClipboardData({
			success: res => resolve((res && (res.data || (res[1] && res[1].data))) || ''),
			fail: err => reject(err)
		})
	})
}

export function writeClipboard(text) {
	return new Promise((resolve, reject) => {
		uni.setClipboardData({
			data: `${text || ''}`,
			showToast: false,
			success: () => resolve(true),
			fail: err => reject(err)
		})
	})
}

// ----------------- 文件导出 + 系统分享 -----------------
// text: 文本内容
// filename: 文件名（含后缀）
// mimeType: 默认 application/json
export function exportTextAsFile(text, filename, mimeType = 'application/json') {
	const safeName = sanitizeFilename(filename || `export_${Date.now()}.json`)
	const safeMime = mimeType || 'application/json'
	const safeText = `${text == null ? '' : text}`

	// #ifdef APP-PLUS
	return new Promise((resolve, reject) => {
		writeAndShareOnApp(safeText, safeName, safeMime, resolve, reject)
	})
	// #endif

	// #ifdef MP-WEIXIN
	return writeAndShareOnMp(safeText, safeName, safeMime)
	// #endif

	// #ifdef H5
	try {
		downloadOnH5(safeText, safeName, safeMime)
		return Promise.resolve({ method: 'download' })
	} catch (e) {
		return Promise.reject(e)
	}
	// #endif

	// 其它平台
	return Promise.reject(new Error('当前平台暂不支持导出文件'))
}

// ----------------- 文件选择 + 读文本 -----------------
export function pickAndReadTextFile(options = {}) {
	const extensions = options.extensions || ['txt', 'json']

	// #ifdef MP-WEIXIN
	return pickAndReadOnMp(extensions)
	// #endif

	// #ifdef APP-PLUS
	return pickAndReadOnApp(extensions)
	// #endif

	// #ifdef H5
	return pickAndReadOnH5(extensions)
	// #endif

	return Promise.reject(new Error('当前平台暂不支持选择文件'))
}

// ====================================================
// 实现细节
// ====================================================

function sanitizeFilename(name) {
	return `${name || ''}`.replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || `export_${Date.now()}.json`
}

// -------- App-Plus --------
// #ifdef APP-PLUS
function writeAndShareOnApp(text, filename, mimeType, resolve, reject) {
	try {
		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, fs => {
			fs.root.getDirectory('export', { create: true }, dir => {
				dir.getFile(filename, { create: true, exclusive: false }, fileEntry => {
					fileEntry.createWriter(writer => {
						writer.onerror = err => reject(err)
						writer.onwrite = () => {
							const localUrl = fileEntry.toLocalURL()
							shareFileOnApp(localUrl, filename, mimeType, text)
								.then(res => resolve({ method: 'share', path: localUrl, ...(res || {}) }))
								.catch(err => {
									// 分享失败也认为已成功保存
									resolve({ method: 'saved', path: localUrl, shareError: (err && err.message) || `${err}` })
								})
						}
						try {
							writer.write(text)
						} catch (e) {
							reject(e)
						}
					}, reject)
				}, reject)
			}, reject)
		}, reject)
	} catch (e) {
		reject(e)
	}
}

function shareFileOnApp(fileLocalURL, filename, mimeType, fallbackText) {
	return new Promise((resolve, reject) => {
		const isAndroid = (() => {
			try { return plus.os && /android/i.test(plus.os.name || '') } catch (e) { return false }
		})()

		// Android：plus.runtime.openFile 会调用系统"打开方式"菜单，
		// QQ / 微信 / WPS / MT 管理器 / 文件管理器等都会出现，且不会被识别为破损图片。
		// （之前用 plus.share.sendWithSystem 的 href / pictures 传 .txt 文件，
		//   会被聊天 App 当作图片或链接，导致显示破损预览。）
		if (isAndroid) {
			try {
				plus.runtime.openFile(fileLocalURL, {}, err => {
					// openFile 失败时再尝试 Intent.ACTION_SEND
					shareFileViaIntent(fileLocalURL, filename, mimeType)
						.then(resolve)
						.catch(() => reject(err || new Error('无法打开文件')))
				})
				// openFile 没有 success 回调，认为已弹出选择器
				setTimeout(() => resolve({ via: 'plus.runtime.openFile' }), 250)
				return
			} catch (e) {
				// 直接走 Intent
				shareFileViaIntent(fileLocalURL, filename, mimeType).then(resolve).catch(reject)
				return
			}
		}

		// iOS 等其它平台：保留 plus.share.sendWithSystem
		try {
			if (plus && plus.share && plus.share.sendWithSystem) {
				plus.share.sendWithSystem({
					type: 'text',
					content: fallbackText && fallbackText.length < 1000 ? fallbackText : `${filename} 由作业助手导出`,
					title: filename,
					href: fileLocalURL
				}, () => resolve({ via: 'plus.share' }), err => reject(err))
				return
			}
		} catch (e) {}

		reject(new Error('当前环境不支持分享文件'))
	})
}

function shareFileViaIntent(fileLocalURL, filename, mimeType) {
	return new Promise((resolve, reject) => {
		try {
			const main = plus.android.runtimeMainActivity()
			const Intent = plus.android.importClass('android.content.Intent')
			const Uri = plus.android.importClass('android.net.Uri')
			const File = plus.android.importClass('java.io.File')
			try {
				const Builder = plus.android.importClass('android.os.StrictMode$VmPolicy$Builder')
				const StrictMode = plus.android.importClass('android.os.StrictMode')
				StrictMode.setVmPolicy(new Builder().build())
			} catch (e) {}
			const localPath = plus.io.convertLocalFileSystemURL(fileLocalURL)
			const file = new File(localPath)
			const intent = new Intent(Intent.ACTION_SEND)
			intent.setType(mimeType || '*/*')
			intent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(file))
			intent.putExtra(Intent.EXTRA_SUBJECT, filename)
			intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
			main.startActivity(Intent.createChooser(intent, '分享文件'))
			resolve({ via: 'android-intent' })
		} catch (e) {
			reject(e)
		}
	})
}

function pickAndReadOnApp(extensions) {
	const isAndroid = (() => {
		try { return plus.os && /android/i.test(plus.os.name || '') } catch (e) { return false }
	})()

	// Android：直接用原生 Intent 拉起系统文件选择器，比 uni.chooseFile 兼容性更好
	// 而且支持从微信/QQ等聊天工具中转过来的、扩展名不规则的文件
	if (isAndroid) {
		return pickAndReadOnAndroidIntent(extensions).catch(err => {
			// 万一 Intent 走不通，回退到 uni.chooseFile
			return pickAndReadOnUni(extensions).catch(() => {
				throw err
			})
		})
	}
	// iOS 等：使用 uni.chooseFile
	return pickAndReadOnUni(extensions)
}

function pickAndReadOnUni(extensions) {
	return new Promise((resolve, reject) => {
		if (typeof uni.chooseFile !== 'function') {
			reject(new Error('当前 App 版本不支持选择文件，请改用粘贴分享码或剪切板导入'))
			return
		}
		uni.chooseFile({
			count: 1,
			type: 'all',
			// extension 这里故意不传：部分机型对扩展名过滤过严，会把聊天工具中转后的文件挡掉
			success: res => {
				const file = (res.tempFiles && res.tempFiles[0]) || {
					path: res.tempFilePaths && res.tempFilePaths[0],
					name: ''
				}
				if (!file || !file.path) {
					reject(new Error('未选择文件'))
					return
				}
				readAppFileText(file.path)
					.then(content => resolve({ filename: file.name || '', content, size: file.size || 0, path: file.path }))
					.catch(reject)
			},
			fail: err => {
				const msg = (err && (err.errMsg || err.message)) || ''
				if (/cancel/i.test(msg)) {
					reject(new Error('未选择文件'))
				} else {
					reject(new Error(msg || '无法打开文件选择器'))
				}
			}
		})
	})
}

// Android 端通过 Intent.ACTION_GET_CONTENT 拉起系统文件选择器，并读取所选文件
function pickAndReadOnAndroidIntent(extensions) {
	return new Promise((resolve, reject) => {
		try {
			const main = plus.android.runtimeMainActivity()
			const Intent = plus.android.importClass('android.content.Intent')
			const intent = new Intent(Intent.ACTION_GET_CONTENT)
			intent.setType('*/*')
			// 提示系统优先列出文本类文件
			try {
				const mimeTypes = ['text/plain', 'application/json', 'text/*', 'application/*']
				intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
			} catch (e) {}
			intent.addCategory(Intent.CATEGORY_OPENABLE)

			const REQ_CODE = 9301
			const onResult = (activity, requestCode, resultCode, data) => {
				if (requestCode !== REQ_CODE) return
				try {
					main.onActivityResult = null
				} catch (e) {}
				const RESULT_OK = -1
				if (resultCode !== RESULT_OK || !data) {
					reject(new Error('未选择文件'))
					return
				}
				try {
					const uri = data.getData()
					if (!uri) {
						reject(new Error('未选择文件'))
						return
					}
					copyContentUriToSandbox(uri)
						.then(({ localPath, displayName, size }) => {
							readAppFileText(localPath)
								.then(content => resolve({ filename: displayName, content, size, path: localPath }))
								.catch(reject)
						})
						.catch(reject)
				} catch (e) {
					reject(e)
				}
			}
			try {
				main.onActivityResult = onResult
			} catch (e) {}

			main.startActivityForResult(Intent.createChooser(intent, '选择课表/作业分享文件'), REQ_CODE)
		} catch (e) {
			reject(e)
		}
	})
}

// 将系统选择器返回的 content:// URI 复制到应用沙盒，再返回沙盒路径供 plus.io 读取
function copyContentUriToSandbox(uri) {
	return new Promise((resolve, reject) => {
		try {
			const main = plus.android.runtimeMainActivity()
			const ContentResolver = main.getContentResolver()
			let displayName = ''
			let size = 0
			try {
				const cursor = ContentResolver.query(uri, null, null, null, null)
				if (cursor) {
					try {
						const OpenableColumns = plus.android.importClass('android.provider.OpenableColumns')
						const nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
						const sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
						if (cursor.moveToFirst()) {
							if (nameIdx >= 0) displayName = `${cursor.getString(nameIdx) || ''}`
							if (sizeIdx >= 0) size = cursor.getLong(sizeIdx) || 0
						}
					} catch (e) {}
					try { cursor.close() } catch (e) {}
				}
			} catch (e) {}

			const safeName = displayName || `import_${Date.now()}.txt`
			plus.io.requestFileSystem(plus.io.PRIVATE_DOC, fs => {
				fs.root.getDirectory('import', { create: true }, dir => {
					dir.getFile(safeName, { create: true, exclusive: false }, fileEntry => {
						try {
							const inputStream = ContentResolver.openInputStream(uri)
							const localPath = plus.io.convertLocalFileSystemURL(fileEntry.toLocalURL())
							const File = plus.android.importClass('java.io.File')
							const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
							const outFile = new File(localPath)
							const outputStream = new FileOutputStream(outFile)
							try {
								const FileUtils = plus.android.importClass('android.os.FileUtils')
								if (FileUtils && FileUtils.copy) {
									FileUtils.copy(inputStream, outputStream)
								} else {
									copyStreamFallback(inputStream, outputStream)
								}
							} catch (e) {
								copyStreamFallback(inputStream, outputStream)
							}
							try { outputStream.flush() } catch (e) {}
							try { outputStream.close() } catch (e) {}
							try { inputStream.close() } catch (e) {}
							resolve({ localPath: fileEntry.toLocalURL(), displayName: safeName, size })
						} catch (e) {
							reject(e)
						}
					}, reject)
				}, reject)
			}, reject)
		} catch (e) {
			reject(e)
		}
	})
}

function copyStreamFallback(inputStream, outputStream) {
	// 通过 Java 反射方式按字节读写。注意：byte[] 在 plus.android 下需要借助 java 类创建
	const BufferedReader = plus.android.importClass('java.io.BufferedReader')
	const InputStreamReader = plus.android.importClass('java.io.InputStreamReader')
	const OutputStreamWriter = plus.android.importClass('java.io.OutputStreamWriter')
	const reader = new BufferedReader(new InputStreamReader(inputStream, 'UTF-8'))
	const writer = new OutputStreamWriter(outputStream, 'UTF-8')
	let line = reader.readLine()
	let first = true
	while (line !== null) {
		if (!first) writer.write('\n')
		writer.write(line)
		first = false
		line = reader.readLine()
	}
	try { writer.flush() } catch (e) {}
	try { writer.close() } catch (e) {}
	try { reader.close() } catch (e) {}
}

function readAppFileText(filePath) {
	const tryRead = encoding => new Promise((resolve, reject) => {
		try {
			plus.io.resolveLocalFileSystemURL(filePath, entry => {
				entry.file(file => {
					const reader = new plus.io.FileReader()
					reader.onloadend = e => resolve((e && e.target && e.target.result) || '')
					reader.onerror = e => reject(e)
					try {
						reader.readAsText(file, encoding)
					} catch (e) {
						reject(e)
					}
				}, err => reject(err))
			}, err => reject(err))
		} catch (e) {
			reject(e)
		}
	})

	// 先 UTF-8；若含大量控制字符（很可能不是 UTF-8 编码）则再尝试 GBK
	return tryRead('utf-8').then(text => {
		if (text && /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text.slice(0, 256))) {
			return tryRead('gbk').then(t2 => t2 || text).catch(() => text)
		}
		return text
	}).catch(err => tryRead('gbk').catch(() => { throw err }))
}
// #endif

// -------- Mp-Weixin --------
// #ifdef MP-WEIXIN
function writeAndShareOnMp(text, filename, mimeType) {
	return new Promise((resolve, reject) => {
		try {
			const fs = wx.getFileSystemManager()
			const userDir = wx.env && wx.env.USER_DATA_PATH
			if (!userDir) {
				reject(new Error('当前小程序环境不支持文件操作'))
				return
			}
			const filePath = `${userDir}/${filename}`
			fs.writeFile({
				filePath,
				data: text,
				encoding: 'utf8',
				success: () => {
					if (typeof wx.shareFileMessage === 'function') {
						wx.shareFileMessage({
							filePath,
							fileName: filename,
							success: () => resolve({ method: 'share', path: filePath }),
							fail: err => {
								// 微信限制了能分享的扩展名，json/txt 通常会失败：回退到剪切板
								fallbackClipboard(text)
									.then(() => resolve({ method: 'clipboard', path: filePath, shareError: (err && err.errMsg) || `${err}` }))
									.catch(reject)
							}
						})
					} else {
						fallbackClipboard(text).then(() => resolve({ method: 'clipboard', path: filePath })).catch(reject)
					}
				},
				fail: err => reject(err)
			})
		} catch (e) {
			reject(e)
		}
	})
}

function fallbackClipboard(text) {
	return writeClipboard(text)
}

function pickAndReadOnMp(extensions) {
	return new Promise((resolve, reject) => {
		if (typeof uni.chooseMessageFile !== 'function') {
			reject(new Error('当前小程序环境不支持选择文件'))
			return
		}
		uni.chooseMessageFile({
			count: 1,
			type: 'file',
			extension: extensions,
			success: res => {
				const file = res.tempFiles && res.tempFiles[0]
				if (!file || !file.path) {
					reject(new Error('未选择文件'))
					return
				}
				try {
					const fs = wx.getFileSystemManager()
					fs.readFile({
						filePath: file.path,
						encoding: 'utf-8',
						success: r => resolve({ filename: file.name || '', content: r.data || '', size: file.size || 0, path: file.path }),
						fail: err => reject(err)
					})
				} catch (e) {
					reject(e)
				}
			},
			fail: err => reject(err)
		})
	})
}
// #endif

// -------- H5 --------
// #ifdef H5
function downloadOnH5(text, filename, mimeType) {
	const blob = new Blob([text], { type: mimeType || 'application/json;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function pickAndReadOnH5(extensions) {
	return new Promise((resolve, reject) => {
		const accept = (extensions || []).map(ext => `.${ext}`).join(',')
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = accept || '*/*'
		input.style.display = 'none'
		input.onchange = () => {
			const file = input.files && input.files[0]
			if (!file) {
				reject(new Error('未选择文件'))
				return
			}
			const reader = new FileReader()
			reader.onload = () => resolve({ filename: file.name, content: reader.result || '', size: file.size })
			reader.onerror = err => reject(err)
			reader.readAsText(file, 'utf-8')
		}
		document.body.appendChild(input)
		input.click()
		setTimeout(() => {
			if (input.parentNode) input.parentNode.removeChild(input)
		}, 5000)
	})
}
// #endif
