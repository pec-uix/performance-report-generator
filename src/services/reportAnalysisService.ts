/**
 * reportAnalysisService.ts
 * Phase 3 主要分析協調器。
 *
 * 前提條件：Phase 2 必須通過驗證（errorCount === 0）。
 * 不呼叫任何網路 API，不持久化任何資料。
 */

import type { QuarterKey } from '@/types/report'
import type { ValidationIssue } from '@/types/validation'
import type { ValidationState } from './validationService'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'

import { getQuarterDateRanges } from './quarterDateRanges'
import { mapWorkRecords } from './workRecordMapper'
import { mapPersonRecords } from './personMapper'
import { mapProjectMasterRecords, buildProjectKeySet } from './projectMasterMapper'
import { mapMaintenanceRecords, buildMaintenanceKeySet } from './maintenanceMapper'
import { mapRevenueRecords } from './revenueMapper'
import { filterRecordsByDateRange } from './quarterFilter'
import { calculateWorkHours } from './workHoursCalculator'
import { calculateWorkforce } from './workforceCalculator'
import { calculateProjectGroups } from './projectGroupCalculator'
import { rankByCumulativeHours, rankByQuarterHours } from './projectRanking'
import { calculateRevenue } from './revenueCalculator'

/** 工時 Excel 各工作表名稱（需與 requiredSheets.ts 一致） */
const SHEET_WORK_HOURS   = '工時分析(自助)'
const SHEET_PROJECT_LIST = '專案清單'
const SHEET_MAINT_LIST   = '維運清單'
const SHEET_PERSON_LIST  = '人員清單'
const SHEET_REVENUE      = '收入工時彙總'

/**
 * 執行 Phase 3 分析。
 *
 * @param validationState - Phase 2 完整驗證狀態
 * @param quarter         - 要計算的季度代碼
 * @returns ReportAnalysisResult
 * @throws 若 Phase 2 有錯誤則拋出 Error
 */
export function runAnalysis(
  validationState: ValidationState,
  quarter: QuarterKey
): ReportAnalysisResult {
  if (validationState.errorCount > 0) {
    throw new Error('Phase 2 驗證尚有錯誤，請修正後再執行分析。')
  }

  if (!validationState.workbookResult) {
    throw new Error('找不到工時 Excel 驗證結果，請重新執行驗證。')
  }

  const { parsedSheets } = validationState.workbookResult
  const issues: ValidationIssue[] = []

  const sourceRowCounts: Record<string, number> = {}
  for (const [name, sheet] of Object.entries(parsedSheets)) {
    sourceRowCounts[name] = sheet.rowCount
  }

  // ── 1. 取得日期範圍 ──────────────────────────────────────────
  const dateRanges = getQuarterDateRanges(quarter)

  // ── 2. 映射主檔（專案、維運、人員）──────────────────────────
  const projectMasterSheet = parsedSheets[SHEET_PROJECT_LIST]
  const maintenanceSheet   = parsedSheets[SHEET_MAINT_LIST]
  const personSheet        = parsedSheets[SHEET_PERSON_LIST]
  const revenueSheet       = parsedSheets[SHEET_REVENUE]
  const workHoursSheet     = parsedSheets[SHEET_WORK_HOURS]

  if (!workHoursSheet) {
    throw new Error(`找不到工作表「${SHEET_WORK_HOURS}」，請確認工時 Excel 內容。`)
  }

  // 專案主檔
  const projectMasterResult = projectMasterSheet
    ? mapProjectMasterRecords(projectMasterSheet)
    : { records: [], issues: [], skippedRows: 0 }
  issues.push(...projectMasterResult.issues)

  // 維運主檔
  const maintenanceResult = maintenanceSheet
    ? mapMaintenanceRecords(maintenanceSheet)
    : { records: [], issues: [], skippedRows: 0 }
  issues.push(...maintenanceResult.issues)

  // 人員清單
  const personResult = personSheet
    ? mapPersonRecords(personSheet)
    : { records: [], issues: [], skippedRows: 0 }
  issues.push(...personResult.issues)

  // 建立主檔集合
  const projectKeySet    = buildProjectKeySet(projectMasterResult.records)
  const maintenanceKeySet = buildMaintenanceKeySet(maintenanceResult.records)

  // ── 3. 映射工時記錄 ──────────────────────────────────────────
  const workRecordResult = mapWorkRecords(workHoursSheet, projectKeySet, maintenanceKeySet)
  issues.push(...workRecordResult.issues)

  const allRecords = workRecordResult.records

  // ── 4. 依日期過濾 ────────────────────────────────────────────
  const cumulativeRecords = filterRecordsByDateRange(allRecords, dateRanges.cumulative)
  const quarterRecords    = filterRecordsByDateRange(allRecords, dateRanges.quarter)

  // ── 5. 工時統計 ──────────────────────────────────────────────
  const cumulativeWorkHours = calculateWorkHours(cumulativeRecords)
  const quarterWorkHours    = calculateWorkHours(quarterRecords)

  // ── 6. 人力統計 ──────────────────────────────────────────────
  const cumulativeWorkforce = calculateWorkforce(cumulativeRecords)
  const quarterWorkforce    = calculateWorkforce(quarterRecords)

  // ── 7. 專案群組分析 ──────────────────────────────────────────
  const projectItems = validationState.projectContentResult?.items ?? []
  const projectGroups = calculateProjectGroups(
    cumulativeRecords,
    quarterRecords,
    projectMasterResult.records,
    projectItems
  )

  // ── 8. 排行榜 ────────────────────────────────────────────────
  const cumulativeProjectRanking = rankByCumulativeHours(projectGroups)
  const quarterProjectRanking    = rankByQuarterHours(projectGroups)

  // ── 9. 收入分析 ──────────────────────────────────────────────
  const revenueMappingResult = revenueSheet
    ? mapRevenueRecords(revenueSheet)
    : { records: [], issues: [], skippedRows: 0, revenueFieldFound: false }
  issues.push(...revenueMappingResult.issues)

  const revenue = calculateRevenue({
    revenueRecords: revenueMappingResult.records,
    revenueFieldFound: revenueMappingResult.revenueFieldFound,
    projectGroups,
    totalCumulativeHours: cumulativeWorkHours.totalHours,
    totalQuarterHours: quarterWorkHours.totalHours,
  })
  issues.push(...revenue.issues)

  // ── 10. 資料品質摘要 ─────────────────────────────────────────
  const invalidDateRows    = workRecordResult.issues.filter((i) => i.code === 'INVALID_DATE').length
  const invalidHourRows    = workRecordResult.issues.filter((i) => i.code === 'INVALID_NUMBER').length
  const unmatchedPeopleRows = 0  // person lookup not yet implemented in mapper
  const unmatchedProjectRows = workRecordResult.issues.filter(
    (i) => i.code === 'UNMATCHED_WORK_ITEM'
  ).length
  const unmatchedMaintenanceRows = 0
  const unclassifiedRecords = allRecords.filter((r) => r.workCategory === 'other')
  const unclassifiedRows  = unclassifiedRecords.length
  const unclassifiedHours = unclassifiedRecords.reduce((s, r) => s + r.hours, 0)

  return {
    quarter,
    dateRanges,
    cumulative: {
      workHours: cumulativeWorkHours,
      workforce: cumulativeWorkforce,
    },
    quarterSummary: {
      workHours: quarterWorkHours,
      workforce: quarterWorkforce,
    },
    projectGroups,
    cumulativeProjectRanking,
    quarterProjectRanking,
    revenue,
    dataQuality: {
      invalidDateRows,
      invalidHourRows,
      unmatchedPeopleRows,
      unmatchedProjectRows,
      unmatchedMaintenanceRows,
      unclassifiedRows,
      unclassifiedHours,
    },
    issues,
    metadata: {
      calculatedAt: new Date().toISOString(),
      sourceRowCounts,
    },
  }
}
