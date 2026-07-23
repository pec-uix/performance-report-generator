/**
 * projectMappingMapper.ts
 * 解析「専案對應表」工作表，建立 moduleKey → itemNo 的精確映射。
 *
 * 設計原則：
 * - 嚴格完整比對，不使用 includes / 模糊相似度。
 * - 同一 moduleKey 對應多個不同 itemNo → AMBIGUOUS_MODULE_ITEM_MAPPING Error，
 *   該筆 moduleKey 從映射中移除。
 * - 同一 moduleKey + 同一 itemNo 重複出現 → 靜默跳過（不報錯）。
 * - 此工作表為選用；未提供時呼叫端應使用空的 Map。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { ProjectMappingRecord } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { PROJECT_MAPPING_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'

export interface ProjectMappingResult {
  /** 所有成功解析的對應記錄（含重複行） */
  records: ProjectMappingRecord[]
  /** moduleKey → itemNo；歧義 moduleKey 不包含在內 */
  moduleToItemNo: Map<string, string>
  issues: ValidationIssue[]
  /** 空行或必要欄位空白而略過的列數 */
  skippedRows: number
  /** 兩個必要欄位均已找到 */
  hasRequiredColumns: boolean
}

/**
 * 解析 ParsedWorkbookSheet 並回傳 ProjectMappingResult。
 */
export function mapProjectMappingRecords(sheet: ParsedWorkbookSheet): ProjectMappingResult {
  const issues: ValidationIssue[] = []
  const records: ProjectMappingRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colItemNo   = resolveColumnIndex(headers, PROJECT_MAPPING_FIELD_MAPPING.itemNo)
  const colModuleKey = resolveColumnIndex(headers, PROJECT_MAPPING_FIELD_MAPPING.moduleKey)

  if (colItemNo < 0) {
    issues.push({
      code: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      source: 'project-mapping',
      message: `専案對應表找不到「項次」欄（已嘗試別名：${PROJECT_MAPPING_FIELD_MAPPING.itemNo.aliases.join('、')}）`,
      sheet: sheet.originalName,
    })
    return {
      records: [],
      moduleToItemNo: new Map(),
      issues,
      skippedRows: sheet.rowCount,
      hasRequiredColumns: false,
    }
  }

  if (colModuleKey < 0) {
    issues.push({
      code: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      source: 'project-mapping',
      message: `専案對應表找不到「模組」欄（已嘗試別名：${PROJECT_MAPPING_FIELD_MAPPING.moduleKey.aliases.join('、')}）`,
      sheet: sheet.originalName,
    })
    return {
      records: [],
      moduleToItemNo: new Map(),
      issues,
      skippedRows: sheet.rowCount,
      hasRequiredColumns: false,
    }
  }

  // moduleKey → itemNo；歧義的 key 先從此 Map 移除，再加入 ambiguousModules
  const moduleToItemNo = new Map<string, string>()
  // 已標記為歧義的 moduleKey（不再重複報錯）
  const ambiguousModules = new Set<string>()

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    const itemNo    = getCellString(row, colItemNo).trim()
    const moduleKey = getCellString(row, colModuleKey).trim()

    if (!itemNo || !moduleKey) {
      skippedRows++
      continue
    }

    // 已知歧義模組 → 跳過（已報錯過）
    if (ambiguousModules.has(moduleKey)) {
      skippedRows++
      continue
    }

    const existing = moduleToItemNo.get(moduleKey)
    if (existing !== undefined) {
      if (existing !== itemNo) {
        // 同一模組對應到不同項次 → 歧義 Error
        issues.push({
          code: 'AMBIGUOUS_MODULE_ITEM_MAPPING',
          severity: 'error',
          source: 'project-mapping',
          message: `模組「${moduleKey}」同時對應到項次「${existing}」與「${itemNo}」，產生歧義，此模組的對應已移除。`,
          row: i + 2,
          sheet: sheet.originalName,
        })
        moduleToItemNo.delete(moduleKey)
        ambiguousModules.add(moduleKey)
        skippedRows++
        continue
      }
      // 相同 moduleKey + 相同 itemNo：重複行，靜默跳過記錄，但仍加入 records
    } else {
      moduleToItemNo.set(moduleKey, itemNo)
    }

    records.push({ itemNo, moduleKey })
  }

  return {
    records,
    moduleToItemNo,
    issues,
    skippedRows,
    hasRequiredColumns: true,
  }
}
