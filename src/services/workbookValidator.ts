/**
 * workbookValidator.ts
 * 驗證工時 Excel 工作簿是否包含所有必要工作表。
 */

import type { WorkbookValidationResult, ParsedWorkbookSheet } from '@/types/excel'
import type { ValidationIssue } from '@/types/validation'
import { REQUIRED_WORK_SHEETS, type RequiredWorkSheet } from '@/config/requiredSheets'
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

  // 解析已找到的必要工作表
  for (const sheetInfo of sheetNames) {
    const isRequired = (REQUIRED_WORK_SHEETS as readonly string[]).includes(
      sheetInfo.normalized
    )
    if (!isRequired) continue

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
