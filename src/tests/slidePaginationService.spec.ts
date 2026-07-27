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
    presentationAnalysis: {
      moduleWorkHoursCharts: [],
      moduleWorkforce: [],
      monthlyWorkTypes: [],
      workforceConfigured: false,
      monthlyRatioBasis: 'unconfirmed',
      monthlyPeriod: { start: '2025-12-01', end: '2026-07-31' },
      issues: [],
    },
    frontendPeopleCount: 5,
    dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0, projectMappingAvailable: false, projectMappingBlocked: false, unmappedProjectHours: 0, unmappedProjectRecords: 0 },
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
        imageRefs: [{ column: '已完成工作事項_圖片展示', filenames: ['a.png', 'b.png', 'c.png', 'd.png'] }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const imageSlides = result.slides.filter((s) => s.type === 'images')
      expect(imageSlides).toHaveLength(1)
    })

    it('5 張圖片需 2 頁圖片（自動分頁）', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{
          column: '已完成工作事項_圖片展示',
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
          { column: '已完成工作事項_圖片展示', filenames: ['a.png', 'b.png'] },
          { column: '預計完成工作_圖片展示', filenames: ['c.png', 'd.png', 'e.png'] },
        ],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const imageSlides = result.slides.filter((s) => s.type === 'images')
      // 分類1: 2 張 → 1頁；分類2: 3 張 → 1頁（3 < 4）
      expect(imageSlides).toHaveLength(2)
      const categories = imageSlides.map((s) => (s.type === 'images' ? s.category : null))
      expect(categories).toContain('已完成工作事項')
      expect(categories).toContain('預計完成工作')
    })

    it('頁面標籤包含 projectPageIndex / projectTotalPages', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{ column: '已完成工作事項_圖片展示', filenames: ['a.png', 'b.png'] }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const summarySlide = result.slides.find((s) => s.type === 'summary')
      expect(summarySlide?.projectPageIndex).toBe(1)
      expect(summarySlide?.projectTotalPages).toBeGreaterThan(1) // summary + image
    })

    it('totalImagesReferenced 計算正確', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        imageRefs: [{ column: '已完成工作事項_圖片展示', filenames: ['a.png', 'b.png', 'c.png'] }],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      expect(result.totalImagesReferenced).toBe(3)
    })

    it('無文字也無圖片時只建立摘要頁', () => {
      const content = makeProjectContent([{ normalizedItemNo: '1.0', data: {}, imageRefs: [] }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      expect(result.slides).toHaveLength(1)
      expect(result.slides[0]?.type).toBe('summary')
    })

    it('只有 exact alias 文字欄位會出現在 textBlocks', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        data: { '已完成工作事項_圖片展示': '圖片1.png', '已完成工作事項_描述': '已完成系統建置', '工作內容': '不輸出' },
        imageRefs: [],
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlide = result.slides.find((s) => s.type === 'text')
      if (textSlide?.type !== 'text') return
      const labels = textSlide.textBlocks.map((b) => b.label)
      expect(labels).toContain('已完成工作事項')
      expect(labels).not.toContain('工作內容')
      expect(result.warnings.some((w) => w.code === 'PROJECT_CONTENT_UNKNOWN_FIELD')).toBe(true)
    })

    it('四大區塊文字依 exact alias 建立，並在合併頁保留區塊標題', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        data: {
          '已完成工作事項_描述': '完成 A',
          '預計完成工作_描述': '預計 B',
          'UIX執行成果_文字/連結描述': 'UIX C',
          '執行成果_文字/連結描述': '成果 D',
        },
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlides = result.slides
        .filter((s) => s.type === 'text')
      expect(textSlides).toHaveLength(1)
      const labels = textSlides.flatMap((s) => (s.type === 'text' ? s.textBlocks.map((b) => b.label) : []))
      expect(labels).toEqual(['已完成工作事項', '預計完成工作', 'UIX執行成果', '執行成果'])
    })

    it('空白欄位不建立成果文字頁，其他區塊不受影響', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        data: {
          '已完成工作事項_描述': '   \n  ',
          '預計完成工作_描述': '有效內容',
        },
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlides = result.slides.filter((s) => s.type === 'text')
      expect(textSlides).toHaveLength(1)
      expect(textSlides[0]?.type === 'text' && textSlides[0].textBlocks[0]?.label).toBe('預計完成工作')
    })

    it('子項內容併入主專案且依自然項次排序', () => {
      const content = makeProjectContent([
        { normalizedItemNo: '1.0', rawItemNo: '1', itemType: 'main', data: { '已完成工作事項_描述': '主項' } },
        { normalizedItemNo: '1-2', rawItemNo: '1-2', itemType: 'child', parentItemNo: '1.0', data: { '已完成工作事項_描述': '子項二' } },
        { normalizedItemNo: '1-1', rawItemNo: '1-1', itemType: 'child', parentItemNo: '1.0', data: { '已完成工作事項_描述': '子項一' } },
        { normalizedItemNo: '2-1', rawItemNo: '2-1', itemType: 'child', parentItemNo: '2.0', data: { '已完成工作事項_描述': '不應併入' } },
      ])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textBlocks = result.slides
        .filter((s) => s.type === 'text')
        .flatMap((s) => (s.type === 'text' ? s.textBlocks : []))
      expect(textBlocks.map((b) => b.text)).toEqual(['主項', '子項一', '子項二'])
      expect(result.warnings.some((w) => w.code === 'PROJECT_CHILD_CONTENT_MERGED')).toBe(true)
    })

    it('子項 UIX 與執行成果圖片併入主專案且不同主專案不交叉', () => {
      const analysis = makeAnalysis(2)
      const content = makeProjectContent([
        { normalizedItemNo: '1.0', rawItemNo: '1', itemType: 'main' },
        {
          normalizedItemNo: '1-1',
          rawItemNo: '1-1',
          itemType: 'child',
          parentItemNo: '1.0',
          imageRefs: [{ column: 'UIX執行成果_圖片展示', filenames: ['uix-1.png'] }],
        },
        {
          normalizedItemNo: '1-2',
          rawItemNo: '1-2',
          itemType: 'child',
          parentItemNo: '1.0',
          imageRefs: [{ column: '執行成果_圖片展示', filenames: ['exec-1.png'] }],
        },
        {
          normalizedItemNo: '2-1',
          rawItemNo: '2-1',
          itemType: 'child',
          parentItemNo: '2.0',
          imageRefs: [{ column: '執行成果_圖片展示', filenames: ['exec-2.png'] }],
        },
      ])
      const result = buildProjectSlideContents(analysis, content)
      const group1Images = result.slides
        .filter((s) => s.type === 'images' && s.mainItemNo === '1.0')
        .flatMap((s) => (s.type === 'images' ? s.filenames : []))
      const group2Images = result.slides
        .filter((s) => s.type === 'images' && s.mainItemNo === '2.0')
        .flatMap((s) => (s.type === 'images' ? s.filenames : []))

      expect(group1Images).toEqual(['uix-1.png', 'exec-1.png'])
      expect(group2Images).toEqual(['exec-2.png'])
    })

    it('長文字不截斷並建立續頁', () => {
      const longText = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 行內容`).join('\n')
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        data: { '已完成工作事項_描述': longText },
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlides = result.slides.filter((s) => s.type === 'text')
      expect(textSlides.length).toBeGreaterThan(1)
      const combined = textSlides
        .flatMap((s) => (s.type === 'text' ? s.textBlocks : []))
        .map((b) => b.text)
        .join('\n')
      expect(combined).toContain('第 1 行內容')
      expect(combined).toContain('第 40 行內容')
      expect(textSlides.some((s) => s.type === 'text' && s.isContinuation)).toBe(true)
    })

    it('重複 exact alias 欄位依順序合併並產生 warning', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        data: {
          '已完成工作事項_描述': '第一欄',
          '已完成工作事項_描述_2': '第二欄',
        },
      }])
      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textBlocks = result.slides
        .filter((s) => s.type === 'text')
        .flatMap((s) => (s.type === 'text' ? s.textBlocks : []))
      expect(textBlocks.map((b) => b.text)).toEqual(['第一欄', '第二欄'])
      expect(result.warnings.some((w) => w.code === 'PROJECT_CONTENT_DUPLICATE_FIELD')).toBe(true)
    })

    it('legacyGenericSection 保留原始段落標題與內容，不歸入四大成果區', () => {
      const content = makeProjectContent([{
        normalizedItemNo: '1.0',
        sourceType: 'project',
        stableItemId: '20220506',
        moduleKey: '20220506(團購網&UNI團購網系統優化)',
        legacySectionTitle: '專案工時分析',
        data: {
          專案名稱: '團購網&UNI團購網系統優化',
          legacyGenericSection_段落標題: '專案工時分析',
          legacyGenericSection_內容: '第一行\n第二行',
        },
      }])

      const result = buildProjectSlideContents(makeAnalysis(1), content)
      const textSlide = result.slides.find((s) => s.type === 'text')
      expect(textSlide?.type === 'text' && textSlide.sectionType).toBe('legacyGeneric')
      expect(textSlide?.type === 'text' && textSlide.sectionTitle).toBe('專案工時分析')
      expect(textSlide?.type === 'text' && textSlide.textBlocks[0]?.text).toBe('第一行\n第二行')
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
