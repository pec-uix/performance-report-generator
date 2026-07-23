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

  dataQuality: {
    invalidDateRows: number
    invalidHourRows: number
    unmatchedPeopleRows: number
    unmatchedProjectRows: number
    unmatchedMaintenanceRows: number
    unclassifiedRows: number
    unclassifiedHours: number
  }

  issues: ValidationIssue[]

  metadata: {
    /** ISO 8601，分析產生時間 */
    calculatedAt: string
    /** 每張工作表的原始列數（不含標題列） */
    sourceRowCounts: Record<string, number>
  }
}
