import type { DateRange, WorkCategory } from './analysis'
import type { ValidationIssue } from './validation'

export interface ModuleWorkHoursDistribution {
  moduleKey: string
  displayName: string
  hours: number
  ratio: number
  category: WorkCategory
  categoryConflict?: boolean
}

export interface ModuleWorkHoursChartResult {
  periodType: 'cumulative' | 'quarter'
  startDate: string
  endDate: string
  totalHours: number
  items: ModuleWorkHoursDistribution[]
}

export interface ModuleWorkforceResult {
  moduleKey: string
  displayName: string
  workforce: number | null
  calculationStatus: 'confirmed' | 'not-configured'
}

export type WorkTypeRatioBasis =
  | 'all-work-hours'
  | 'project-and-maintenance-only'
  | 'unconfirmed'

export interface MonthlyWorkTypeResult {
  month: string
  projectHours: number
  maintenanceHours: number
  otherHours: number
  totalHours: number
  projectRatio: number | null
  maintenanceRatio: number | null
  otherRatio: number | null
  ratioBasis: WorkTypeRatioBasis
  projectWorkforce: number | null
  maintenanceWorkforce: number | null
  workforceStatus: 'confirmed' | 'not-configured'
  effectiveWorkforce?: number | null
}

export interface PivotAnalysisSourceStatus {
  workHours: 'pivot' | 'detail-fallback'
  workforce: 'pivot' | 'detail-fallback'
  projectMaintenance: 'pivot' | 'detail-fallback'
  organization: string
}

export interface PivotFreshnessResult {
  status: 'valid' | 'stale' | 'invalid' | 'missing'
  selectedSemester: 'S1' | 'S2' | 'S3'
  expectedStartDate: string
  expectedEndDate: string
  pivotStartDate?: string
  pivotEndDate?: string
  pivotTotalHours?: number
  detailTotalHours: number
  difference?: number
  reasons: string[]
}

export interface PresentationAnalysisResult {
  /** 部門整體口徑：本期摘要與專案／維運趨勢使用。 */
  moduleWorkHoursCharts: ModuleWorkHoursChartResult[]
  /** 完整版 PPT 第一、第二張工時圖口徑：白名單專案 + 指定共用工時。 */
  presentationWorkHoursCharts?: ModuleWorkHoursChartResult[]
  moduleWorkforce: ModuleWorkforceResult[]
  monthlyWorkTypes: MonthlyWorkTypeResult[]
  workforceConfigured: boolean
  monthlyRatioBasis: WorkTypeRatioBasis
  monthlyPeriod: DateRange
  sourceStatus?: PivotAnalysisSourceStatus
  pivotFreshness?: PivotFreshnessResult
  /** 簡報白名單專案口徑：白名單專案工時圖、人力圖、成果頁占比與排行使用。 */
  presentationScopeAnalysis?: {
    moduleWorkHoursCharts: ModuleWorkHoursChartResult[]
    moduleWorkforce: ModuleWorkforceResult[]
    cumulativeTotalHours: number
    quarterTotalHours: number
  }
  issues: ValidationIssue[]
}
