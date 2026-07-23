/**
 * projectItemValidator.ts
 * 驗證「專案內容」工作表的項次格式，標記主專案、子專案與無效項次。
 * 本階段只標記與驗證，不進行最終分組或工時加總。
 */

import type { ProjectItem, ProjectItemType } from '@/types/project'
import type { ValidationIssue } from '@/types/validation'

/**
 * 正規化項次字串：
 * - trim
 * - 全形破折號（－）→ 半形（-）
 * - 破折號前後空白移除
 */
export function normalizeItemNo(raw: string): string {
  return raw
    .trim()
    .replace(/－/g, '-')
    .replace(/\s*-\s*/g, '-')
    .trim()
}

/**
 * 判斷項次類型：
 * - 純整數 → main
 * - 整數-整數 → child
 * - 空白 → invalid
 * - 其他 → invalid
 */
export function classifyItemNo(itemNo: string): ProjectItemType {
  if (itemNo === '') return 'invalid'
  if (/^\d+$/.test(itemNo)) return 'main'
  if (/^\d+-\d+$/.test(itemNo)) return 'child'
  return 'invalid'
}

export interface ItemValidationResult {
  items: ProjectItem[]
  issues: ValidationIssue[]
  mainCount: number
  childCount: number
  invalidCount: number
  duplicateCount: number
  orphanChildCount: number
}

/**
 * 驗證整批項次。
 * 輸入的 items 須包含 rawItemNo 與 rowIndex。
 */
export function validateProjectItems(items: ProjectItem[]): ItemValidationResult {
  const issues: ValidationIssue[] = []
  const seenItemNos = new Map<string, number>() // normalized → first rowIndex
  const duplicateSet = new Set<string>()
  let mainCount = 0
  let childCount = 0
  let invalidCount = 0
  let duplicateCount = 0
  let orphanChildCount = 0

  // ── 第一輪：正規化、分類、偵測重複 ──────────────────────────────
  for (const item of items) {
    const normalized = normalizeItemNo(item.rawItemNo)
    const itemType = classifyItemNo(normalized)
    item.normalizedItemNo = normalized
    item.itemType = itemType

    if (itemType === 'child') {
      item.parentItemNo = normalized.split('-')[0]
    }

    if (itemType === 'invalid') {
      invalidCount++
      const displayRow = item.sourceRow ?? item.rowIndex + 2
      const msg =
        normalized === ''
          ? `第 ${displayRow} 列的項次為空白`
          : `第 ${displayRow} 列的項次「${normalized}」格式無效（只支援純整數或「整數-整數」格式）`
      issues.push({
        code: 'PI_INVALID_ITEM_NO',
        severity: 'error',
        source: 'project-item',
        message: msg,
        row: displayRow,
        itemNo: normalized,
      })
    }

    if (normalized !== '') {
      if (seenItemNos.has(normalized)) {
        duplicateCount++
        duplicateSet.add(normalized)
        const displayRow = item.sourceRow ?? item.rowIndex + 2
        issues.push({
          code: 'PI_DUPLICATE_ITEM_NO',
          severity: 'error',
          source: 'project-item',
          message: `項次「${normalized}」重複，第 ${displayRow} 列`,
          row: displayRow,
          itemNo: normalized,
        })
      } else {
        seenItemNos.set(normalized, item.rowIndex)
        if (itemType === 'main') mainCount++
        else if (itemType === 'child') childCount++
      }
    }
  }

  // 蒐集不重複的主專案集合（用於孤兒與順序驗證）
  const validMainItems = new Map<string, number>() // normalized → arrayIndex
  items.forEach((item, idx) => {
    if (item.itemType === 'main' && !duplicateSet.has(item.normalizedItemNo)) {
      validMainItems.set(item.normalizedItemNo, idx)
    }
  })

  // ── 第二輪：孤兒子專案 & 子先於主的警告 ──────────────────────────
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    if (item.itemType !== 'child' || duplicateSet.has(item.normalizedItemNo)) continue
    if (!item.parentItemNo) continue

    const parentArrayIdx = validMainItems.get(item.parentItemNo)
    const displayRow = item.sourceRow ?? item.rowIndex + 2
    if (parentArrayIdx === undefined) {
      orphanChildCount++
      issues.push({
        code: 'PI_ORPHAN_CHILD',
        severity: 'error',
        source: 'project-item',
        message: `子專案「${item.normalizedItemNo}」找不到對應的主專案「${item.parentItemNo}」`,
        row: displayRow,
        itemNo: item.normalizedItemNo,
      })
    } else if (parentArrayIdx > idx) {
      issues.push({
        code: 'PI_CHILD_BEFORE_PARENT',
        severity: 'warning',
        source: 'project-item',
        message: `子專案「${item.normalizedItemNo}」出現在主專案「${item.parentItemNo}」之前`,
        row: displayRow,
        itemNo: item.normalizedItemNo,
      })
    }
  }

  return {
    items,
    issues,
    mainCount,
    childCount,
    invalidCount,
    duplicateCount,
    orphanChildCount,
  }
}
