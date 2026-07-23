/**
 * ppt.ts
 * Phase 4 PPT 簡報資料型別。
 * 純資料型別，不依賴任何 DOM、ECharts 或 PptxGenJS。
 */

/** 封面頁資料 */
export interface PptCoverData {
  /** 季度標籤，例如「2026 S2」 */
  quarterLabel: string
  /** 單季期間，例如「2026-04-01 ～ 2026-07-31」 */
  quarterPeriod: string
  /** 累計期間，例如「2025-12-01 ～ 2026-07-31」 */
  cumulativePeriod: string
  /** 格式化製表時間，例如「2026-07-22 10:30」 */
  calculatedAt: string
}

/** 工時摘要頁資料（累計與單季共用） */
export interface PptWorkHoursSlideData {
  /** 期間說明文字 */
  periodLabel: string
  totalHours: number
  projectHours: number
  maintenanceHours: number
  otherHours: number
  /** totalHours > 0 時為比率；否則 0 */
  projectRatio: number
  maintenanceRatio: number
  otherRatio: number
  activePeopleCount: number
  /** activePeopleCount > 0 時有值；否則 null */
  averageHoursPerPerson: number | null
  /** null = totalHours === 0，不建立圓餅圖 */
  chartBase64: string | null
}

/** 第 4 頁排行一列資料 */
export interface PptRankingRowData {
  rank: number
  mainItemNo: string
  projectName: string
  quarterHours: number
  cumulativeHours: number
}

/** 第 4 頁排行頁資料 */
export interface PptRankingSlideData {
  /** 單季期間說明文字 */
  periodLabel: string
  /** Top 5（依 quarterHours 由高到低，僅主專案群組） */
  top5: PptRankingRowData[]
}

/** 第 5 頁專案群組一列資料 */
export interface PptProjectGroupRowData {
  mainItemNo: string
  projectName: string
  cumulativeHours: number
  quarterHours: number
  childCount: number
  revenue: number | null
}

/** 第 5 頁群組明細頁資料 */
export interface PptDetailSlideData {
  /** 全部主專案群組數量（含未顯示） */
  totalGroups: number
  /** 實際顯示數量（最多 10） */
  displayCount: number
  /** 顯示的群組（依原始項次順序） */
  groups: PptProjectGroupRowData[]
  /** 是否有超過 10 個群組未顯示 */
  hasMore: boolean
  /** 未顯示的群組數量 */
  remainingCount: number
}

/** 完整 PPT 簡報資料（傳入 assemblePptBlob 的純資料） */
export interface PptSlideData {
  slide1Cover: PptCoverData
  slide2Cumulative: PptWorkHoursSlideData
  slide3Quarter: PptWorkHoursSlideData
  slide4Ranking: PptRankingSlideData
  slide5Detail: PptDetailSlideData
}

// ── Phase 5 型別 ─────────────────────────────────────────────────────────

import type { ReportAnalysisResult } from './reportAnalysis'
import type { ProjectContentResult } from './project'
import type { ModuleWorkHoursChartResult } from './presentationAnalysis'
import type { HourlyRateSettings } from './projectCost'
import type { ExecutivePaginationAudit } from '@/services/executiveProjectPaginationService'

/**
 * 圖片資料庫：lowercase basename → Uint8Array
 * 在 Phase 5 使用 buildImageRepository 建立。
 */
export type ImageRepository = ReadonlyMap<string, Uint8Array>

export interface PresentationChartImage {
  chart: ModuleWorkHoursChartResult
  imageBase64: string | null
}

export interface PresentationChartImages {
  moduleWorkHours: PresentationChartImage[]
  moduleWorkforce: string | null
  monthlyWorkType: string | null
}

/** Phase 5 完整版簡報輸入 */
export interface PresentationInput {
  analysis: ReportAnalysisResult
  projectContent: ProjectContentResult
  images: ImageRepository
  presentationCharts?: PresentationChartImages
  hourlyRateSettings?: HourlyRateSettings
}

/** Phase 5 非阻擋性警告 */
export interface Phase5Warning {
  code: string
  message: string
  itemNo?: string
  filename?: string
  mainItemNo?: string
  sourceItemNo?: string
  fieldName?: string
  category?: string
  reason?: string
}

/** Phase 5 產生進度步驟 */
export type Phase5ProgressStep =
  | 'preparing-content'
  | 'processing-images'
  | 'building-summary-slides'
  | 'building-project-slides'
  | 'assembling-pptx'
  | 'preparing-download'

/** 完整版 PPT 產生結果 */
export interface FullPresentationResult {
  blob: Blob
  totalSlides: number
  projectGroupCount: number
  imageCount: number
  warnings: Phase5Warning[]
  paginationAudit?: ExecutivePaginationAudit
  projectPageCounts?: Record<string, number>
  /** ISO 8601 產生時間 */
  generatedAt: string
}
