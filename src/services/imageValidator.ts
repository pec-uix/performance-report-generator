/**
 * imageValidator.ts
 * 圖片檔案安全驗證工具函式。
 * 供 zipReader.ts 使用。
 */

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])

/**
 * 取得檔案的基本名稱（去除路徑）
 */
export function getBasename(filename: string): string {
  const parts = filename.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] ?? filename
}

/**
 * 取得小寫副檔名（含點，例如 '.png'）
 */
export function getExtension(filename: string): string {
  const lower = filename.toLowerCase()
  const dot = lower.lastIndexOf('.')
  return dot !== -1 ? lower.slice(dot) : ''
}

/**
 * 是否為允許的圖片副檔名
 */
export function isAllowedImageExtension(filename: string): boolean {
  return ALLOWED_IMAGE_EXTENSIONS.has(getExtension(filename))
}

/**
 * 路徑安全檢查結果
 */
export interface PathSafetyResult {
  safe: boolean
  reason?: string
}

/**
 * 檢查 ZIP 項目的路徑是否安全。
 * 拒絕：路徑穿越、絕對路徑、Windows 磁碟代號路徑。
 */
export function isSafePath(filename: string): PathSafetyResult {
  if (filename.includes('../') || filename.includes('..\\')) {
    return { safe: false, reason: '路徑包含 ../ 或 ..\\ 穿越字元' }
  }
  if (filename.startsWith('/')) {
    return { safe: false, reason: '禁止絕對路徑（以 / 開頭）' }
  }
  if (/^[a-zA-Z]:[/\\]/.test(filename)) {
    return { safe: false, reason: '禁止 Windows 磁碟代號路徑（如 C:\\）' }
  }
  return { safe: true }
}
