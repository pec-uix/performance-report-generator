/**
 * revenueCalculator.ts
 * 計算收入績效摘要。
 *
 * 保守原則：
 * 1. 若收入欄位未設定（revenueFieldFound=false），則 configured=false，所有金額為 null。
 * 2. 不對年度收入做季度分攤（禁止任何分攤假設）。
 * 3. 不對主項收入與子項收入做加總（避免雙重計算）。
 * 4. 只有口徑明確時才計算 revenuePerHour 和 inputOutputRatio。
 */

import type { RevenueRecord, ProjectGroupAnalysis, RevenueSummary } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'

export interface RevenueCalculatorInput {
  revenueRecords: RevenueRecord[]
  revenueFieldFound: boolean
  projectGroups: ProjectGroupAnalysis[]
  totalCumulativeHours: number
  totalQuarterHours: number
}

export function calculateRevenue(input: RevenueCalculatorInput): RevenueSummary {
  const { revenueRecords, revenueFieldFound, totalCumulativeHours } = input
  const issues: ValidationIssue[] = []

  // 收入口徑未設定
  if (!revenueFieldFound || revenueRecords.length === 0) {
    return {
      configured: false,
      cumulativeRevenue: null,
      quarterRevenue: null,
      revenuePerHour: null,
      inputOutputRatio: null,
      issues,
    }
  }

  // 計算可解析的收入總計
  let totalRevenue = 0
  let hasValidRevenue = false
  let hasNullRevenue = false

  for (const r of revenueRecords) {
    if (r.revenueAmount !== null && r.revenueAmount >= 0) {
      totalRevenue += r.revenueAmount
      hasValidRevenue = true
    } else if (r.revenueAmount === null) {
      hasNullRevenue = true
    }
  }

  if (!hasValidRevenue) {
    issues.push({
      code: 'REVENUE_NO_VALID_AMOUNT',
      severity: 'warning',
      source: 'revenue-record',
      message: '收入工時彙總工作表中所有收入金額均無法解析，收入績效計算顯示「尚未設定」。',
    })
    return {
      configured: false,
      cumulativeRevenue: null,
      quarterRevenue: null,
      revenuePerHour: null,
      inputOutputRatio: null,
      issues,
    }
  }

  if (hasNullRevenue) {
    issues.push({
      code: 'REVENUE_PARTIAL_NULL',
      severity: 'info',
      source: 'revenue-record',
      message: '部分收入記錄的金額無法解析，已略過這些記錄。',
    })
  }

  // 保守：不做季度分攤，季度收入標示為 null（需明確欄位）
  // 若有 periodType 欄位，可進一步區分，但此版本保守不猜
  const cumulativeRevenue = totalRevenue
  const quarterRevenue: number | null = null

  // revenuePerHour：累計收入 / 累計工時（需兩者均有值）
  const revenuePerHour =
    cumulativeRevenue > 0 && totalCumulativeHours > 0
      ? cumulativeRevenue / totalCumulativeHours
      : null

  // inputOutputRatio：此版本不計算（需明確成本口徑）
  const inputOutputRatio: number | null = null

  if (quarterRevenue === null) {
    issues.push({
      code: 'REVENUE_QUARTER_NOT_SPLIT',
      severity: 'info',
      source: 'revenue-record',
      message: '單季收入無法從收入資料中明確區分（需有期間類型欄位），已顯示為「尚未設定」。',
    })
  }

  return {
    configured: true,
    cumulativeRevenue,
    quarterRevenue,
    revenuePerHour,
    inputOutputRatio,
    issues,
  }
}
