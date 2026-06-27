// 跨端 Base64 编码（兼容微信小程序，不依赖 btoa/atob）
// 编码内部使用 UTF-8，可安全用于中文 / Emoji

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function utf8Encode(str) {
	const bytes = []
	for (let i = 0; i < str.length; i++) {
		let c = str.charCodeAt(i)
		if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
			const c2 = str.charCodeAt(i + 1)
			if (c2 >= 0xdc00 && c2 <= 0xdfff) {
				c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
				i++
			}
		}
		if (c < 0x80) {
			bytes.push(c)
		} else if (c < 0x800) {
			bytes.push(0xc0 | (c >> 6))
			bytes.push(0x80 | (c & 0x3f))
		} else if (c < 0x10000) {
			bytes.push(0xe0 | (c >> 12))
			bytes.push(0x80 | ((c >> 6) & 0x3f))
			bytes.push(0x80 | (c & 0x3f))
		} else {
			bytes.push(0xf0 | (c >> 18))
			bytes.push(0x80 | ((c >> 12) & 0x3f))
			bytes.push(0x80 | ((c >> 6) & 0x3f))
			bytes.push(0x80 | (c & 0x3f))
		}
	}
	return bytes
}

function utf8Decode(bytes) {
	let str = ''
	let i = 0
	while (i < bytes.length) {
		const c = bytes[i]
		if (c < 0x80) {
			str += String.fromCharCode(c)
			i += 1
		} else if (c < 0xc0) {
			// 非法首字节，跳过
			i += 1
		} else if (c < 0xe0) {
			const c2 = bytes[i + 1] || 0
			str += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f))
			i += 2
		} else if (c < 0xf0) {
			const c2 = bytes[i + 1] || 0
			const c3 = bytes[i + 2] || 0
			str += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f))
			i += 3
		} else {
			const c2 = bytes[i + 1] || 0
			const c3 = bytes[i + 2] || 0
			const c4 = bytes[i + 3] || 0
			let cp = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)
			cp -= 0x10000
			str += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
			i += 4
		}
	}
	return str
}

export function base64Encode(input) {
	const bytes = utf8Encode(`${input || ''}`)
	let out = ''
	for (let i = 0; i < bytes.length; i += 3) {
		const b1 = bytes[i]
		const b2 = bytes[i + 1]
		const b3 = bytes[i + 2]
		out += B64_CHARS[b1 >> 2]
		out += B64_CHARS[((b1 & 3) << 4) | ((b2 == null ? 0 : b2) >> 4)]
		out += i + 1 < bytes.length ? B64_CHARS[(((b2 || 0) & 15) << 2) | ((b3 == null ? 0 : b3) >> 6)] : '='
		out += i + 2 < bytes.length ? B64_CHARS[(b3 || 0) & 63] : '='
	}
	return out
}

export function base64Decode(b64) {
	const lookup = {}
	for (let i = 0; i < B64_CHARS.length; i++) lookup[B64_CHARS[i]] = i
	const cleaned = `${b64 || ''}`.replace(/[^A-Za-z0-9+/=]/g, '')
	const bytes = []
	for (let i = 0; i < cleaned.length; i += 4) {
		const c1 = cleaned[i]
		const c2 = cleaned[i + 1]
		const c3 = cleaned[i + 2]
		const c4 = cleaned[i + 3]
		const e1 = lookup[c1] == null ? 0 : lookup[c1]
		const e2 = lookup[c2] == null ? 0 : lookup[c2]
		const e3 = c3 === '=' || c3 == null ? -1 : (lookup[c3] == null ? 0 : lookup[c3])
		const e4 = c4 === '=' || c4 == null ? -1 : (lookup[c4] == null ? 0 : lookup[c4])
		bytes.push((e1 << 2) | (e2 >> 4))
		if (e3 !== -1) bytes.push(((e2 & 15) << 4) | (e3 >> 2))
		if (e4 !== -1) bytes.push(((e3 & 3) << 6) | e4)
	}
	return utf8Decode(bytes)
}
