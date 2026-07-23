/**
 * zipReader.ts
 * 安全解析圖片 ZIP。使用 JSZip 讀取，不寫入本機檔案系統。
 *
 * 已知限制：
 * - 圖片大小（size/compressedSize）來自 ZIP 中央目錄的 metadata，
 *   惡意製作的 ZIP 可能填寫不實大小。本系統針對一般企業內部使用，
 *   不保護刻意偽造 metadata 的惡意 ZIP。
 * - JSZip 並不在 loadAsync 時驗證 CRC32，需呼叫 async() 才解壓驗證。
 *   本階段不全量解壓，因此 CRC 驗證為已知限制。
 */

import JSZip from 'jszip'
import type { ParsedZipResult, ParsedImageEntry } from '@/types/image'
import type { ValidationIssue } from '@/types/validation'
import { FILE_LIMITS } from '@/config/fileLimits'
import {
  getBasename,
  isAllowedImageExtension,
  isSafePath,
} from './imageValidator'

/** JSZip 項目內部 metadata（來自 ZIP 中央目錄） */
interface JSZipEntryData {
  uncompressedSize?: number
  compressedSize?: number
}

const MACOSX_PREFIX = '__MACOSX/'
const DS_STORE = '.DS_Store'

export async function parseZipBuffer(
  buffer: ArrayBuffer,
  limits: typeof FILE_LIMITS = FILE_LIMITS
): Promise<ParsedZipResult> {
  const issues: ValidationIssue[] = []
  const images: ParsedImageEntry[] = []
  const basenameCountMap = new Map<string, number>()

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    issues.push({
      code: 'ZIP_PARSE_ERROR',
      severity: 'error',
      source: 'image-zip',
      message: '無法解析 ZIP 檔案，請確認檔案格式正確。',
    })
    return { valid: false, totalImages: 0, images: [], duplicateBasenames: [], issues }
  }

  let estimatedExtractedBytes = 0

  for (const [filename, file] of Object.entries(zip.files)) {
    // 跳過資料夾
    if (file.dir) continue

    // 跳過 __MACOSX
    if (filename.startsWith(MACOSX_PREFIX)) continue

    // 跳過 .DS_Store
    const basename = getBasename(filename)
    if (basename === DS_STORE || basename === '') continue

    // 路徑安全檢查
    const safeCheck = isSafePath(filename)
    if (!safeCheck.safe) {
      issues.push({
        code: 'ZIP_UNSAFE_PATH',
        severity: 'error',
        source: 'image-zip',
        message: `ZIP 中的檔案路徑不安全（${safeCheck.reason}）`,
        filename: basename,
      })
      continue
    }

    // 副檔名檢查
    if (!isAllowedImageExtension(basename)) {
      issues.push({
        code: 'ZIP_INVALID_EXTENSION',
        severity: 'error',
        source: 'image-zip',
        message: `ZIP 中包含不允許的檔案「${basename}」（只允許 .png、.jpg、.jpeg）`,
        filename: basename,
      })
      continue
    }

    // 讀取 ZIP metadata（來自中央目錄，不需解壓）
    const internalData = (file as unknown as { _data?: JSZipEntryData })._data
    const uncompressedSize = internalData?.uncompressedSize ?? null
    const compressedSize = internalData?.compressedSize ?? null

    // 單檔大小檢查（若 metadata 可用）
    if (uncompressedSize !== null && uncompressedSize > limits.maxSingleImageBytes) {
      issues.push({
        code: 'ZIP_IMAGE_TOO_LARGE',
        severity: 'error',
        source: 'image-zip',
        message: `圖片「${basename}」超過單檔大小上限（${limits.maxSingleImageBytes / 1024 / 1024} MB）`,
        filename: basename,
      })
      continue
    }

    // 累計解壓大小（估算）
    if (uncompressedSize !== null) {
      estimatedExtractedBytes += uncompressedSize
      if (estimatedExtractedBytes > limits.maxExtractedBytes) {
        issues.push({
          code: 'ZIP_TOTAL_SIZE_EXCEEDED',
          severity: 'error',
          source: 'image-zip',
          message: `ZIP 解壓後估算總大小超過上限（${limits.maxExtractedBytes / 1024 / 1024} MB）`,
        })
        return {
          valid: false,
          totalImages: images.length,
          images,
          duplicateBasenames: [],
          issues,
        }
      }
    }

    // 追蹤重複 basename
    const basenameKey = basename.toLowerCase()
    basenameCountMap.set(basenameKey, (basenameCountMap.get(basenameKey) ?? 0) + 1)

    images.push({
      filename,
      basename,
      basenameKey,
      size: uncompressedSize,
      compressedSize,
    })
  }

  // 圖片總數限制
  if (images.length > limits.maxImageCount) {
    issues.push({
      code: 'ZIP_TOO_MANY_IMAGES',
      severity: 'error',
      source: 'image-zip',
      message: `ZIP 中的圖片數量（${images.length}）超過上限（${limits.maxImageCount}）`,
    })
    return {
      valid: false,
      totalImages: images.length,
      images,
      duplicateBasenames: [],
      issues,
    }
  }

  // 重複 basename → 無法確定 Excel 引用哪一張
  const duplicateBasenames: string[] = []
  for (const [key, count] of basenameCountMap.entries()) {
    if (count > 1) {
      duplicateBasenames.push(key)
      issues.push({
        code: 'ZIP_DUPLICATE_BASENAME',
        severity: 'error',
        source: 'image-zip',
        message: `ZIP 中有多個同名圖片（${key}），Excel 引用時無法確定對應哪一張`,
        filename: key,
      })
    }
  }

  const valid = issues.filter((i) => i.severity === 'error').length === 0

  return {
    valid,
    totalImages: images.length,
    images,
    duplicateBasenames,
    issues,
  }
}
