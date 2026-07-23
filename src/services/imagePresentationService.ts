/**
 * imagePresentationService.ts
 * Phase 5 圖片處理服務。
 *
 * 功能：
 * - Blob / Uint8Array → Data URL
 * - Contain 版型計算（保持比例，置中，不裁切）
 * - 建立圖片資料庫（從 ZIP 提取已驗證圖片）
 * - 缺圖占位
 *
 * 規則：
 * - 不在 console 輸出 base64、路徑或個資
 * - 不呼叫網路 API
 * - 不寫持久化儲存
 */

import JSZip from 'jszip'
import type { ParsedImageEntry } from '@/types/image'
import type { ImageRepository } from '@/types/ppt'

// ── MIME 型別 ──────────────────────────────────────────────────────────────

/** 依副檔名回傳 MIME type（僅支援 png/jpg/jpeg） */
export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'image/png'
}

// ── 資料轉換 ───────────────────────────────────────────────────────────────

/**
 * Uint8Array 轉 Data URL（同步）。
 * 使用 btoa + String.fromCharCode，分塊避免 stack overflow。
 * 不在 console 輸出 base64。
 */
export function uint8ToDataUrl(data: Uint8Array, filename: string): string {
  const mimeType = getMimeTypeFromFilename(filename)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...(chunk as unknown as number[]))
  }
  const b64 = btoa(binary)
  return `data:${mimeType};base64,${b64}`
}

/**
 * Blob 轉 Data URL（非同步，使用 FileReader）。
 * 不在 console 輸出任何內容。
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('圖片讀取失敗'))
    reader.readAsDataURL(blob)
  })
}

// ── Contain 版型計算 ───────────────────────────────────────────────────────

export interface ContainLayoutResult {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 計算 Contain 版型：保持比例、置中、不裁切、不拉伸。
 *
 * @param srcW  來源寬（任意正數單位，與 srcH 同單位）
 * @param srcH  來源高
 * @param cX    容器左邊 x（slide inches）
 * @param cY    容器上邊 y
 * @param cW    容器寬
 * @param cH    容器高
 */
export function calcContainLayout(
  srcW: number,
  srcH: number,
  cX: number,
  cY: number,
  cW: number,
  cH: number
): ContainLayoutResult {
  if (srcW <= 0 || srcH <= 0 || cW <= 0 || cH <= 0) {
    return { x: cX, y: cY, w: cW, h: cH }
  }
  const srcAspect = srcW / srcH
  const cAspect = cW / cH

  let scaledW: number
  let scaledH: number

  if (srcAspect > cAspect) {
    // 橫向圖：以寬度為準
    scaledW = cW
    scaledH = cW / srcAspect
  } else {
    // 縱向圖：以高度為準
    scaledH = cH
    scaledW = cH * srcAspect
  }

  const x = cX + (cW - scaledW) / 2
  const y = cY + (cH - scaledH) / 2

  return { x, y, w: scaledW, h: scaledH }
}

// ── 占位圖 ─────────────────────────────────────────────────────────────────

/**
 * 建立缺圖占位的 Data URL（1×1 灰色 PNG）。
 * 不在 console 輸出。
 */
export function buildPlaceholderDataUrl(): string {
  // 1×1 透明灰色 PNG（最小合法 PNG）
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII='
}

// ── 圖片資料庫 ─────────────────────────────────────────────────────────────

/**
 * 從 ZIP 提取已通過 Phase 2 驗證的圖片，建立 ImageRepository。
 *
 * 規則：
 * - 只解壓 validImages 清單中的圖片（信任 Phase 2 驗證）
 * - 不重新執行安全檢查
 * - 單張圖片失敗不阻擋其他圖片
 * - 不在 console 輸出路徑或 base64
 *
 * @param zipFile     ZIP File 物件（已在記憶體中）
 * @param validImages Phase 2 驗證通過的圖片清單
 */
export async function buildImageRepository(
  zipFile: File,
  validImages: ParsedImageEntry[]
): Promise<ImageRepository> {
  const map = new Map<string, Uint8Array>()
  if (validImages.length === 0) return map as ImageRepository

  let zip: JSZip
  try {
    const buffer = await zipFile.arrayBuffer()
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return map as ImageRepository
  }

  for (const entry of validImages) {
    const zipEntry = zip.files[entry.filename]
    if (!zipEntry || zipEntry.dir) continue
    try {
      const uint8 = await zipEntry.async('uint8array')
      map.set(entry.basenameKey, uint8)
    } catch {
      // 單張圖片失敗不阻擋（無法取得圖片時留白）
    }
  }

  return map as ImageRepository
}

// ── 資料庫查詢 ────────────────────────────────────────────────────────────

/**
 * 從 ImageRepository 取得圖片 Data URL。
 * 找不到或轉換失敗時回傳 null（呼叫端顯示占位）。
 * 不在 console 輸出任何資訊。
 *
 * @param repo        ImageRepository
 * @param basenameKey lowercase basename（查詢鍵）
 * @param filename    原始檔名（用於判斷 MIME type）
 */
export function getImageDataUrl(
  repo: ImageRepository,
  basenameKey: string,
  filename: string
): string | null {
  const data = repo.get(basenameKey)
  if (!data) return null
  try {
    return uint8ToDataUrl(data, filename)
  } catch {
    return null
  }
}
