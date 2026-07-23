import type { ValidationIssue } from './validation'

export interface ParsedImageEntry {
  filename: string
  basename: string
  /** 小寫 basename，用於不區分大小寫比對 */
  basenameKey: string
  /** 從 ZIP 中央目錄取得的解壓後大小（位元組），若不可用則為 null */
  size: number | null
  /** 壓縮後大小（位元組），若不可用則為 null */
  compressedSize: number | null
}

export interface ParsedZipResult {
  valid: boolean
  totalImages: number
  images: ParsedImageEntry[]
  duplicateBasenames: string[]
  issues: ValidationIssue[]
}

export interface ImageMatchSummary {
  /** Excel 引用的唯一圖片檔名數 */
  referencedCount: number
  /** 在 ZIP 中找到的引用圖片數 */
  matchedCount: number
  /** ZIP 中找不到的引用圖片數 */
  missingCount: number
  /** ZIP 中有但 Excel 未引用的圖片數 */
  unusedCount: number
  /** ZIP 中重複 basename 的數量 */
  duplicateBasenameCount: number
}

export interface ImageMatchResult {
  summary: ImageMatchSummary
  issues: ValidationIssue[]
}
