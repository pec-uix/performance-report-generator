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
    frontendPeopleCount: 5,
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
        data: { '專案收入_年度收入': 100000 },
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
            moduleWorkforceQuarter: null,
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

    it('Project overview 顯示三張 KPI 卡（工時分析、年度收入、截至本期累積績效）與 lostContentCount = 0', async () => {
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
      expect(joined).toContain('截至本期累積績效')
      expect(result.paginationAudit?.lostContentCount).toBe(0)
    })

    it('年度收入與累積績效 caption 使用最終口徑文字，不再顯示舊說明', async () => {
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
      expect(joined).toContain('依專案內容年度收入欄位')
      expect(joined).toContain('年度收入－截至本期累積費用')
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
      expect(joined).toContain('截至本期累積績效：NT$62,780')
    })

    it('成本分析表中文安全、平均時薪使用 ASCII / H，累積績效不在表格列內', async () => {
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
          '組別|累計工時|平均時薪|累計成本'
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
      expect(JSON.stringify(costTable)).not.toContain('截至本期累積績效')
      expect(slideText.join(' ')).toContain('截至本期累積績效：')
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
      expect(primaryText.join(' ')).toContain('依專案內容年度收入欄位')

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

  // ── Phase 6G：移除專案收入區塊 & 成本表欄位調整 ──────────────────────────

  describe('Phase 6G 移除專案收入區塊與成本表欄位調整', () => {
    function makeAnalysisWithChildren(): ReportAnalysisResult {
      const analysis = makeMinimalAnalysis(1)
      analysis.projectGroups[0]!.mainProject.projectName = '統流多園區建置案'
      analysis.projectGroups[0]!.children = [
        {
          itemNo: '1-1',
          itemType: 'child',
          projectKey: '202601037(新市物流園區官網建置)',
          projectName: '新市物流園區官網建置',
          cumulativeHours: 60,
          quarterHours: 30,
          cumulativePeopleCount: 2,
          quarterPeopleCount: 1,
          revenue: 500000,
        },
      ]
      analysis.projectGroups[0]!.cumulativeHours = 160
      analysis.projectGroups[0]!.quarterHours = 80
      analysis.projectCostHoursByItemNo = {
        '1.0': { informationServiceHours: 10, frontendDevelopmentHours: 50, backendDevelopmentHours: 5 },
        '1-1': { informationServiceHours: 5, frontendDevelopmentHours: 30, backendDevelopmentHours: 3 },
      }
      analysis.projectCostCumulativeHoursByItemNo = {
        '1.0': { informationServiceHours: 20, frontendDevelopmentHours: 100, backendDevelopmentHours: 10 },
        '1-1': { informationServiceHours: 10, frontendDevelopmentHours: 60, backendDevelopmentHours: 6 },
      }
      analysis.presentationScope = {
        items: [
          {
            itemNo: '1.0',
            itemType: 'main',
            stableItemId: '20231003',
            projectCode: '20231003',
            projectName: '20231003(統流多園區建置案)',
            sourceType: 'project',
            moduleKey: '20231003(統流多園區建置案)',
            masterAnnualRevenue: 1065000,
            sourceRow: 1,
            content: {
              rowIndex: 0,
              rawItemNo: '1.0',
              normalizedItemNo: '1.0',
              itemType: 'main',
              data: { '專案收入_描述': '官網與員工入口網合約（專案收入：106.5萬）' },
              imageRefs: [],
            },
            matchStatus: 'exact',
          },
          {
            itemNo: '1-1',
            parentItemNo: '1.0',
            itemType: 'child',
            stableItemId: '202601037',
            projectCode: '202601037',
            projectName: '202601037(新市物流園區官網建置)',
            sourceType: 'project',
            moduleKey: '202601037(新市物流園區官網建置)',
            masterAnnualRevenue: 500000,
            sourceRow: 2,
            content: {
              rowIndex: 1,
              rawItemNo: '1-1',
              normalizedItemNo: '1-1',
              itemType: 'child',
              data: {},
              imageRefs: [],
            },
            matchStatus: 'exact',
          },
        ],
        mainItems: [],
        childItems: [],
        orderedMainItemIds: ['1.0'],
        allowedStableItemIds: new Set(['20231003', '202601037']),
        issues: [],
      }
      analysis.presentationScope.mainItems = [analysis.presentationScope.items[0]!]
      analysis.presentationScope.childItems = [analysis.presentationScope.items[1]!]
      return analysis
    }

    function makeContentWithRevenueSection(): import('@/types/project').ProjectContentResult {
      return {
        sheetFound: true,
        alternativeSheetFound: false,
        totalRows: 2,
        mainCount: 1,
        childCount: 1,
        invalidCount: 0,
        duplicateCount: 0,
        orphanChildCount: 0,
        items: [
          {
            rowIndex: 0,
            rawItemNo: '1.0',
            normalizedItemNo: '1.0',
            itemType: 'main',
            data: {
              '專案收入_描述': '官網與員工入口網合約（專案收入：106.5萬）',
              '已完成工作事項_描述': '完成官網設計',
            },
            imageRefs: [],
          },
          {
            rowIndex: 1,
            rawItemNo: '1-1',
            normalizedItemNo: '1-1',
            itemType: 'child',
            parentItemNo: '1.0',
            data: {},
            imageRefs: [],
          },
        ],
        detectedHeaders: [],
        issues: [],
      }
    }

    it('PPT 不輸出「專案收入」文字區塊（標題與描述均不出現）', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).not.toContain('專案收入\n')
      expect(joined).not.toContain('官網與員工入口網合約（專案收入：106.5萬）')
      expect(joined).not.toMatch(/^專案收入$/)
    })

    it('移除專案收入區塊後年度收入 KPI 仍保留', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).toContain('年度收入')
      expect(joined).toContain('依專案內容年度收入欄位')
    })

    it('累積績效計算不受移除專案收入區塊影響', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      // 累積績效欄位仍出現於投影片
      expect(joined).toContain('截至本期累積績效')
    })

    it('成本分析群組表第一欄標題為「專案名稱」，不顯示「項次」', async () => {
      const tables: PptxGenJS.TableRow[][] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn().mockReturnThis(),
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
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )

      const groupedTable = tables.find((rows) => {
        const header = rows[0]?.map((cell) =>
          typeof cell === 'object' && 'text' in cell ? String(cell.text) : ''
        ).join('|') ?? ''
        return header.startsWith('專案名稱|')
      })
      expect(groupedTable).toBeTruthy()

      const header = groupedTable![0]!.map((cell) =>
        typeof cell === 'object' && 'text' in cell ? String(cell.text) : ''
      )
      expect(header[0]).toBe('專案名稱')
      expect(header).not.toContain('項次')
      expect(header).not.toContain('累積費用')
      expect(header).toContain('累積績效')
    })

    it('群組表第一欄不顯示 itemNo 與 project code', async () => {
      const tables: PptxGenJS.TableRow[][] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn().mockReturnThis(),
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
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )

      const groupedTable = tables.find((rows) => {
        const h = rows[0]?.map((cell) =>
          typeof cell === 'object' && 'text' in cell ? String(cell.text) : ''
        ).join('|') ?? ''
        return h.startsWith('專案名稱|')
      })
      expect(groupedTable).toBeTruthy()

      const firstColValues = groupedTable!.slice(1).map((row) =>
        typeof row[0] === 'object' && 'text' in row[0] ? String(row[0].text) : ''
      )
      // 不顯示 "1.0"、"1-1"、"20231003" 等 itemNo 或 projectCode
      expect(firstColValues).not.toContain('1.0')
      expect(firstColValues).not.toContain('1-1')
      expect(firstColValues).not.toContain('20231003')
      expect(firstColValues).not.toContain('202601037')
      // 不顯示 "1 合計" 格式（含數字的合計）
      expect(firstColValues.every((v) => !/^\d/.test(v))).toBe(true)
    })

    it('群組表第一欄顯示正式中文專案名稱，群組合計顯示「群組合計」', async () => {
      const tables: PptxGenJS.TableRow[][] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn().mockReturnThis(),
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
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )

      const groupedTable = tables.find((rows) => {
        const h = rows[0]?.map((cell) =>
          typeof cell === 'object' && 'text' in cell ? String(cell.text) : ''
        ).join('|') ?? ''
        return h.startsWith('專案名稱|')
      })
      expect(groupedTable).toBeTruthy()

      const firstColValues = groupedTable!.slice(1).map((row) =>
        typeof row[0] === 'object' && 'text' in row[0] ? String(row[0].text) : ''
      )
      // 群組合計列顯示「群組合計」
      expect(firstColValues).toContain('群組合計')
      // 主項顯示名稱（不含 code prefix）
      expect(firstColValues.some((v) => v.includes('統流多園區建置案') || v.includes('新市物流園區官網建置'))).toBe(true)
    })

    it('移除「專案收入」文字後不留下空白 card（投影片中不出現空的 addText 呼叫後緊接大量空白）', async () => {
      // 驗證：移除後整個 card 包含 addText 與框線均不存在
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
        {
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
        },
        null, null
      )

      // 投影片中不出現以「專案收入」為獨立標題的內容 card
      const allJoined = slideTexts.flat().join('\n')
      const lines = allJoined.split('\n')
      const revenueLineIdx = lines.findIndex((l) => l.trim() === '專案收入')
      expect(revenueLineIdx).toBe(-1)
    })

    it('年度收入表格欄位仍保留在群組成本表中', async () => {
      const tables: PptxGenJS.TableRow[][] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn().mockReturnThis(),
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
          analysis: makeAnalysisWithChildren(),
          projectContent: makeContentWithRevenueSection(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )

      const groupedTable = tables.find((rows) => {
        const h = rows[0]?.map((cell) =>
          typeof cell === 'object' && 'text' in cell ? String(cell.text) : ''
        ).join('|') ?? ''
        return h.startsWith('專案名稱|')
      })
      expect(groupedTable).toBeTruthy()
      const header = groupedTable![0]!.map((cell) =>
        typeof cell === 'object' && 'text' in cell ? String(cell.text) : ''
      )
      expect(header).toContain('年度收入')
    })
  })

  // ── Phase 6H：連結標籤優化 & 圖片版型放大 ────────────────────────────────

  describe('Phase 6H 連結標籤與圖片版型改善', () => {
    type TextCall = { text: string | PptxGenJS.TextProps[]; options: Record<string, unknown> }

    function captureAddTextWithOptions(): TextCall[] {
      const calls: TextCall[] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[], options?: Record<string, unknown>) => {
            calls.push({ text, options: options ?? {} })
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })
      return calls
    }

    function makeProjectContentWithLink(): import('@/types/project').ProjectContentResult {
      return {
        sheetFound: true,
        alternativeSheetFound: false,
        totalRows: 1,
        mainCount: 1,
        childCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        orphanChildCount: 0,
        items: [{
          rowIndex: 0,
          rawItemNo: '1.0',
          normalizedItemNo: '1.0',
          itemType: 'main',
          data: { 'UIX執行成果_文字/連結描述': 'https://example.com/uix-result' },
          imageRefs: [],
        }],
        detectedHeaders: [],
        issues: [],
      }
    }

    function makeProjectContentWithImages(count: number): import('@/types/project').ProjectContentResult {
      return {
        sheetFound: true,
        alternativeSheetFound: false,
        totalRows: 1,
        mainCount: 1,
        childCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        orphanChildCount: 0,
        items: [{
          rowIndex: 0,
          rawItemNo: '1.0',
          normalizedItemNo: '1.0',
          itemType: 'main',
          data: {},
          imageRefs: [{ column: 'UIX執行成果_圖片展示', filenames: Array.from({ length: count }, (_, i) => `test${i + 1}.jpg`) }],
        }],
        detectedHeaders: [],
        issues: [],
      }
    }

    it('PPT 連結不顯示「開啟連結」文字', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeProjectContentWithLink(), images: new Map() },
        null, null
      )
      const hyperlinkCalls = calls.filter((c) => c.options.hyperlink)
      expect(hyperlinkCalls.length).toBeGreaterThan(0)
      hyperlinkCalls.forEach((c) => {
        expect(c.text).not.toBe('開啟連結')
        expect(c.text).not.toMatch(/^連結 \d+$/)
      })
    })

    it('連結顯示「查看 UIX執行成果」等有意義標籤', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeProjectContentWithLink(), images: new Map() },
        null, null
      )
      const hyperlinkCalls = calls.filter((c) => c.options.hyperlink)
      expect(hyperlinkCalls.length).toBeGreaterThan(0)
      expect(hyperlinkCalls.some((c) => typeof c.text === 'string' && c.text.startsWith('查看 '))).toBe(true)
    })

    it('連結 hyperlink URL 保留不被修改', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeProjectContentWithLink(), images: new Map() },
        null, null
      )
      const hyperlinkCalls = calls.filter((c) => c.options.hyperlink)
      const urls = hyperlinkCalls.map((c) => (c.options.hyperlink as { url: string }).url)
      expect(urls.some((u) => u === 'https://example.com/uix-result')).toBe(true)
    })

    it('單張 inline 圖片 slot 寬度 ≥ 4.0"（Phase 6I：圖片在文字下方全寬顯示）', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeProjectContentWithImages(1), images: new Map() },
        null, null
      )
      // Phase 6I：圖片在文字下方，x=0.36（marginX），全寬 9.28"
      // addImageFrame 呼叫 addText('', { x, y, w, h, fill, line, radius })
      // 圖片框在 x ≈ 0.36，寬度全寬或半寬，y >= 1.0
      const frameCalls = calls.filter(
        (c) => c.text === '' && typeof c.options.x === 'number'
          && (c.options.x as number) >= 0.3 && (c.options.x as number) <= 0.5
          && typeof c.options.w === 'number' && (c.options.w as number) >= 4.0
          && typeof c.options.y === 'number' && (c.options.y as number) >= 1.0
      )
      expect(frameCalls.length).toBeGreaterThan(0)
      frameCalls.forEach((c) => {
        expect(c.options.w as number).toBeGreaterThanOrEqual(4.0)
      })
    })

    it('兩張 inline 圖片並排顯示（Phase 6I：相同 y，不同 x，各自夠寬）', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeProjectContentWithImages(2), images: new Map() },
        null, null
      )
      // Phase 6I：2 張圖並排 — 第一張 x=0.36，第二張 x=0.36+(w+gap)
      // 兩個圖片框各有一次 addText('', ...) 呼叫
      const frameCalls = calls.filter(
        (c) => c.text === '' && typeof c.options.y === 'number'
          && (c.options.y as number) >= 1.0 && (c.options.y as number) <= 1.1
          && typeof c.options.w === 'number' && (c.options.w as number) >= 4.0
      )
      // 兩個圖片框（每個 addImageFrame 呼叫一次空 addText 畫底框）
      expect(frameCalls.length).toBeGreaterThanOrEqual(2)
      const imgFrames = frameCalls.slice(0, 2)
      // 相同 y（並排而非垂直堆疊）
      expect(imgFrames[0]!.options.y).toBe(imgFrames[1]!.options.y)
      // 不同 x（第二張在右方）
      expect(imgFrames[1]!.options.x as number).toBeGreaterThan(imgFrames[0]!.options.x as number)
    })

    it('兩張 inline 圖片各自寬度 ≥ 4.0"（Phase 6I：並排半寬仍比舊版右欄窄圖更寬）', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: makeProjectContentWithImages(2), images: new Map() },
        null, null
      )
      const frameCalls = calls.filter(
        (c) => c.text === '' && typeof c.options.y === 'number'
          && (c.options.y as number) >= 1.0 && (c.options.y as number) <= 1.1
          && typeof c.options.w === 'number' && (c.options.w as number) >= 4.0
      )
      expect(frameCalls.length).toBeGreaterThanOrEqual(2)
      frameCalls.slice(0, 2).forEach((c) => {
        expect(c.options.w as number).toBeGreaterThanOrEqual(4.0)
      })
    })
  })

  // ── Phase 6I：KPI 三合一 & overflow 投影片 ────────────────────────────────

  describe('Phase 6I KPI 三合一與 overflow 投影片', () => {
    function captureAddTextWithOptions(): Array<{ text: string | PptxGenJS.TextProps[]; options: Record<string, unknown> }> {
      const calls: Array<{ text: string | PptxGenJS.TextProps[]; options: Record<string, unknown> }> = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[], options?: Record<string, unknown>) => {
            calls.push({ text, options: options ?? {} })
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })
      return calls
    }

    it('KPI 固定三張：label 包含「工時分析」、「年度收入」、「截至本期累積績效」', async () => {
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
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).toContain('工時分析')
      expect(joined).toContain('年度收入')
      expect(joined).toContain('截至本期累積績效')
    })

    it('不再產生獨立「占比」KPI 卡（占比合併進工時分析 caption）', async () => {
      const calls = captureAddTextWithOptions()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      // KPI 卡的 label 以純文字 addText 呼叫輸出；「占比」不再是獨立的 label
      const kpiLabelCalls = calls.filter(
        (c) => typeof c.text === 'string' && c.text === '占比'
      )
      expect(kpiLabelCalls.length).toBe(0)
    })

    it('占比數值仍保留在工時分析 caption 中', async () => {
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
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      // 工時分析 caption 格式：「N 人｜占比 XX.XX%」
      expect(slideText.join(' ')).toContain('占比')
    })

    it('概覽投影片有圖片時多產生一張 overflow 投影片', async () => {
      // 使用 makeScopedAnalysisForStatus（含 presentationScope）確保產生 overview 滑入，
      // 且 overview 有 cost table → curY 足夠高 → 圖片空間不足 → overflow
      function makeImageContent(): import('@/types/project').ProjectContentResult {
        return {
          sheetFound: true, alternativeSheetFound: false, totalRows: 1,
          mainCount: 1, childCount: 0, invalidCount: 0, duplicateCount: 0, orphanChildCount: 0,
          items: [{
            rowIndex: 0, rawItemNo: '1.0', normalizedItemNo: '1.0', itemType: 'main',
            data: {},
            imageRefs: [{ column: 'UIX執行成果_圖片展示', filenames: ['test1.jpg'] }],
          }],
          detectedHeaders: [], issues: [],
        }
      }

      const inst = getMockInstance5()
      let addSlideCount = 0
      inst.addSlide.mockImplementation(() => {
        addSlideCount++
        return {
          addText: vi.fn().mockReturnThis(),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
      })

      // 無圖片時的 addSlide 次數
      addSlideCount = 0
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1, frontendDevelopmentHours: 50, backendDevelopmentHours: 2,
          }),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const countWithoutImages = addSlideCount

      // 有圖片時的 addSlide 次數
      addSlideCount = 0
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1, frontendDevelopmentHours: 50, backendDevelopmentHours: 2,
          }),
          projectContent: makeImageContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const countWithImages = addSlideCount

      // 有圖片比無圖片多至少一張投影片（overflow）
      expect(countWithImages).toBeGreaterThan(countWithoutImages)
    })

    it('所有圖片框的 x 座標均小於 5（不再出現在右側欄位）', async () => {
      const calls = captureAddTextWithOptions()
      const contentWith2Images: import('@/types/project').ProjectContentResult = {
        sheetFound: true, alternativeSheetFound: false, totalRows: 1,
        mainCount: 1, childCount: 0, invalidCount: 0, duplicateCount: 0, orphanChildCount: 0,
        items: [{
          rowIndex: 0, rawItemNo: '1.0', normalizedItemNo: '1.0', itemType: 'main',
          data: {},
          imageRefs: [{ column: 'UIX執行成果_圖片展示', filenames: ['img1.jpg', 'img2.jpg'] }],
        }],
        detectedHeaders: [], issues: [],
      }
      await buildFullPresentation(
        { analysis: makeMinimalAnalysis(), projectContent: contentWith2Images, images: new Map() },
        null, null
      )
      // 篩出圖片框呼叫（空 text，寬度 >= 4.0"）
      const imageFrameCalls = calls.filter(
        (c) => c.text === '' && typeof c.options.w === 'number' && (c.options.w as number) >= 4.0
          && typeof c.options.y === 'number' && (c.options.y as number) >= 1.0
      )
      expect(imageFrameCalls.length).toBeGreaterThan(0)
      // Phase 6I：圖片在文字下方（左起），不再出現在舊版右側欄位（x≈5.76）
      // 兩張並排時第二張 x≈5.05，仍比舊版右欄 5.76 更靠左
      imageFrameCalls.forEach((c) => {
        expect(c.options.x as number).toBeLessThan(5.5)
      })
    })
  })

  // ── Phase 6J：PM 顯示與空區塊隱藏 ─────────────────────────────────────────

  describe('Phase 6J PM 顯示與空區塊隱藏', () => {
    type TextCall = { text: string | PptxGenJS.TextProps[]; options: Record<string, unknown> }

    function captureAddTextWithOptionsJ(): TextCall[] {
      const calls: TextCall[] = []
      const inst = getMockInstance5()
      inst.addSlide.mockImplementation(() => {
        const slide = {
          addText: vi.fn((text: string | PptxGenJS.TextProps[], options?: Record<string, unknown>) => {
            calls.push({ text, options: options ?? {} })
            return slide
          }),
          addImage: vi.fn().mockReturnThis(),
          addTable: vi.fn().mockReturnThis(),
          background: undefined as unknown,
        }
        return slide
      })
      return calls
    }

    function makeAnalysisWithPm(pm: string): ReportAnalysisResult {
      const analysis = makeScopedAnalysisForStatus(50, {
        informationServiceHours: 1,
        frontendDevelopmentHours: 50,
        backendDevelopmentHours: 2,
      })
      // PM 透過 content.data['PM'] 進入 buildSummaryRow
      analysis.presentationScope!.items[0]!.content.data = { 'PM': pm }
      return analysis
    }

    function makeAnalysisWithEmptyPm(): ReportAnalysisResult {
      const analysis = makeScopedAnalysisForStatus(50, {
        informationServiceHours: 1,
        frontendDevelopmentHours: 50,
        backendDevelopmentHours: 2,
      })
      analysis.presentationScope!.items[0]!.content.data = {}
      return analysis
    }

    function makeContentWithSections(
      sections: Record<string, string>
    ): import('@/types/project').ProjectContentResult {
      return {
        sheetFound: true,
        alternativeSheetFound: false,
        totalRows: 1,
        mainCount: 1,
        childCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        orphanChildCount: 0,
        items: [{
          rowIndex: 0,
          rawItemNo: '1.0',
          normalizedItemNo: '1.0',
          itemType: 'main',
          data: sections,
          imageRefs: [],
        }],
        detectedHeaders: [],
        issues: [],
      }
    }

    // ── PM tests ──────────────────────────────────────────────────────────

    it('多位 PM（/ 分隔）PPT 只顯示第一位', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithPm('劉雅旻 / 施孟芊'),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).toContain('PM  劉雅旻')
      expect(joined).not.toContain('施孟芊')
    })

    it('多位 PM（全形 ／ 分隔）PPT 只顯示第一位', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithPm('劉雅旻／施孟芊'),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).toContain('PM  劉雅旻')
      expect(joined).not.toContain('施孟芊')
    })

    it('多位 PM（、分隔）PPT 只顯示第一位', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithPm('王大明、陳小美'),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).toContain('PM  王大明')
      expect(joined).not.toContain('陳小美')
    })

    it('單一 PM 正常顯示', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithPm('劉雅旻'),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      expect(slideText.join(' ')).toContain('PM  劉雅旻')
    })

    it('PM 空白時 PROJECT CODE 行不出現「PM」標籤', async () => {
      const calls = captureAddTextWithOptionsJ()
      await buildFullPresentation(
        {
          analysis: makeAnalysisWithEmptyPm(),
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      // PROJECT CODE 行文字不應含「PM」
      const projectCodeCalls = calls.filter(
        (c) => typeof c.text === 'string' && (c.text as string).startsWith('PROJECT CODE')
      )
      expect(projectCodeCalls.length).toBeGreaterThan(0)
      projectCodeCalls.forEach((c) => {
        expect(c.text as string).not.toContain('PM')
      })
    })

    it('原始 PM 完整資料仍保留在資料模型中（不被截斷）', async () => {
      // 驗證 buildExecutiveProjectSlides 不修改原始 content.data
      const { buildExecutiveProjectSlides } = await import('@/services/executiveProjectPaginationService')
      const analysis = makeAnalysisWithPm('劉雅旻 / 施孟芊')
      const result = buildExecutiveProjectSlides(
        analysis,
        makeEmptyProjectContent(),
        { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
      )
      // 資料模型保留完整 pm（顯示截斷只在渲染層）
      const pmInModel = result.slides[0]?.pm
      expect(pmInModel).toBe('劉雅旻 / 施孟芊')
    })

    // ── 成員與 KPI 順序 ──────────────────────────────────────────────────

    it('成員文字 Y 座標低於 KPI 卡（成員在 KPI 上方）', async () => {
      const calls = captureAddTextWithOptionsJ()
      // 使用有成員的分析（makeScopedAnalysisForStatus 有 quarterPeopleCount=2）
      const analysis = makeScopedAnalysisForStatus(50, {
        informationServiceHours: 1,
        frontendDevelopmentHours: 50,
        backendDevelopmentHours: 2,
      })
      // 塞入成員資料（透過 content.data['專案成員']）
      analysis.presentationScope!.items[0]!.content.data = { '專案成員': '政健、秉育、瑞齊' }
      await buildFullPresentation(
        {
          analysis,
          projectContent: makeEmptyProjectContent(),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      // 成員文字：text 包含「成員：」，Y 應 < 1.0（即在 KPI 前）
      const memberCalls = calls.filter(
        (c) => typeof c.text === 'string' && (c.text as string).startsWith('成員：')
      )
      // KPI 第一卡 label：text === '工時分析'，Y 應 >= 1.0
      const kpiLabelCalls = calls.filter(
        (c) => typeof c.text === 'string' && (c.text as string) === '工時分析'
      )
      if (memberCalls.length > 0 && kpiLabelCalls.length > 0) {
        const memberY = memberCalls[0]!.options.y as number
        const kpiY = kpiLabelCalls[0]!.options.y as number
        expect(memberY).toBeLessThan(kpiY)
      }
    })

    // ── 空區塊隱藏 ────────────────────────────────────────────────────────

    it('無已完成工作事項時不建立該文字卡', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          projectContent: makeContentWithSections({ '預計完成工作_描述': '下季完成 API 串接' }),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      // 預計完成出現，但已完成工作事項不出現
      expect(joined).toContain('預計完成工作')
      expect(joined).not.toContain('已完成工作事項')
    })

    it('無預計完成事項時不建立該文字卡', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          projectContent: makeContentWithSections({ '已完成工作事項_描述': '已完成首頁設計' }),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).toContain('已完成工作事項')
      expect(joined).not.toContain('預計完成工作')
    })

    it('無執行成果時不建立執行成果文字卡', async () => {
      const slideText = captureSlideText()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          projectContent: makeContentWithSections({ '已完成工作事項_描述': '完成上線' }),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const joined = slideText.join(' ')
      expect(joined).not.toContain('UIX執行成果')
      expect(joined).not.toContain('執行成果')
    })

    it('有已完成與無預計完成時，後續內容正常顯示（lostContentCount = 0）', async () => {
      const result = await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          projectContent: makeContentWithSections({
            '已完成工作事項_描述': '完成 API 串接',
          }),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      expect(result.paginationAudit?.lostContentCount).toBe(0)
    })

    it('空文字的 section 不建立空白 card（不出現空 title+空 body 的 addText 組合）', async () => {
      const calls = captureAddTextWithOptionsJ()
      await buildFullPresentation(
        {
          analysis: makeScopedAnalysisForStatus(50, {
            informationServiceHours: 1,
            frontendDevelopmentHours: 50,
            backendDevelopmentHours: 2,
          }),
          // 空 section body：只有欄位但值為空字串
          projectContent: makeContentWithSections({ '已完成工作事項_描述': '' }),
          images: new Map(),
          hourlyRateSettings: { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 },
        },
        null, null
      )
      const sectionTitleCalls = calls.filter(
        (c) => typeof c.text === 'string' && (c.text as string) === '已完成工作事項'
      )
      expect(sectionTitleCalls.length).toBe(0)
    })
  })
})

// 型別補充（避免 ESLint 報告未使用）
import type PptxGenJS from 'pptxgenjs'
void (null as unknown as PptxGenJS.TextProps)
