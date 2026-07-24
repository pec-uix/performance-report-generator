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
import type { ProjectItem } from '@/types/project'
import type { ProjectMasterRecord, RevenueRecord } from '@/types/analysis'

import { getQuarterDateRanges } from './quarterDateRanges'
import { mapWorkRecords, buildNameToEmployeeKeyMap } from './workRecordMapper'
import { mapPersonRecords } from './personMapper'
import { mapProjectMasterRecords, buildProjectModuleKeySet } from './projectMasterMapper'
import { mapMaintenanceRecords, buildMaintenanceModuleKeySet } from './maintenanceMapper'
import { mapRevenueRecords } from './revenueMapper'
import { mapProjectMappingRecords } from './projectMappingMapper'
import { filterRecordsByDateRange } from './quarterFilter'
import { calculateWorkHours } from './workHoursCalculator'
import { calculateWorkforce } from './workforceCalculator'
import { calculateProjectGroups } from './projectGroupCalculator'
import { rankByCumulativeHours, rankByQuarterHours } from './projectRanking'
import { calculateRevenue } from './revenueCalculator'
import { buildPresentationAnalysis } from './presentationAnalysisService'
import { readPivotPresentationAnalysis } from './pivotAnalysisReader'
import { buildProjectCostHoursByItemNo } from './projectCostService'
import {
  applyPresentationScopeToProjectItems,
  buildPresentationScope,
  buildPresentationScopeModuleToItemNo,
  presentationScopeIssuesToValidationIssues,
} from './presentationScopeService'

/** 工時 Excel 各工作表名稱（需與 requiredSheets.ts 一致） */
const SHEET_WORK_HOURS   = '工時分析(自助)'
const SHEET_PROJECT_LIST = '專案清單'
const SHEET_MAINT_LIST   = '維運清單'
const SHEET_PERSON_LIST  = '人員清單'
const SHEET_REVENUE      = '收入工時彙總'
const SHEET_PROJECT_MAPPING = '専案對應表'
const FRONTEND_ORGANIZATION = '前端開發課'

function buildLegacyModuleToItemNo(projectItems: ProjectItem[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const item of projectItems) {
    if (!item.moduleKey || item.itemType !== 'main') continue
    if (!result.has(item.moduleKey)) {
      result.set(item.moduleKey, item.normalizedItemNo)
    }
  }
  return result
}

function countFrontendPeople(records: { department?: string; active?: boolean }[]): number {
  return records.filter(
    (record) => record.active !== false && record.department === FRONTEND_ORGANIZATION
  ).length
}

function filterFrontendRecords<T extends { organization?: string; canonicalOrganization?: string }>(records: T[]): T[] {
  return records.filter(
    (record) => (record.canonicalOrganization ?? record.organization) === FRONTEND_ORGANIZATION
  )
}

function buildRevenueRecordsFromProjectMaster(
  records: ProjectMasterRecord[]
): { records: RevenueRecord[]; issues: ValidationIssue[]; revenueFieldFound: boolean } {
  const revenueRecords: RevenueRecord[] = []
  let hasRevenueField = false

  const hasAnnualField = records.some((r) => r.annualRevenue !== undefined)

  if (!hasAnnualField) {
    return {
      records: [],
      revenueFieldFound: false,
      issues: [{
        code: 'REVENUE_PROJECT_MASTER_FIELD_MISSING',
        severity: 'info',
        source: 'revenue-record',
        message: '缺少「收入工時彙總」工作表，且「專案清單」未提供「年度收入」欄位，收入績效摘要顯示為「尚未設定」。',
      }],
    }
  }

  for (const record of records) {
    if (record.annualRevenue === undefined) continue
    hasRevenueField = true
    revenueRecords.push({
      projectKey: record.projectKey,
      itemNo: record.itemNo,
      revenueAmount: record.annualRevenue,
      revenueType: '專案清單.年度收入',
    })
  }

  if (hasRevenueField) {
    return {
      records: revenueRecords,
      revenueFieldFound: true,
      issues: [{
        code: 'REVENUE_PROJECT_MASTER_FALLBACK',
        severity: 'info',
        source: 'revenue-record',
        message: '缺少「收入工時彙總」工作表，整體收入摘要改用「專案清單.年度收入」欄位 fallback。',
      }],
    }
  }

  return {
    records: [],
    revenueFieldFound: false,
    issues: [{
      code: 'REVENUE_PROJECT_MASTER_FIELD_MISSING',
      severity: 'info',
      source: 'revenue-record',
      message: '缺少「收入工時彙總」工作表，且「專案清單」未提供「年度收入」欄位，收入績效摘要顯示為「尚未設定」。',
    }],
  }
}

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
  const projectModuleKeySet = buildProjectModuleKeySet(projectMasterResult.records)
  const maintenanceModuleKeySet = buildMaintenanceModuleKeySet(maintenanceResult.records)
  const nameToEmployeeKeyMap = buildNameToEmployeeKeyMap(personResult.records)

  // ── 3. 映射工時記錄 ──────────────────────────────────────────
  const workRecordResult = mapWorkRecords(
    workHoursSheet,
    projectModuleKeySet,
    maintenanceModuleKeySet,
    nameToEmployeeKeyMap
  )
  issues.push(...workRecordResult.issues)

  // 建立「員工識別鍵 → 人員清單組織」對照表；以人員清單為前後端分類依據
  const employeeKeyToCanonicalOrg = new Map<string, string>()
  for (const p of personResult.records) {
    if (p.department) employeeKeyToCanonicalOrg.set(p.employeeKey, p.department)
  }

  const allRecords = workRecordResult.records.map((r) => ({
    ...r,
    canonicalOrganization: employeeKeyToCanonicalOrg.get(r.employeeKey) ?? r.organization,
  }))

  // ── 4. 依日期過濾 ────────────────────────────────────────────
  const cumulativeRecords = filterRecordsByDateRange(allRecords, dateRanges.cumulative)
  const quarterRecords    = filterRecordsByDateRange(allRecords, dateRanges.quarter)
  const frontendRecords = filterFrontendRecords(allRecords)
  const frontendCumulativeRecords = filterRecordsByDateRange(frontendRecords, dateRanges.cumulative)
  const frontendQuarterRecords = filterRecordsByDateRange(frontendRecords, dateRanges.quarter)

  // ── 5. 工時統計 ──────────────────────────────────────────────
  const cumulativeWorkHours = calculateWorkHours(cumulativeRecords)
  const quarterWorkHours    = calculateWorkHours(quarterRecords)

  // ── 6. 人力統計 ──────────────────────────────────────────────
  const cumulativeWorkforce = calculateWorkforce(cumulativeRecords)
  const quarterWorkforce    = calculateWorkforce(quarterRecords)

  // ── 7. 専案對應表（選用） ────────────────────────────────────
  const mappingSheet = parsedSheets[SHEET_PROJECT_MAPPING]
  const projectMappingResult = mappingSheet
    ? mapProjectMappingRecords(mappingSheet)
    : {
        records: [],
        moduleToItemNo: new Map<string, string>(),
        issues: [],
        skippedRows: 0,
        hasRequiredColumns: false,
      }
  issues.push(...projectMappingResult.issues)

  // ── 8. Presentation 白名單（只控制成果頁範圍，不改整體工時計算） ──────────
  const projectItems = validationState.projectContentResult?.items ?? []
  const presentationScope = buildPresentationScope({
    projectContent: validationState.projectContentResult,
    projectMasters: projectMasterResult.records,
    maintenanceMasters: maintenanceResult.records,
    workRecords: allRecords,
  })
  issues.push(...presentationScopeIssuesToValidationIssues(presentationScope.issues))

  const scopedProjectItems = applyPresentationScopeToProjectItems(projectItems, presentationScope)
  const scopeModuleToItemNo = buildPresentationScopeModuleToItemNo(presentationScope)
  const hasPresentationScope = presentationScope.items.length > 0

  // ── 9. 専案群組分析 ──────────────────────────────────────────
  const effectiveModuleToItemNo =
    hasPresentationScope
      ? scopeModuleToItemNo
      : projectMappingResult.hasRequiredColumns
        ? projectMappingResult.moduleToItemNo
        : buildLegacyModuleToItemNo(projectItems)
  const projectGroups = calculateProjectGroups(
    frontendCumulativeRecords,
    frontendQuarterRecords,
    projectMasterResult.records,
    hasPresentationScope ? scopedProjectItems : projectItems,
    effectiveModuleToItemNo
  )
  // 成本同時保留本期與累積兩套 exact itemNo 工時；不得用累積值取代本期值。
  const projectCostHoursByItemNo = buildProjectCostHoursByItemNo(
    quarterRecords,
    hasPresentationScope ? presentationScope : undefined
  )
  const projectCostCumulativeHoursByItemNo = buildProjectCostHoursByItemNo(
    cumulativeRecords,
    hasPresentationScope ? presentationScope : undefined
  )

  // 阻擋規則：有専案工時但全部群組工時 = 0（対応表存在且欄位完整）
  const projectHoursCumulative = cumulativeRecords
    .filter((r) => r.workCategory === 'project')
    .reduce((s, r) => s + r.hours, 0)
  const mappedHoursCumulative = projectGroups.reduce((s, g) => s + g.cumulativeHours, 0)

  const hasMappingTable = !!mappingSheet && projectMappingResult.hasRequiredColumns
  const projectMappingBlocked =
    hasMappingTable && projectHoursCumulative > 0 && mappedHoursCumulative === 0

  if (projectMappingBlocked) {
    issues.push({
      code: 'PROJECT_MAPPING_ZERO_HOURS',
      severity: 'error',
      source: 'project-group',
      message: `専案累計工時共 ${projectHoursCumulative}H，但専案對應表未能對應任何工時至専案內容，無法產生有效排行。`,
    })
  }

  // 部分未對應警告
  const unmappedProjectCumulativeRecords = hasMappingTable
    ? cumulativeRecords.filter(
        (r) =>
          r.workCategory === 'project' &&
          !projectMappingResult.moduleToItemNo.has(r.projectKey ?? '')
      )
    : []
  const unmappedProjectRecords = unmappedProjectCumulativeRecords.length
  const unmappedProjectHours = unmappedProjectCumulativeRecords.reduce(
    (s, r) => s + r.hours,
    0
  )

  if (hasMappingTable && unmappedProjectHours > 0) {
    issues.push({
      code: 'PROJECT_MAPPING_PARTIAL_UNMATCHED',
      severity: 'warning',
      source: 'project-group',
      message: `${unmappedProjectRecords} 筆専案工時記錄（共 ${unmappedProjectHours}H）未對應至任何項次。`,
    })
  }

  // 専案名稱遺失警告
  for (const group of projectGroups) {
    if (!group.mainProject.projectName) {
      issues.push({
        code: 'PROJECT_NAME_MISSING',
        severity: 'warning',
        source: 'project-group',
        message: `専案項次「${group.mainItemNo}」找不到専案名稱，顯示為「未命名」。`,
      })
    }
  }

  // ── 10. 排行榜 ────────────────────────────────────────────────
  const cumulativeProjectRanking = rankByCumulativeHours(projectGroups)
  const quarterProjectRanking    = rankByQuarterHours(projectGroups)

  // ── 11. 收入分析 ──────────────────────────────────────────────
  const revenueMappingResult = revenueSheet
    ? mapRevenueRecords(revenueSheet)
    : {
        ...buildRevenueRecordsFromProjectMaster(projectMasterResult.records),
        skippedRows: 0,
      }
  issues.push(...revenueMappingResult.issues)

  const revenue = calculateRevenue({
    revenueRecords: revenueMappingResult.records,
    revenueFieldFound: revenueMappingResult.revenueFieldFound,
    projectGroups,
    totalCumulativeHours: cumulativeWorkHours.totalHours,
    totalQuarterHours: quarterWorkHours.totalHours,
  })
  revenue.sourceLabel = revenue.configured
    ? revenueSheet
      ? '收入工時彙總'
      : '專案清單收入欄位（fallback）'
    : undefined
  issues.push(...revenue.issues)

  // ── 12. Presentation 專用衍生分析 ─────────────────────────────────────
  const pivotPresentationAnalysis = readPivotPresentationAnalysis(parsedSheets, dateRanges, {
    selectedSemester: quarter,
    detailTotalHours: cumulativeWorkHours.totalHours,
  })
  const presentationAnalysis =
    pivotPresentationAnalysis.presentationAnalysis ??
    buildPresentationAnalysis(frontendRecords, dateRanges, pivotPresentationAnalysis.freshness, {
      effectivePeopleCount: countFrontendPeople(personResult.records),
      presentationScope: hasPresentationScope ? presentationScope : undefined,
    })
  if (!pivotPresentationAnalysis.presentationAnalysis) {
    issues.push(...pivotPresentationAnalysis.issues)
  }
  issues.push(...presentationAnalysis.issues)

  // ── 13. 資料品質摘要 ─────────────────────────────────────────
  const invalidDateRows    = workRecordResult.issues.filter((i) => i.code === 'INVALID_DATE').length
  const invalidHourRows    = workRecordResult.issues.filter((i) => i.code === 'INVALID_NUMBER').length
  const unmatchedPeopleRows = workRecordResult.issues.filter(
    (i) => i.code === 'EMPLOYEE_NAME_NOT_FOUND'
  ).length
  const unmatchedProjectRows = 0  // 共用模組歸 other 為正常情形，不計入
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
    presentationAnalysis,
    presentationScope: hasPresentationScope ? presentationScope : undefined,
    projectCostHoursByItemNo,
    projectCostCumulativeHoursByItemNo,
    dataQuality: {
      invalidDateRows,
      invalidHourRows,
      unmatchedPeopleRows,
      unmatchedProjectRows,
      unmatchedMaintenanceRows,
      unclassifiedRows,
      unclassifiedHours,
      projectMappingAvailable: hasMappingTable,
      projectMappingBlocked,
      unmappedProjectHours,
      unmappedProjectRecords,
    },
    issues,
    metadata: {
      calculatedAt: new Date().toISOString(),
      sourceRowCounts,
    },
  }
}
