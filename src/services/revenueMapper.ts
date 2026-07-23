/**
 * revenueMapper.ts
 * 將「收入工時彙總」工作表映射為 RevenueRecord[]。
 *
 * 保守原則：若收入欄位不存在，回傳空陣列並附帶 info 訊息（不是 error）。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { RevenueRecord, MappingResult } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { REVENUE_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'
import { normalizeNumber } from './numberNormalizer'

export interface RevenueMappingOptions {
  /**
   * 若為 true，收入欄位缺失時只產生 info，不影響分析流程。
   * 預設 true（保守模式）。
   */
  lenient?: boolean
}

export function mapRevenueRecords(
  sheet: ParsedWorkbookSheet,
  options: RevenueMappingOptions = {}
): MappingResult<RevenueRecord> & { revenueFieldFound: boolean } {
  const { lenient = true } = options
  const issues: ValidationIssue[] = []
  const records: RevenueRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colItemNo        = resolveColumnIndex(headers, REVENUE_FIELD_MAPPING.itemNo)
  const colProjectCode   = resolveColumnIndex(headers, REVENUE_FIELD_MAPPING.projectCode)
  const colRevenueAmount = resolveColumnIndex(headers, REVENUE_FIELD_MAPPING.revenueAmount)
  const colRevenueType   = resolveColumnIndex(headers, REVENUE_FIELD_MAPPING.revenueType)
  const colPeriodType    = resolveColumnIndex(headers, REVENUE_FIELD_MAPPING.periodType)

  // 若收入金額欄位不存在 → 收入口徑未設定
  if (colRevenueAmount < 0) {
    const severity = lenient ? 'info' : 'warning'
    issues.push({
      code: 'REVENUE_FIELD_NOT_FOUND',
      severity,
      source: 'revenue-record',
      message: `收入工時彙總工作表中找不到收入金額欄位（已嘗試別名：${REVENUE_FIELD_MAPPING.revenueAmount.aliases.join('、')}），收入績效計算將顯示「尚未設定」。`,
      sheet: sheet.originalName,
    })
    return { records: [], issues, skippedRows: sheet.rows.length, revenueFieldFound: false }
  }

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    const itemNo      = colItemNo      >= 0 ? getCellString(row, colItemNo)      : ''
    const projectCode = colProjectCode >= 0 ? getCellString(row, colProjectCode) : ''
    const revenueType = colRevenueType >= 0 ? getCellString(row, colRevenueType) : ''
    const periodType  = colPeriodType  >= 0 ? getCellString(row, colPeriodType)  : ''

    const rawRevenue = row[colRevenueAmount]
    const revenueResult = normalizeNumber(rawRevenue, REVENUE_FIELD_MAPPING.revenueAmount.canonicalField, i)

    // 空列略過（所有鍵值欄均空白）
    if (!itemNo && !projectCode && !rawRevenue && rawRevenue !== 0) {
      skippedRows++
      continue
    }

    records.push({
      projectKey: projectCode || undefined,
      itemNo: itemNo || undefined,
      revenueAmount: revenueResult.valid ? (revenueResult.value as number) : null,
      revenueType: revenueType || undefined,
      periodType: periodType || undefined,
    })
  }

  return { records, issues, skippedRows, revenueFieldFound: true }
}
