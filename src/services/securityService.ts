/**
 * securityService.ts
 * 安全性斷言工具，確保不使用任何持久化儲存或禁止的 API。
 * Phase 1：只驗證，不執行任何網路請求。
 */

/**
 * 斷言沒有使用持久化儲存。
 * 若偵測到任何持久化 API，拋出錯誤。
 */
export function assertNoPersistentStorage(): void {
  const forbidden = [
    { name: 'localStorage', obj: typeof window !== 'undefined' ? window.localStorage : null },
    { name: 'sessionStorage', obj: typeof window !== 'undefined' ? window.sessionStorage : null },
  ]

  for (const item of forbidden) {
    if (item.obj !== null && item.obj !== undefined) {
      // 只檢查是否存在，不讀取內容
      try {
        const length = item.obj.length
        if (length > 0) {
          throw new Error(
            `[SecurityService] 偵測到 ${item.name} 有資料（${length} 個項目），違反安全規範。`
          )
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('[SecurityService]')) {
          throw e
        }
        // 若存取被拒（如 SecurityError），視為安全
      }
    }
  }
}

/**
 * 斷言檔案副檔名合法。
 * @returns true 表示合法，false 表示不合法
 */
export function assertAllowedFileExtension(file: File, allowedExtensions: string[]): boolean {
  const fileName = file.name.toLowerCase()
  return allowedExtensions.some((ext) => fileName.endsWith(ext.toLowerCase()))
}

/**
 * 斷言檔案大小不超過上限。
 * @returns true 表示合法，false 表示超過大小
 */
export function assertFileSize(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes
}
