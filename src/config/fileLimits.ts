export const FILE_LIMITS = {
  workExcelMaxBytes: 30 * 1024 * 1024,
  contentExcelMaxBytes: 10 * 1024 * 1024,
  zipMaxBytes: 200 * 1024 * 1024,
  /** ZIP 解壓後總大小上限 */
  maxExtractedBytes: 500 * 1024 * 1024,
  /** ZIP 中允許的最大圖片數 */
  maxImageCount: 300,
  /** 單張圖片最大位元組 */
  maxSingleImageBytes: 15 * 1024 * 1024,
  /** 每個圖片欄位建議上限 */
  maxImagesPerField: 4,
} as const

export const FILE_ACCEPT = {
  excel: '.xlsx',
  zip: '.zip',
} as const

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
