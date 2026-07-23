/**
 * reportAnalysis.ts
 * Phase 3 最終分析結果型別。
 */

import type { QuarterKey } from './report'
import type {
  WorkHoursSummary,
  WorkforceSummary,
  ProjectGroupAnalysis,
  RevenueSummary,
  QuarterDateRanges,
} from './analysis'
import type { ValidationIssue } from './validation'
import type { PresentationAnalysisResult } from './presentationAnalysis'
import type { PresentationScope } from './presentationScope'
import type { ProjectOrganizationHours } from './projectCost'

/** Phase 3 完整報告分析結果 */
export interface ReportAnalysisResult {
  quarter: QuarterKey
  dateRanges: QuarterDateRanges

  /** 累計（2025-12-01 起）工時與人力 */
  cumulative: {
    workHours: WorkHoursSummary
    workforce: WorkforceSummary
  }

  /** 單季工時與人力 */
  quarterSummary: {
    workHours: WorkHoursSummary
    workforce: WorkforceSummary
  }

  /** 主項次群組（含子項明細），依原始項次順序 */
  projectGroups: ProjectGroupAnalysis[]

  /** 累計工時排行（由高到低） */
  cumulativeProjectRanking: ProjectGroupAnalysis[]

  /** 單季工時排行（由高到低） */
  quarterProjectRanking: ProjectGroupAnalysis[]

  revenue: RevenueSummary

  /** Phase 6A Presentation 專用衍生圖表資料，不改變既有核心計算口徑 */
  presentationAnalysis: PresentationAnalysisResult

  /** Phase 6A-5 PPT 成果頁白名單；整體分析仍使用完整工時資料 */
  presentationScope?: PresentationScope

  /** Phase 6E 成本計算用：白名單主項三組織當季工時，不改成果頁主工時口徑 */
  projectCostHoursByItemNo?: Record<string, ProjectOrganizationHours>

  dataQuality: {
    invalidDateRows: number
    invalidHourRows: number
    unmatchedPeopleRows: number
    unmatchedProjectRows: number
    unmatchedMaintenanceRows: number
    unclassifiedRows: number
    unclassifiedHours: number
    /** 専案對應表是否存在且欄位完整 */
    projectMappingAvailable: boolean
    /** 阻擋旗標：有専案工時但對應後全為 0 */
    projectMappingBlocked: boolean
    /** 未對應至任何項次的累計専案工時 */
    unmappedProjectHours: number
    /** 未對應至任何項次的累計専案工時記錄筆數 */
    unmappedProjectRecords: number
  }

  issues: ValidationIssue[]

  metadata: {
    /** ISO 8601，分析產生時間 */
    calculatedAt: string
    /** 每張工作表的原始列數（不含標題列） */
    sourceRowCounts: Record<string, number>
  }
}
