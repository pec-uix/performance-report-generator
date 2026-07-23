/**
 * imageMatcher.ts
 * 比對 Excel 圖片引用與 ZIP 圖片檔案。
 * 使用小寫 basename 索引，支援 Windows 不區分大小寫比對。
 */

import type { ParsedImageEntry, ParsedZipResult, ImageMatchResult, ImageMatchSummary } from '@/types/image'
import type { ProjectContentResult } from '@/types/project'
import type { ValidationIssue } from '@/types/validation'
import { FILE_LIMITS } from '@/config/fileLimits'

export function matchImages(
  projectResult: ProjectContentResult,
  zipResult: ParsedZipResult
): ImageMatchResult {
  const issues: ValidationIssue[] = []

  // 建立 ZIP 的 basenameKey → entries 索引（支援多個同名路徑，但會在 zipReader 已標記 error）
  const zipIndex = new Map<string, ParsedImageEntry[]>()
  for (const entry of zipResult.images) {
    const existing = zipIndex.get(entry.basenameKey) ?? []
    existing.push(entry)
    zipIndex.set(entry.basenameKey, existing)
  }

  // 蒐集所有 Excel 引用（去重，以 basenameKey 為單位）
  const referencedBasenameKeys = new Set<string>()

  for (const item of projectResult.items) {
    for (const imageRef of item.imageRefs) {
      // 每欄超過 4 張的警告
      if (imageRef.filenames.length > FILE_LIMITS.maxImagesPerField) {
        issues.push({
          code: 'IMG_TOO_MANY_PER_FIELD',
          severity: 'warning',
          source: 'image-reference',
          message: `專案「${item.normalizedItemNo}」的欄位「${imageRef.column}」引用了 ${imageRef.filenames.length} 張圖片，超過建議上限（${FILE_LIMITS.maxImagesPerField}）`,
          itemNo: item.normalizedItemNo,
          column: imageRef.column,
        })
      }

      for (const filename of imageRef.filenames) {
        referencedBasenameKeys.add(filename.toLowerCase())
      }
    }
  }

  // 找出缺少的引用（ZIP 中找不到）
  const matchedBasenameKeys = new Set<string>()
  for (const basenameKey of referencedBasenameKeys) {
    if (zipIndex.has(basenameKey)) {
      matchedBasenameKeys.add(basenameKey)
    } else {
      // 找回原始檔名供顯示（從任一 item 的 imageRefs 中找）
      let displayName = basenameKey
      for (const item of projectResult.items) {
        for (const ref of item.imageRefs) {
          const found = ref.filenames.find((f) => f.toLowerCase() === basenameKey)
          if (found) {
            displayName = found
            break
          }
        }
        if (displayName !== basenameKey) break
      }

      issues.push({
        code: 'IMG_MISSING',
        severity: 'warning',
        source: 'image-reference',
        message: `Excel 引用的圖片「${displayName}」在 ZIP 中找不到`,
        filename: displayName,
      })
    }
  }

  // 未被引用的 ZIP 圖片（Info）
  let unusedCount = 0
  const countedBasenameKeys = new Set<string>()
  for (const entry of zipResult.images) {
    if (!countedBasenameKeys.has(entry.basenameKey)) {
      countedBasenameKeys.add(entry.basenameKey)
      if (!referencedBasenameKeys.has(entry.basenameKey)) {
        unusedCount++
        issues.push({
          code: 'IMG_UNUSED',
          severity: 'info',
          source: 'image-reference',
          message: `ZIP 中的圖片「${entry.basename}」在 Excel 中未被引用`,
          filename: entry.basename,
        })
      }
    }
  }

  const summary: ImageMatchSummary = {
    referencedCount: referencedBasenameKeys.size,
    matchedCount: matchedBasenameKeys.size,
    missingCount: referencedBasenameKeys.size - matchedBasenameKeys.size,
    unusedCount,
    duplicateBasenameCount: zipResult.duplicateBasenames.length,
  }

  return { summary, issues }
}
