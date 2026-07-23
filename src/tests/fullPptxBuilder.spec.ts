/**
 * fullPptxBuilder.spec.ts
 * 驗證 Phase 5 完整版 PPT 產生服務。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ProjectContentResult } from '@/types/project'
import type { Phase5ProgressStep } from '@/types/ppt'
import { PPT_MIME_TYPE } from '@/services/pptxBuilder'

// ── PptxGenJS mock ─────────────────────────────────────────────────────────

const { MockPptxF, getMockInstance5 } = vi.hoisted(() => {
  const createSlide = () => ({
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  })

  let mockInstance = {
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
    dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0 },
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

    it('totalSlides >= 8（固定頁）+ 專案數', async () => {
      const projectCount = 2
      const result = await buildFullPresentation(
        { analysis: makeMinimalAnalysis(projectCount), projectContent: makeEmptyProjectContent(), images: new Map() },
        null, null
      )
      expect(result.totalSlides).toBeGreaterThanOrEqual(8 + projectCount)
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
      // addSlide 被呼叫次數 >= 固定頁 + 專案頁
      const addSlideCalls = getMockInstance5().addSlide.mock.calls.length
      expect(addSlideCalls).toBeGreaterThanOrEqual(8 + n)
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
