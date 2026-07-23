/**
 * slidePaginationService.spec.ts
 * 驗證投影片分頁服務：所有主專案都有投影片、圖片正確分頁等。
 */

import { describe, it, expect } from 'vitest'
import { buildProjectSlideContents } from '@/services/slidePaginationService'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ProjectContentResult, ProjectItem } from '@/types/project'

// ── 測試資料工廠 ──────────────────────────────────────────────────────────

function makeAnalysis(projectCount: number): ReportAnalysisResult {
  const groups = Array.from({ length: projectCount }, (_, i) => ({
    mainItemNo: `${i + 1}.0`,
    mainProject: {
      itemNo: `${i + 1}.0`,
      itemType: 'main' as const,
      projectKey: `proj-${i + 1}`,
      projectName: `測試專案 ${i + 1}`,
      cumulativeHours: 100 + i * 10,
      quarterHours: 50 + i * 5,
      cumulativePeopleCount: 3,
      quarterPeopleCount: 2,
      revenue: null,
    },
    children: [],
    cumulativeHours: 100 + i * 10,
    quarterHours: 50 + i * 5,
    cumulativePeopleCount: 3,
    quarterPeopleCount: 2,
    revenue: null,
  }))

  return {
    quarter: 'S2',
    dateRanges: {
      cumulative: { start: '2025-12-01', end: '2026-07-31' },
      quarter: { start: '2026-04-01', end: '2026-07-31' },
    },
    cumulative: {
      workHours: { totalHours: 500, projectHours: 300, maintenanceHours: 150, otherHours: 50, projectRatio: 0.6, maintenanceRatio: 0.3, otherRatio: 0.1, recordCount: 50 },
      workforce: { activePeopleCount: 5, totalHours: 500, averageHoursPerPerson: 100, projectPeopleCount: 4, maintenancePeopleCount: 3, otherPeopleCount: 1, people: [], personMonthsStatus: 'not-configured', personMonths: null },
    },
    quarterSummary: {
      workHours: { totalHours: 200, projectHours: 120, maintenanceHours: 60, otherHours: 20, projectRatio: 0.6, maintenanceRatio: 0.3, otherRatio: 0.1, recordCount: 20 },
      workforce: { activePeopleCount: 4, totalHours: 200, averageHoursPerPerson: 50, projectPeopleCount: 3, maintenancePeopleCount: 2, otherPeopleCount: 1, people: [], personMonthsStatus: 'not-configured', personMonths: null },
    },
    projectGroups: groups,
    cumulativeProjectRanking: [...groups].reverse(),
    quarterProjectRanking: [...groups].reverse(),
    revenue: { configured: false, cumulativeRevenue: null, quarterRevenue: null, revenuePerHour: null, inputOutputRatio: null, issues: [] },
    dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0 },
    issues: [],
    metadata: { calculatedAt: '2026-07-23T10:00:00.000Z', sourceRowCounts: {} },
  }
}

function makeProjectContent(
  items: Partial<ProjectItem>[] = []
): ProjectContentResult {
  const fullItems: ProjectItem[] = items.map((partial, i) => ({
    rowIndex: i,
    rawItemNo: `${i + 1}.0`,
    normalizedItemNo: `${i + 1}.0`,
    itemType: 'main' as const,
    data: {},
    imageRefs: [],
    ...partial,
  }))

  return {
    sheetFound: true,
    alternativeSheetFound: false,
    totalRows: fullItems.length,
    mainCount: fullItems.length,
    childCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    orphanChildCount: 0,
    items: fullItems,
    detectedHeaders: [],
    issues: [],
  }
}

// ── 測試 ───────────────────────────────────────────────────────────────────

describe('slidePaginationService', () => {
  describe('buildProjectSlideContents', () => {
    it('0 個專案回傳空陣列', () => {
      const result = buildProjectSlideContents(makeAnalysis(0), makeProjectContent())
      expect(result.slides).toHaveLength(0)
      expect(result.totalProjectGroups).toBe(0)
    })

    it('1 個專案產生 1 頁（無圖片）', () => {
      const result = buildProjectSlideContents(makeAnalysis(1), makeProjectContent([{}]))
      expect(result.slides).toHaveLength(1)
    })

    it('N 個專案各有至少 1 頁（所有主專案都有投影片）', () => {
      const n = 5
      const result = buildProjectSlideContents(makeAnalysis(n), makeProjectContent(
        Array(n).fill({})
      ))
      expect(result.totalProjectSlides).toBeGreaterThanOrEqual(n)
      // 每個 groupIndex 都出現
      const groupIndexes = new Set(result.slides.map((s) => s.groupIndex))
      expect(groupIndexes.size).toBe(n)
    })

    it('找不到 ProjectItem 時仍產生投影片並加入警告', () => {
      const result = buildProjectSlideContents(makeAnalysis(2), makeProjectContent([]))
      expect(result.slides).toHaveLength(2) // 每個專案仍有一頁
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('不遺漏任何主專案（即使無內容資料）', () => {
      const n = 3
      const result = buildProjectSlideContents(makeAnalysis(n), makeProjectContent([]))
      const groupIndexes = new Set(result.slides.map((s) => s.groupIndex))
      expect(groupIndexes.size).toBe(n)
    })

    it('4 張圖片（= PRES_IMAGE_PER_PAGE）只需 1 頁圖片', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{ column: '圖片展示_成果', filenames: ['a.png', 'b.png', 'c.png', 'd.png'] }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const imageSlides = result.slides.filter((s) => s.type === 'images')
      expect(imageSlides).toHaveLength(1)
    })

    it('5 張圖片需 2 頁圖片（自動分頁）', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{
          column: '圖片展示_成果',
          filenames: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'],
        }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const imageSlides = result.slides.filter((s) => s.type === 'images')
      expect(imageSlides).toHaveLength(2)
    })

    it('專案有多個圖片分類時各自獨立分頁（不混合來源）', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [
          { column: '圖片展示_完成', filenames: ['a.png', 'b.png'] },
          { column: '圖片展示_計畫', filenames: ['c.png', 'd.png', 'e.png'] },
        ],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const imageSlides = result.slides.filter((s) => s.type === 'images')
      // 分類1: 2 張 → 1頁；分類2: 3 張 → 1頁（3 < 4）
      expect(imageSlides).toHaveLength(2)
      const categories = imageSlides.map((s) => (s.type === 'images' ? s.category : null))
      expect(categories).toContain('圖片展示_完成')
      expect(categories).toContain('圖片展示_計畫')
    })

    it('頁面標籤包含 projectPageIndex / projectTotalPages', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{ column: '圖片展示_成果', filenames: ['a.png', 'b.png'] }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlide = result.slides.find((s) => s.type === 'text')
      expect(textSlide?.projectPageIndex).toBe(1)
      expect(textSlide?.projectTotalPages).toBeGreaterThan(1) // text + image
    })

    it('totalImagesReferenced 計算正確', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{ column: '圖片展示', filenames: ['a.png', 'b.png', 'c.png'] }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      expect(result.totalImagesReferenced).toBe(3)
    })

    it('isEmpty = true 當無文字也無圖片', () => {
      const content = makeProjectContent([{ normalizedItemNo: '1.0', data: {}, imageRefs: [] }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlide = result.slides.find((s) => s.type === 'text')
      expect(textSlide?.type === 'text' && textSlide.isEmpty).toBe(true)
    })

    it('圖片欄位不出現在 textBlocks', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        data: { '圖片展示_成果': '圖片1.png', '工作內容': '已完成系統建置' },
        imageRefs: [],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlide = result.slides.find((s) => s.type === 'text')
      if (textSlide?.type !== 'text') return
      const labels = textSlide.textBlocks.map((b) => b.label)
      expect(labels).not.toContain('圖片展示_成果')
      expect(labels).toContain('工作內容')
    })

    it('專案過多時自動分頁（10 個主專案）', () => {
      const n = 10
      const result = buildProjectSlideContents(
        makeAnalysis(n),
        makeProjectContent(Array(n).fill({}))
      )
      expect(result.totalProjectSlides).toBeGreaterThanOrEqual(n)
    })
  })
})
