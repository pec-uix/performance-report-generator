/**
 * downloadService.ts
 * Phase 4 PPT 下載服務。
 *
 * 規則：
 * 1. 使用 URL.createObjectURL 建立暫時 URL。
 * 2. 建立並觸發臨時 <a> 元素後立即移除。
 * 3. 在下一個事件循環撤銷 Object URL（不過早 revoke）。
 * 4. 不寫入任何持久化儲存。
 * 5. MIME type 由呼叫方確保正確。
 */

/**
 * 觸發 PPT 下載。
 * 建立 Object URL → 觸發 <a> 點擊下載 → 移除 <a> 元素。
 * @returns 建立的 Object URL（供 revokeAfterTick 或 cleanup 使用）
 */
export function triggerPptDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return url
}

/**
 * 在下一個事件循環中撤銷 Object URL。
 * 確保瀏覽器有足夠時間啟動下載後才釋放 URL。
 */
export function revokeAfterTick(url: string): void {
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // 忽略已失效或已撤銷的 URL
    }
  }, 0)
}
