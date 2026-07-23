/**
 * analysis.ts
 * Phase 3 資料標準化後的 DTO 型別定義。
 */

/** 工時工作分類 */
export type WorkCategory = 'project' | 'maintenance' | 'other'

/** 標準化工時記錄 */
export interface NormalizedWorkRecord {
  /** 原始 Excel 列號（1-indexed，供顯示用） */
  sourceRow: number
  /** YYYY-MM-DD */
  workDate: string
  /** 優先使用員工編號；若無則使用姓名 */
  employeeKey: string
  employeeName?: string
  workCategory: WorkCategory
  projectKey?: string
  projectName?: string
  maintenanceKey?: string
  maintenanceName?: string
  hours: number
}

/** 標準化人員記錄 */
export interface PersonRecord {
  employeeKey: string
  employeeName?: string
  department?: string
  /** 是否在職 */
  active?: boolean
  /** 月標準容量工時；若欄位不存在或未設定則為 null */
  monthlyCapacityHours?: number | null
  /** 每小時成本；若欄位不存在或未設定則為 null */
  hourlyCost?: number | null
}

/** 標準化專案主檔記錄 */
export interface ProjectMasterRecord {
  /** 用於與工時記錄關聯的鍵值（優先使用代碼，其次使用名稱） */
  projectKey: string
  projectName?: string
  /** 對應到 Phase 2 ProjectItem 的項次 */
  itemNo?: string
}

/** 標準化維運主檔記錄 */
export interface MaintenanceMasterRecord {
  /** 用於與工時記錄關聯的鍵值 */
  maintenanceKey: string
  maintenanceName?: string
}

/** 標準化收入記錄 */
export interface RevenueRecord {
  projectKey?: string
  itemNo?: string
  /** null = 欄位存在但無法解析 */
  revenueAmount: number | null
  /** 例如：年度收入、季度收入 */
  revenueType?: string
  periodType?: string
}

/** Mapper 統一輸出格式 */
export interface MappingResult<T> {
  records: T[]
  issues: import('./validation').ValidationIssue[]
  skippedRows: number
}

/** 個人工時摘要（用於 WorkforceSummary） */
export interface PersonWorkSummary {
  employeeKey: string
  employeeName?: string
  totalHours: number
  projectHours: number
  maintenanceHours: number
  otherHours: number
  categories: WorkCategory[]
}

/** 工時分類統計 */
export interface WorkHoursSummary {
  totalHours: number
  projectHours: number
  maintenanceHours: number
  otherHours: number
  /** totalHours > 0 時 = projectHours / totalHours；否則 0 */
  projectRatio: number
  /** totalHours > 0 時 = maintenanceHours / totalHours；否則 0 */
  maintenanceRatio: number
  /** totalHours > 0 時 = otherHours / totalHours；否則 0 */
  otherRatio: number
  recordCount: number
}

/** 人力統計 */
export interface WorkforceSummary {
  /** 該區間內 hours > 0 的不重複員工數 */
  activePeopleCount: number
  totalHours: number
  /** activePeopleCount > 0 時有值；否則 null */
  averageHoursPerPerson: number | null
  projectPeopleCount: number
  maintenancePeopleCount: number
  otherPeopleCount: number
  /** 注意：各分類人數不可直接相加；activePeopleCount 才是去重總數 */
  people: PersonWorkSummary[]
  /**
   * 人月計算結果；
   * 若無 monthlyCapacityHours 欄位設定，status = 'not-configured'
   */
  personMonthsStatus: 'not-configured' | 'insufficient-data' | 'calculated'
  personMonths: number | null
}

/** 專案分析（單一項次） */
export interface ProjectAnalysis {
  itemNo: string
  itemType: 'main' | 'child'
  projectKey?: string
  projectName?: string
  cumulativeHours: number
  quarterHours: number
  cumulativePeopleCount: number
  quarterPeopleCount: number
  /** null = 收入口徑未設定或無法計算 */
  revenue: number | null
}

/** 主項次群組分析 */
export interface ProjectGroupAnalysis {
  mainItemNo: string
  mainProject: ProjectAnalysis
  children: ProjectAnalysis[]
  /** 群組工時 = 主項本身 + 所有子項（不重複加總） */
  cumulativeHours: number
  quarterHours: number
  /** 群組內不重複員工數 */
  cumulativePeopleCount: number
  quarterPeopleCount: number
  revenue: number | null
}

/** 收入摘要 */
export interface RevenueSummary {
  /** 收入欄位是否已明確設定 */
  configured: boolean
  cumulativeRevenue: number | null
  quarterRevenue: number | null
  /** 只有成本口徑明確時才計算 */
  revenuePerHour: number | null
  inputOutputRatio: number | null
  issues: import('./validation').ValidationIssue[]
}

/** 日期範圍（含首尾） */
export interface DateRange {
  start: string
  end: string
}

/** 季度累計與單季日期範圍 */
export interface QuarterDateRanges {
  cumulative: DateRange
  quarter: DateRange
}
