/**
 * workbookValidator.ts
 * 驗證工時 Excel 工作簿是否包含所有必要工作表。
 */

import type { WorkbookValidationResult, ParsedWorkbookSheet } from '@/types/excel'
import type { ValidationIssue } from '@/types/validation'
import {
  REQUIRED_WORK_SHEETS,
  OPTIONAL_WORK_SHEETS,
  PROJECT_MAPPING_SHEET,
  PIVOT_ANALYSIS_SHEETS,
  type RequiredWorkSheet,
} from '@/config/requiredSheets'
import { getSheetNames, parseSheet } from './excelReader'
import type * as XLSX from 'xlsx'

export function validateWorkHoursWorkbook(
  workbook: XLSX.WorkBook
): WorkbookValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const info: ValidationIssue[] = []
  const parsedSheets: Record<string, ParsedWorkbookSheet> = {}

  const sheetNames = getSheetNames(workbook)
  const detectedSheets = sheetNames.map((s) => s.original)
  const normalizedDetected = sheetNames.map((s) => s.normalized)

  const missingSheets: string[] = []

  for (const required of REQUIRED_WORK_SHEETS) {
    const found = normalizedDetected.some((name) => name === required)
    if (!found) {
      missingSheets.push(required)
      errors.push({
        code: 'WH_MISSING_SHEET',
        severity: 'error',
        source: 'work-hours-excel',
        message: `缺少必要工作表：「${required}」`,
        sheet: required,
      })
    }
  }

  for (const optional of OPTIONAL_WORK_SHEETS) {
    const found = normalizedDetected.some((name) => name === optional)
    if (!found) {
      info.push({
        code: 'WH_OPTIONAL_SHEET_MISSING',
        severity: 'info',
        source: 'work-hours-excel',
        message: `選用工作表「${optional}」不存在，將使用既有明細或主檔 fallback。`,
        sheet: optional,
      })
    }
  }

  for (const pivotSheet of PIVOT_ANALYSIS_SHEETS) {
    const found = normalizedDetected.some((name) => name === pivotSheet)
    if (!found) {
      info.push({
        code: 'WH_OPTIONAL_SHEET_MISSING',
        severity: 'info',
        source: 'work-hours-excel',
        message: `選用樞紐工作表「${pivotSheet}」不存在，圖表將使用明細 fallback。`,
        sheet: pivotSheet,
      })
    }
  }

  // 解析已找到的必要與選用工作表
  for (const sheetInfo of sheetNames) {
    const isRequired = (REQUIRED_WORK_SHEETS as readonly string[]).includes(
      sheetInfo.normalized
    )
    const isOptional = (OPTIONAL_WORK_SHEETS as readonly string[]).includes(
      sheetInfo.normalized
    )
    if (!isRequired && !isOptional) continue

    try {
      parsedSheets[sheetInfo.normalized as RequiredWorkSheet] = parseSheet(
        workbook,
        sheetInfo.original
      )
    } catch {
      errors.push({
        code: 'WH_SHEET_PARSE_ERROR',
        severity: 'error',
        source: 'work-hours-excel',
        message: `工作表「${sheetInfo.original}」無法解析`,
        sheet: sheetInfo.original,
      })
    }
  }

  // 解析選用工作表 専案對應表（若存在）
  const mappingSheetInfo = sheetNames.find((s) => s.normalized === PROJECT_MAPPING_SHEET)
  if (mappingSheetInfo) {
    try {
      parsedSheets[PROJECT_MAPPING_SHEET] = parseSheet(workbook, mappingSheetInfo.original)
    } catch {
      warnings.push({
        code: 'WH_SHEET_PARSE_ERROR',
        severity: 'warning',
        source: 'work-hours-excel',
        message: `選用工作表「${mappingSheetInfo.original}」無法解析`,
        sheet: mappingSheetInfo.original,
      })
    }
  }

  // 解析選用樞紐輸出工作表（Phase 6C 核心分析圖使用）
  for (const pivotSheet of PIVOT_ANALYSIS_SHEETS) {
    const pivotSheetInfo = sheetNames.find((s) => s.normalized === pivotSheet)
    if (!pivotSheetInfo) continue
    try {
      parsedSheets[pivotSheet] = parseSheet(workbook, pivotSheetInfo.original)
    } catch {
      warnings.push({
        code: 'WH_SHEET_PARSE_ERROR',
        severity: 'warning',
        source: 'work-hours-excel',
        message: `選用樞紐工作表「${pivotSheetInfo.original}」無法解析`,
        sheet: pivotSheetInfo.original,
      })
    }
  }

  return {
    valid: errors.length === 0,
    fileType: 'work-hours',
    detectedSheets,
    missingSheets,
    parsedSheets,
    errors,
    warnings,
    info,
  }
}
