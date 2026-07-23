/**
 * slidePaginationService.ts
 * Phase 5 投影片分頁服務。
 *
 * 依專案數量、文字長度、圖片數量自動計算投影片數與內容分佈。
 * 純函式，不操作 DOM，不呼叫網路，不寫 console。
 */

import type { ProjectGroupAnalysis } from '@/types/analysis'
import type { ProjectContentResult, ProjectItem, ImageRef } from '@/types/project'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { Phase5Warning } from '@/types/ppt'
import { sanitizeText } from './textPaginationService'
import { PRES_IMAGE_PER_PAGE } from '@/config/presentationTheme'

// ── 輸出型別 ──────────────────────────────────────────────────────────────

export interface TextBlock {
  /** 欄位標籤（由 Excel 標頭決定） */
  label: string
  /** 清理後的文字內容 */
  text: string
}

export interface ImageGroup {
  /** 圖片欄位分類名稱（由 Excel 標頭決定） */
  category: string
  /** 原始檔名清單 */
  filenames: string[]
  /** lowercase basename 清單（用於 ImageRepository 查詢） */
  basenameKeys: string[]
}

export interface ProjectSummaryRow {
  mainItemNo: string
  projectName: string
  cumulativeHours: number
  quarterHours: number
  peopleCumulative: number
  peopleQuarter: number
  childCount: number
  revenue: number | null
}

/** 專案文字投影片 */
export interface ProjectTextSlide {
  type: 'text'
  groupIndex: number
  /** 此專案的第幾頁（1-based） */
  projectPageIndex: number
  /** 此專案共幾頁 */
  projectTotalPages: number
  mainItemNo: string
  projectName: string
  summary: ProjectSummaryRow
  textBlocks: TextBlock[]
  /** true = 沒有文字也沒有圖片 */
  isEmpty: boolean
}

/** 專案圖片投影片 */
export interface ProjectImageSlide {
  type: 'images'
  groupIndex: number
  projectPageIndex: number
  projectTotalPages: number
  mainItemNo: string
  projectName: string
  /** 圖片分類名稱（欄位群組） */
  category: string
  /** 此頁的原始檔名（最多 PRES_IMAGE_PER_PAGE） */
  filenames: string[]
  /** 此頁的 lowercase basename（最多 PRES_IMAGE_PER_PAGE） */
  basenameKeys: string[]
}

export type ProjectSlideContent = ProjectTextSlide | ProjectImageSlide

export interface PaginationResult {
  /** 所有主專案的投影片清單（依 projectGroups 順序） */
  slides: ProjectSlideContent[]
  totalProjectSlides: number
  totalProjectGroups: number
  /** 所有專案引用的圖片總數 */
  totalImagesReferenced: number
  warnings: Phase5Warning[]
}

// ── 輔助函式 ──────────────────────────────────────────────────────────────

function getBasenameKey(filename: string): string {
  const parts = filename.split(/[/\\]/)
  return (parts[parts.length - 1] ?? filename).toLowerCase()
}

function isImageField(key: string): boolean {
  return key.includes('圖片展示')
}

/** 從 ProjectItem.data 提取非圖片、非空的文字欄位 */
function extractTextBlocks(item: ProjectItem): TextBlock[] {
  const blocks: TextBlock[] = []
  for (const [key, rawVal] of Object.entries(item.data)) {
    if (isImageField(key)) continue
    const text = sanitizeText(String(rawVal ?? ''))
    if (!text) continue
    blocks.push({ label: key, text })
  }
  return blocks
}

/** 從 ProjectItem.imageRefs 建立圖片分組清單 */
function extractImageGroups(item: ProjectItem): ImageGroup[] {
  return item.imageRefs
    .filter((ref: ImageRef) => ref.filenames.length > 0)
    .map((ref: ImageRef) => ({
      category: ref.column,
      filenames: ref.filenames,
      basenameKeys: ref.filenames.map(getBasenameKey),
    }))
}

function buildSummaryRow(group: ProjectGroupAnalysis): ProjectSummaryRow {
  return {
    mainItemNo: group.mainItemNo,
    projectName: group.mainProject.projectName ?? '（未命名專案）',
    cumulativeHours: group.cumulativeHours,
    quarterHours: group.quarterHours,
    peopleCumulative: group.cumulativePeopleCount,
    peopleQuarter: group.quarterPeopleCount,
    childCount: group.children.length,
    revenue: group.revenue,
  }
}

// ── 主函式 ────────────────────────────────────────────────────────────────

/**
 * 建立所有主專案的投影片內容清單。
 *
 * 規則：
 * - 每個主專案至少產生一頁（文字頁）
 * - 圖片超過 PRES_IMAGE_PER_PAGE 張時自動分頁
 * - 不同圖片欄位分別顯示（category 標示來源）
 * - 找不到 ProjectItem 的專案仍顯示數據頁並產生警告
 * - 所有主專案都必須有投影片，不得省略
 *
 * @param analysis       Phase 3 分析結果（數字來源）
 * @param projectContent Phase 2 專案內容（文字/圖片來源）
 */
export function buildProjectSlideContents(
  analysis: ReportAnalysisResult,
  projectContent: ProjectContentResult
): PaginationResult {
  const slides: ProjectSlideContent[] = []
  const warnings: Phase5Warning[] = []
  let totalImages = 0

  analysis.projectGroups.forEach((group, groupIndex) => {
    // 找對應 ProjectItem（主項次）
    const item = projectContent.items.find(
      (i) => i.itemType === 'main' && i.normalizedItemNo === group.mainItemNo
    )

    if (!item) {
      warnings.push({
        code: 'P5_ITEM_NOT_FOUND',
        message: `找不到主專案 ${group.mainItemNo} 的內容資料，僅顯示數據摘要頁。`,
        itemNo: group.mainItemNo,
      })
    }

    const textBlocks = item ? extractTextBlocks(item) : []
    const imageGroups = item ? extractImageGroups(item) : []

    // 計算圖片頁數
    const imagePagesCount = imageGroups.reduce(
      (acc, ig) => acc + Math.ceil(ig.filenames.length / PRES_IMAGE_PER_PAGE),
      0
    )

    totalImages += imageGroups.reduce((acc, ig) => acc + ig.filenames.length, 0)

    const projectTotalPages = 1 + imagePagesCount
    const summary = buildSummaryRow(group)

    // 文字頁（每個專案一定有）
    slides.push({
      type: 'text',
      groupIndex,
      projectPageIndex: 1,
      projectTotalPages,
      mainItemNo: group.mainItemNo,
      projectName: summary.projectName,
      summary,
      textBlocks,
      isEmpty: textBlocks.length === 0 && imagePagesCount === 0,
    })

    // 圖片頁
    let pageOffset = 2
    for (const ig of imageGroups) {
      const totalPagesForGroup = Math.ceil(ig.filenames.length / PRES_IMAGE_PER_PAGE)
      for (let p = 0; p < totalPagesForGroup; p++) {
        const start = p * PRES_IMAGE_PER_PAGE
        const end = start + PRES_IMAGE_PER_PAGE
        slides.push({
          type: 'images',
          groupIndex,
          projectPageIndex: pageOffset,
          projectTotalPages,
          mainItemNo: group.mainItemNo,
          projectName: summary.projectName,
          category: ig.category,
          filenames: ig.filenames.slice(start, end),
          basenameKeys: ig.basenameKeys.slice(start, end),
        })
        pageOffset++
      }
    }
  })

  return {
    slides,
    totalProjectSlides: slides.length,
    totalProjectGroups: analysis.projectGroups.length,
    totalImagesReferenced: totalImages,
    warnings,
  }
}
