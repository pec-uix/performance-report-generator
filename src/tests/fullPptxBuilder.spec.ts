/**
 * fullPptxBuilder.spec.ts
 * 驗證 Phase 5 完整版 PPT 產生服務。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ProjectContentResult } from '@/types/project'
import type { Phase5ProgressStep } from '@/types/ppt'
import type { PresentationAnalysisResult } from '@/types/presentationAnalysis'
import { PPT_MIME_TYPE } from '@/services/pptxBuilder'

// ── PptxGenJS mock ─────────────────────────────────────────────────────────

const { MockPptxF, getMockInstance5 } = vi.hoisted(() => {
  const createSlide = () => ({
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  })

  const mockInstance = {
    addSlide: vi.fn(() => createSlide()),
    write: vi.fn(() => Promise.resolve(new ArrayBuffer(16))),
    layout: '',
    title: '',
    author: '',
  }

  const MockPptxF = vi.fn().mockImplementation(() => mockInstance)

  function getMockInstance5() { return mockInstance }

  return { MockPptxF, getMockInstance5 }
})

vi.mock('pptxgenjs', () => ({ default: MockPptxF }))

// ── ECharts mock（給 chartRenderer 使用）──────────────────────────────────

const { mockChartF, mockInitF } = vi.hoisted(() => {
  const mockChartF = {
    setOption: vi.fn(),
    getDataURL: vi.fn(() => 'data:image/png;base64,FULLTEST'),
    dispose: vi.fn(),
  }
  const mockInitF = vi.fn().mockReturnValue(mockChartF)
  return { mockChartF, mockInitF }
})

vi.mock('echarts', () => ({ init: mockInitF }))

// ── JSZip mock（給 imagePresentationService 使用）─────────────────────────

vi.mock('jszip', () => ({
  default: { loadAsync: vi.fn().mockResolvedValue({ files: {} }) },
}))

// ── 測試資料 ──────────────────────────────────────────────────────────────

import { buildTestPresentation, buildFullPresentation } from '@/services/fullPptxBuilder'

function makePresentationAnalysis(): PresentationAnalysisResult {
  return {
    moduleWorkHoursCharts: [
      {
        periodType: 'cumulative',
        startDate: '2025-12-01',
        endDate: '2026-07-31',
        totalHours: 100,
        items: [{ moduleKey: 'MOD-A', displayName: 'MOD-A', hours: 100, ratio: 1, category: 'project' }],
      },
      {
        periodType: 'quarter',
        startDate: '2026-04-01',
        endDate: '2026-07-31',
        totalHours: 50,
        items: [{ moduleKey: 'MOD-A', displayName: 'MOD-A', hours: 50, ratio: 1, category: 'project' }],
      },
    ],
    moduleWorkforce: [{ moduleKey: 'MOD-A', displayName: 'MOD-A', workforce: null, calculationStatus: 'not-configured' }],
    monthlyWorkTypes: [],
    workforceConfigured: false,
    monthlyRatioBasis: 'unconfirmed',
    monthlyPeriod: { start: '2025-12-01', end: '2026-07-31' },
    issues: [],
  }
}

function makeMinimalAnalysis(projectCount = 1): ReportAnalysisResult {
  const groups = Array.from({ length: projectCount }, (_, i) => ({
    mainItemNo: `${i + 1}.0`,
    mainProject: {
      itemNo: `${i + 1}.0`, itemType: 'main' as const, projectKey: `p${i}`,
      projectName: `專案 ${i + 1}`, cumulativeHours: 100, quarterHours: 50,
      cumulativePeopleCount: 3, quarterPeopleCount: 2, revenue: null,
    },
    children: [],
    cumulativeHours: 100 + i, quarterHours: 50 + i,
    cumulativePeopleCount: 3, quarterPeopleCount: 2, revenue: null,
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
    presentationAnalysis: makePresentationAnalysis(),
    dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0, projectMappingAvailable: false, projectMappingBlocked: false, unmappedProjectHours: 0, unmappedProjectRecords: 0 },
    issues: [],
    metadata: { calculatedAt: '2026-07-23T10:00:00.000Z', sourceRowCounts: {} },
  }
}

function makeEmptyProjectContent(): ProjectContentResult {
  return {
    sheetFound: false, alternativeSheetFound: false, totalRows: 0,
    mainCount: 0, childCount: 0, invalidCount: 0, duplicateCount: 0,
    orphanChildCount: 0, items: [], detectedHeaders: [], issues: [],
  }
}

function captureSlideText(): string[] {
  const slideText: string[] = []
  const inst = getMockInstance5()
  inst.addSlide.mockImplementation(() => {
    const slide = {
      addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
        if (typeof text === 'string') slideText.push(text)
        return slide
      }),
      addImage: vi.fn().mockReturnThis(),
      addTable: vi.fn().mockReturnThis(),
      background: undefined as unknown,
    }
    return slide
  })
  return slideText
}

function makeScopedAnalysisForStatus(
  quarterHours: number,
  costHours: { informationServiceHours: number; frontendDevelopmentHours: number; backendDevelopmentHours: number },
  matchStatus: 'exact' | 'unmatched' = 'exact'
): ReportAnalysisResult {
  const analysis = makeMinimalAnalysis()
  analysis.projectGroups[0].quarterHours = quarterHours
  analysis.projectGroups[0].mainProject.quarterHours = quarterHours
  analysis.projectCostHoursByItemNo = { '1.0': costHours }
  analysis.presentationScope = {
    items: [{
      itemNo: '1.0',
      itemType: 'main',
      stableItemId: 'P1',
      projectName: '專案 1',
      sourceType: matchStatus === 'unmatched' ? 'unresolved' : 'project',
      moduleKey: matchStatus === 'unmatched' ? undefined : 'MOD-A',
      masterAnnualRevenue: 100000,
      sourceRow: 2,
      content: {
        rowIndex: 0,
        rawItemNo: '1.0',
        normalizedItemNo: '1.0',
        itemType: 'main',
        data: {},
        imageRefs: [],
      },
      matchStatus,
    }],
    mainItems: [],
    childItems: [],
    orderedMainItemIds: ['1.0'],
    allowedStableItemIds: new Set(['P1']),
    issues: [],
  }
  analysis.presentationScope.mainItems = analysis.presentationScope.items
  return analysis
}

// ── beforeEach 重設 mock ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  const inst = getMockInstance5()
  const createSlide = () => ({
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  })
  inst.addSlide.mockImplementation(() => createSlide())
  inst.write.mockResolvedValue(new ArrayBuffer(16))
  MockPptxF.mockImplementation(() => inst)
  mockInitF.mockReturnValue(mockChartF)
  mockChartF.getDataURL.mockReturnValue('data:image/png;base64,FULLTEST')
})

// ── 測試 ───────────────────────────────────────────────────────────────────

describe('fullPptxBuilder', () => {
  describe('buildTestPresentation', () => {
    it('回傳 Blob', async () => {
      const result = await buildTestPresentation(makeMinimalAnalysis(), null, null)
      expect(result).toBeInstanceOf(Blob)
    })

    it('Blob MIME type 正確', async () => {
      const result = await buildTestPresentation(makeMinimalAnalysis(), null, null)
      expect(result.type).toBe(PPT_MIME_TYPE)
    })

    it('PptxGenJS.write 被呼叫', async () => {
      await buildTestPresentation(makeMinimalAnalysis(), null, null)
      expect(getMockInstance5().write).toHaveBeenCalled()
    })
  })

  describe('buildFullPresentation', () => {
    it('回傳 FullPresentationResult', async () => {
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result).toHaveProperty('blob')
      expect(result).toHaveProperty('totalSlides')
      expect(result).toHaveProperty('projectGroupCount')
      expect(result).toHaveProperty('imageCount')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('generatedAt')
    })

    it('blob MIME type 正確', async () => {
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result.blob.type).toBe(PPT_MIME_TYPE)
    })

    it('totalSlides >= 6（封面、四張核心分析、結尾）+ 專案數', async () => {
      const projectCount = 2
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(projectCount), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result.totalSlides).toBeGreaterThanOrEqual(6 + projectCount)
    })

    it('projectGroupCount 等於 analysis.projectGroups 數量', async () => {
      const n = 3
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(n), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result.projectGroupCount).toBe(n)
    })

    it('generatedAt 為合法 ISO 8601 字串', async () => {
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(() => new Date(result.generatedAt)).not.toThrow()
      expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt)
    })

    it('onProgress 依序被呼叫', async () => {
      const progressSteps: Phase5ProgressStep[] = []
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null,
        (step) => { progressSteps.push(step) }
      )
      expect(progressSteps).toContain('preparing-content')
      expect(progressSteps).toContain('processing-images')
      expect(progressSteps).toContain('building-summary-slides')
      expect(progressSteps).toContain('building-project-slides')
      expect(progressSteps).toContain('assembling-pptx')
      expect(progressSteps).toContain('preparing-download')
    })

    it('專案沒有名稱時不拋出錯誤', async () => {
      const analysis = makeMinimalAnalysis(1)
      analysis.projectGroups[0].mainProject.projectName = undefined
      await expect(
        buildFullPresentation(
          { analysis, projectContent: makeEmptyProjectContent(), images: new Map() },
          null, null
        )
      ).resolves.not.toThrow()
    })

    it('收入未設定時不拋出錯誤', async () => {
      const analysis = makeMinimalAnalysis(1)
      analysis.revenue.configured = false
      await expect(
        buildFullPresentation(
          { analysis, projectContent: makeEmptyProjectContent(), images: new Map() },
          null, null
        )
      ).resolves.not.toThrow()
    })

    it('找不到專案內容時產生警告而非拋出', async () => {
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(1), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('PptxGenJS.write 被呼叫', async () => {
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(getMockInstance5().write).toHaveBeenCalled()
    })

    it('多個主專案各自有投影片', async () => {
      const n = 3
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(n), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      // addSlide 被呼叫次數 >= 封面、四張核心分析、結尾 + 專案頁
      const addSlideCalls = getMockInstance5().addSlide.mock.calls.length
      expect(addSlideCalls).toBeGreaterThanOrEqual(6 + n)
    })

    it('S2 PPT 加入累計與當季兩張模組工時圖頁', async () => {
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      const addSlideCalls = getMockInstance5().addSlide.mock.calls.length
      expect(addSlideCalls).toBeGreaterThanOrEqual(7)
    })

    it('工時累計與當季圖使用 PPT 專用白名單加共用工時口徑', async () => {
      const slideText = captureSlideText()
      const analysis = makeMinimalAnalysis()
      analysis.presentationAnalysis.moduleWorkHoursCharts = [
        {
          periodType: 'cumulative',
          startDate: '2025-12-01',
          endDate: '2026-07-31',
          totalHours: 1000,
          items: [{ moduleKey: 'ALL', displayName: '完整工時', hours: 1000, ratio: 1, category: 'project' }],
        },
        {
          periodType: 'quarter',
          startDate: '2026-04-01',
          endDate: '2026-07-31',
          totalHours: 400,
          items: [{ moduleKey: 'ALL-Q', displayName: '完整當季', hours: 400, ratio: 1, category: 'project' }],
        },
      ]
      analysis.presentationAnalysis.presentationWorkHoursCharts = [
        {
          periodType: 'cumulative',
          startDate: '2025-12-01',
          endDate: '2026-07-31',
          totalHours: 123,
          items: [
            { moduleKey: 'SCOPE', displayName: '白名單', hours: 100, ratio: 100 / 123, category: 'project' },
            { moduleKey: 'ADMIN', displayName: '行政事務', hours: 23, ratio: 23 / 123, category: 'other' },
          ],
        },
        {
          periodType: 'quarter',
          startDate: '2026-04-01',
          endDate: '2026-07-31',
          totalHours: 77,
          items: [
            { moduleKey: 'SCOPE-Q', displayName: '白名單當季', hours: 70, ratio: 70 / 77, category: 'project' },
            { moduleKey: 'AI', displayName: 'AI研究與應用', hours: 7, ratio: 7 / 77, category: 'other' },
          ],
        },
      ]
      analysis.presentationAnalysis.presentationScopeAnalysis = {
        moduleWorkHoursCharts: [
          {
            periodType: 'cumulative',
            startDate: '2025-12-01',
            endDate: '2026-07-31',
            totalHours: 24,
            items: [{ moduleKey: 'SCOPE', displayName: '白名單', hours: 24, ratio: 1, category: 'project' }],
          },
          {
            periodType: 'quarter',
            startDate: '2026-04-01',
            endDate: '2026-07-31',
            totalHours: 12,
            items: [{ moduleKey: 'SCOPE-Q', displayName: '白名單當季', hours: 12, ratio: 1, category: 'project' }],
          },
        ],
        moduleWorkforce: [],
        cumulativeTotalHours: 24,
        quarterTotalHours: 12,
      }

      await buildFullPresentation(
        { analysis, projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )

      const joined = slideText.join(' ')
      expect(joined).toContain('工作成果說明－工時（累計）')
      expect(joined).toContain('工作成果說明－工時（當季）')
      expect(joined).toContain('前端開發課工時分布；期間：2025-12-01 ～ 2026-07-31；總工時：123.0 H')
      expect(joined).toContain('前端開發課工時分布；期間：2026-04-01 ～ 2026-07-31；總工時：77.0 H')
      expect(joined).not.toContain('白名單專案工時')
      expect(joined).not.toContain('總工時：1000.0 H')
      expect(joined).not.toContain('總工時：400.0 H')
      expect(joined).not.toContain('總工時：24.0 H')
      expect(joined).not.toContain('總工時：12.0 H')
    })

    it('移除四張摘要頁，專案／維運頁無表格且第一個專案頁緊接其後', async () => {
      const slides: Array<{
        text: string[]
        addImage: ReturnType<typeof vi.fn>
        addTable: ReturnType<typeof vi.fn>
      }> = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const tracked = {
          text: [] as string[],
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
        }
        slides.push(tracked)
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
            if (typeof text === 'string') tracked.text.push(text)
            return slide
          }),
          addImage: tracked.addImage,
          addTable: tracked.addTable,
          background: undefined as unknown,
        }
        return slide
      })

      const result = await buildFullPresentation(
        {
          analysis: makeMinimalAnalysis(),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          presentationCharts: {
            moduleWorkHours: makePresentationAnalysis().moduleWorkHoursCharts.map((chart) => ({
              chart,
              imageBase64: 'data:image/png;base64,CHART',
            })),
            moduleWorkforce: 'data:image/png;base64,WORKFORCE',
            monthlyWorkType: 'data:image/png;base64,MONTHLY',
          },
        },
        null, null
      )

      const allText = slides.flatMap((slide) => slide.text).join(' ')
      expect(allText).not.toContain('本期摘要')
      expect(allText).not.toContain('單季主專案工時排行（Top 5）')
      expect(allText).not.toContain('收入與績效摘要')
      expect(allText).not.toContain('資料品質摘要')
      expect(slides.every((slide) =>
        slide.text.length + slide.addImage.mock.calls.length + slide.addTable.mock.calls.length > 0
      )).toBe(true)

      const monthlySlide = slides[4]
      expect(monthlySlide?.text.join(' ')).toContain('工作成果說明－專案／維運占比')
      expect(monthlySlide?.addImage).toHaveBeenCalledTimes(1)
      expect(monthlySlide?.addTable).not.toHaveBeenCalled()
      expect(slides[5]?.text.join(' ')).toContain('PROJECT CODE')

      const pageNumbers = allText.match(/SLIDE \d+ \/ \d+/g) ?? []
      expect(pageNumbers).toHaveLength(result.totalSlides - 1)
      pageNumbers.forEach((label, index) => {
        expect(label).toBe(`SLIDE ${index + 1} / ${result.totalSlides - 1}`)
      })
      expect(allText).toContain(`本簡報共 ${result.totalSlides} 張投影片，內頁 ${result.totalSlides - 1} 頁`)
    })

    it('S1 PPT 不加入重複工時圖頁', async () => {
      const analysis = makeMinimalAnalysis()
      analysis.quarter = 'S1'
      analysis.dateRanges = {
        cumulative: { start: '2025-12-01', end: '2026-03-31' },
        quarter: { start: '2025-12-01', end: '2026-03-31' },
      }
      analysis.presentationAnalysis.moduleWorkHoursCharts = [
        {
          periodType: 'cumulative',
          startDate: '2025-12-01',
          endDate: '2026-03-31',
          totalHours: 100,
          items: [{ moduleKey: 'MOD-A', displayName: 'MOD-A', hours: 100, ratio: 1, category: 'project' }],
        },
      ]
      const s2Result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      const result = await buildFullPresentation(
        { analysis, projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result.totalSlides).toBe(s2Result.totalSlides - 1)
    })

    it('人力與專案維運頁在公式未設定 fallback 時仍加入 PPT', async () => {
      const slideText: string[] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
            if (typeof text === 'string') slideText.push(text)
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })

      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )

      expect(slideText.join(' ')).toContain('人力公式尚未確認')
      expect(slideText.join(' ')).toContain('比例口徑待確認')
    })

    it('Phase 6F 封面顯示新版 badge、標題、PROJECTS 與 SEMESTER，且封面不含頁尾頁碼', async () => {
      const slideTexts: string[][] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const currentSlideText: string[] = []
        slideTexts.push(currentSlideText)
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
            if (typeof text === 'string') currentSlideText.push(text)
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })

      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(24), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )

      const coverText = slideTexts[0]?.join(' ') ?? ''
      const allInnerText = slideTexts.slice(1).flat().join(' ')

      expect(coverText).toContain('PERFORMANCE REPORT 2026.07')
      expect(coverText).toContain('2026 S2 專案績效報告')
      expect(coverText).toContain('行動前端開發課')
      expect(coverText).toContain('24')
      expect(coverText).toContain('PROJECTS')
      expect(coverText).toContain('S2')
      expect(coverText).toContain('SEMESTER')
      expect(coverText).not.toContain('INTERNAL PEC REPORT // CONFIDENTIAL')
      expect(coverText).not.toContain('GENERATED')
      expect(coverText).not.toContain('SLIDE')
      expect(allInnerText).toContain('SLIDE 1 /')
    })

    it('Project overview 顯示四個 KPI 與 lostContentCount = 0', async () => {
      const slideText: string[] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
            if (typeof text === 'string') slideText.push(text)
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })

      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )

      const joined = slideText.join(' ')
      expect(joined).toContain('工時')
      expect(joined).toContain('占比')
      expect(joined).toContain('年度收入')
      expect(joined).toContain('當期績效')
      expect(result.paginationAudit?.lostContentCount).toBe(0)
    })

    it('年度收入與當期績效 caption 使用最終口徑文字，不再顯示舊說明', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: {
            informationService: 709,
            frontendDevelopment: 398,
            backendDevelopment: 433,
          },
        },
        null, null
      )

      const joined = slideText.join(' ')
      expect(joined).toContain('依 Excel 年度收入欄位')
      expect(joined).toContain('收入－三組織成本')
      expect(joined).not.toContain('沿用既有口徑')
      expect(joined).not.toContain('既有收入口徑')
    })

    it('三組織皆 0 時不產生大型狀態框文字', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(0, {
            informationServiceHours: 0,
            frontendDevelopmentHours: 0,
            backendDevelopmentHours: 0,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
        },
        null, null
      )
      expect(slideText.join(' ')).not.toContain('本期三組織皆無投入工時')
    })

    it('前端 0 但其他組織有工時時不產生狀態框，成本表格仍保留', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(0, {
            informationServiceHours: 47,
            frontendDevelopmentHours: 0,
            backendDevelopmentHours: 9,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: {
            informationService: 709,
            frontendDevelopment: 398,
            backendDevelopment: 433,
          },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).not.toContain('本期前端開發課無投入工時，其他組織有投入')
      expect(joined).toContain('0.0 H')
      expect(joined).toContain('成本分析')
      expect(joined).toContain('當期績效：NT$62,780')
    })

    it('成本分析表中文安全、平均時薪使用 ASCII / H，當期績效不在表格列內', async () => {
      const slideText: string[] = []
      const tables: PptxGenJS.TableRow[][] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
            if (typeof text === 'string') slideText.push(text)
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn((rows: PptxGenJS.TableRow[]) => {
            tables.push(rows)
            return slide
          }),
          background: undefined as unknown,
        }
        return slide
      })

      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 2,
            backendDevelopmentHours: 3,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: {
            informationService: 709,
            frontendDevelopment: 398,
            backendDevelopment: 433,
          },
        },
        null, null
      )

      const costTable = tables.find((rows) =>
        rows[0]?.map((cell) => typeof cell === 'object' && 'text' in cell ? cell.text : '').join('|') ===
          '組別|工時|平均時薪|成本'
      )
      expect(costTable).toBeTruthy()
      expect(costTable?.map((row) => row[0]).map((cell) =>
        typeof cell === 'object' && 'text' in cell ? cell.text : ''
      )).toEqual(['組別', '資訊服務組', '前端開發課', '後端開發課', '總計'])
      expect(JSON.stringify(costTable)).toContain('NT$709 / H')
      expect(JSON.stringify(costTable)).toContain('NT$398 / H')
      expect(JSON.stringify(costTable)).toContain('NT$433 / H')
      expect(JSON.stringify(costTable)).not.toContain('／H')
      expect(JSON.stringify(costTable)).not.toContain('�')
      expect(JSON.stringify(costTable)).not.toContain('當期績效')
      expect(slideText.join(' ')).toContain('當期績效：')
    })

    it('已匹配不產生狀態框；unmatched 只在工時 KPI 小字提示', async () => {
      const matchedText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(5, {
            informationServiceHours: 0,
            frontendDevelopmentHours: 5,
            backendDevelopmentHours: 0,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
        },
        null, null
      )
      expect(matchedText.join(' ')).not.toContain('已匹配')

      const unmatchedText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(0, {
            informationServiceHours: 0,
            frontendDevelopmentHours: 0,
            backendDevelopmentHours: 0,
          }, 'unmatched'),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
        },
        null, null
      )
      expect(unmatchedText.join(' ')).toContain('工時資料尚未匹配')
      expect(unmatchedText.join(' ')).not.toContain('已匹配')
    })

    it('不產生收入摘要頁，但專案頁年度收入資料仍正常', async () => {
      const primaryText = captureSlideText()
      const primary = makeMinimalAnalysis()
      primary.revenue = {
        configured: true,
        cumulativeRevenue: 22496000,
        quarterRevenue: null,
        revenuePerHour: null,
        inputOutputRatio: null,
        sourceLabel: '收入工時彙總',
        issues: [],
      }
      await buildFullPresentation(
        { analysis: primary, projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(primaryText.join(' ')).not.toContain('收入與績效摘要')
      expect(primaryText.join(' ')).toContain('年度收入')
      expect(primaryText.join(' ')).toContain('依 Excel 年度收入欄位')

      const fallbackText = captureSlideText()
      const fallback = makeMinimalAnalysis()
      fallback.revenue = {
        configured: true,
        cumulativeRevenue: 1000,
        quarterRevenue: null,
        revenuePerHour: null,
        inputOutputRatio: null,
        sourceLabel: '專案清單收入欄位（fallback）',
        issues: [],
      }
      await buildFullPresentation(
        { analysis: fallback, projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(fallbackText.join(' ')).not.toContain('收入與績效摘要')
      expect(fallbackText.join(' ')).toContain('年度收入')
    })

    it('projectMappingBlocked = true 時拋出阻擋性 Error', async () => {
      const blockedAnalysis = makeMinimalAnalysis()
      blockedAnalysis.dataQuality.projectMappingBlocked = true

      await expect(
        buildFullPresentation(
          { analysis: blockedAnalysis, projectContent: makeEmptyProjectContent(), images: new Map() },
          null, null
        )
      ).rejects.toThrow('專案工時尚未成功對應至專案內容')
    })

    it('頁尾不含本機路徑（測試 addText 呼叫內容）', async () => {
      const slideAddTextCalls: string[] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[]) => {
            if (typeof text === 'string') slideAddTextCalls.push(text)
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })

      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )

      const allText = slideAddTextCalls.join(' ')
      expect(allText).not.toMatch(/C:\\/)
      expect(allText).not.toMatch(/\.xlsx/)
      expect(allText).not.toMatch(/\.zip/)
    })
  })
})

// 型別補充（避免 ESLint 報告未使用）
import type PptxGenJS from 'pptxgenjs'
void (null as unknown as PptxGenJS.TextProps)
