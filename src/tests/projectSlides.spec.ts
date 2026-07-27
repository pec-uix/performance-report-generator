/**
 * projectSlides.spec.ts
 * 驗證專案成果投影片的圖片版型、缺圖占位、文字截斷等。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ProjectContentResult, ProjectItem } from '@/types/project'
import type { PresentationAnalysisResult } from '@/types/presentationAnalysis'

// ── PptxGenJS mock ─────────────────────────────────────────────────────────

const { MockPptxP, mockInstanceP } = vi.hoisted(() => {
  const createSlide = () => ({
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  })
  const mockInstanceP = {
    addSlide: vi.fn(() => createSlide()),
    write: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
    layout: '',
    title: '',
    author: '',
  }
  const MockPptxP = vi.fn().mockImplementation(() => mockInstanceP)
  return { MockPptxP, mockInstanceP }
})

vi.mock('pptxgenjs', () => ({ default: MockPptxP }))

const { mockChartP, mockInitP } = vi.hoisted(() => {
  const mockChartP = {
    setOption: vi.fn(), getDataURL: vi.fn(() => 'data:image/png;base64,PROJ'), dispose: vi.fn(),
  }
  const mockInitP = vi.fn().mockReturnValue(mockChartP)
  return { mockChartP, mockInitP }
})
vi.mock('echarts', () => ({ init: mockInitP }))
vi.mock('jszip', () => ({ default: { loadAsync: vi.fn().mockResolvedValue({ files: {} }) } }))

import { buildFullPresentation } from '@/services/fullPptxBuilder'

// ── 輔助 ──────────────────────────────────────────────────────────────────

function makePresentationAnalysis(): PresentationAnalysisResult {
  return {
    moduleWorkHoursCharts: [],
    moduleWorkforce: [],
    monthlyWorkTypes: [],
    workforceConfigured: false,
    monthlyRatioBasis: 'unconfirmed',
    monthlyPeriod: { start: '2025-12-01', end: '2026-07-31' },
    issues: [],
  }
}

function makeAnalysis(groups: { mainItemNo: string; name?: string }[]): ReportAnalysisResult {
  return {
    quarter: 'S2',
    dateRanges: {
      cumulative: { start: '2025-12-01', end: '2026-07-31' },
      quarter: { start: '2026-04-01', end: '2026-07-31' },
    },
    cumulative: {
      workHours: { totalHours: 100, projectHours: 60, maintenanceHours: 30, otherHours: 10, projectRatio: 0.6, maintenanceRatio: 0.3, otherRatio: 0.1, recordCount: 10 },
      workforce: { activePeopleCount: 3, totalHours: 100, averageHoursPerPerson: 33, projectPeopleCount: 2, maintenancePeopleCount: 1, otherPeopleCount: 0, people: [], personMonthsStatus: 'not-configured', personMonths: null },
    },
    quarterSummary: {
      workHours: { totalHours: 50, projectHours: 30, maintenanceHours: 15, otherHours: 5, projectRatio: 0.6, maintenanceRatio: 0.3, otherRatio: 0.1, recordCount: 5 },
      workforce: { activePeopleCount: 2, totalHours: 50, averageHoursPerPerson: 25, projectPeopleCount: 2, maintenancePeopleCount: 1, otherPeopleCount: 0, people: [], personMonthsStatus: 'not-configured', personMonths: null },
    },
    projectGroups: groups.map((g) => ({
      mainItemNo: g.mainItemNo,
      mainProject: {
        itemNo: g.mainItemNo, itemType: 'main' as const, projectKey: g.mainItemNo,
        projectName: g.name ?? `專案 ${g.mainItemNo}`, cumulativeHours: 50,
        quarterHours: 25, cumulativePeopleCount: 2, quarterPeopleCount: 1, revenue: null,
      },
      children: [], cumulativeHours: 50, quarterHours: 25,
      cumulativePeopleCount: 2, quarterPeopleCount: 1, revenue: null,
    })),
    cumulativeProjectRanking: [],
    quarterProjectRanking: [],
    revenue: { configured: false, cumulativeRevenue: null, quarterRevenue: null, revenuePerHour: null, inputOutputRatio: null, issues: [] },
    presentationAnalysis: makePresentationAnalysis(),
    frontendPeopleCount: 5,
    dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0, projectMappingAvailable: false, projectMappingBlocked: false, unmappedProjectHours: 0, unmappedProjectRecords: 0 },
    issues: [],
    metadata: { calculatedAt: '2026-07-23T10:00:00.000Z', sourceRowCounts: {} },
  }
}

function makeProjectContentWithImages(
  mainItemNo: string,
  imageFilenames: string[]
): ProjectContentResult {
  const item: ProjectItem = {
    rowIndex: 0, rawItemNo: mainItemNo, normalizedItemNo: mainItemNo,
    itemType: 'main', data: {}, imageRefs: imageFilenames.length > 0
      ? [{ column: '已完成工作事項_圖片展示', filenames: imageFilenames }]
      : [],
  }
  return {
    sheetFound: true, alternativeSheetFound: false, totalRows: 1,
    mainCount: 1, childCount: 0, invalidCount: 0, duplicateCount: 0,
    orphanChildCount: 0, items: [item], detectedHeaders: [], issues: [],
  }
}

function makeImageRepo(filenames: string[]): ReadonlyMap<string, Uint8Array> {
  const map = new Map<string, Uint8Array>()
  for (const f of filenames) {
    const key = f.split('/').pop()?.toLowerCase() ?? f
    map.set(key, new Uint8Array([1, 2, 3]))
  }
  return map
}

// ── beforeEach ────────────────────────────────────────────────────────────

const slideCallHistory: ReturnType<typeof createTrackedSlide>[] = []

function createTrackedSlide() {
  return {
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  slideCallHistory.length = 0
  mockInstanceP.addSlide.mockImplementation(() => {
    const s = createTrackedSlide()
    slideCallHistory.push(s)
    return s
  })
  mockInstanceP.write.mockResolvedValue(new ArrayBuffer(8))
  MockPptxP.mockImplementation(() => mockInstanceP)
  mockInitP.mockReturnValue(mockChartP)
  mockChartP.getDataURL.mockReturnValue('data:image/png;base64,PROJ')
})

// ── 測試 ───────────────────────────────────────────────────────────────────

describe('projectSlides', () => {
  it('1 張圖片：addImage 被呼叫 1 次（在圖片投影片上）', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['a.png'])
    const repo = makeImageRepo(['a.png'])
    await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    const imageSlideCalls = slideCallHistory.reduce(
      (acc, s) => acc + s.addImage.mock.calls.length, 0
    )
    expect(imageSlideCalls).toBeGreaterThanOrEqual(1)
  })

  it('2 張圖片：addImage 被呼叫 2 次', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['a.png', 'b.png'])
    const repo = makeImageRepo(['a.png', 'b.png'])
    await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    const imageSlideCalls = slideCallHistory.reduce(
      (acc, s) => acc + s.addImage.mock.calls.length, 0
    )
    expect(imageSlideCalls).toBeGreaterThanOrEqual(2)
  })

  it('4 張圖片：addImage 被呼叫 4 次（在同一頁）', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['a.png', 'b.png', 'c.png', 'd.png'])
    const repo = makeImageRepo(['a.png', 'b.png', 'c.png', 'd.png'])
    await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    const imageSlideCalls = slideCallHistory.reduce(
      (acc, s) => acc + s.addImage.mock.calls.length, 0
    )
    expect(imageSlideCalls).toBeGreaterThanOrEqual(4)
  })

  it('5 張圖片：建立兩頁圖片投影片', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'])
    const repo = makeImageRepo(['a.png', 'b.png', 'c.png', 'd.png', 'e.png'])
    await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    // 5 張應分成 2 頁：4+1
    const imageSlideCalls = slideCallHistory.reduce(
      (acc, s) => acc + s.addImage.mock.calls.length, 0
    )
    expect(imageSlideCalls).toBeGreaterThanOrEqual(5)
  })

  it('圖片缺失時改用 addText 占位（不拋出）', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['missing.png'])
    const emptyRepo = new Map<string, Uint8Array>() // 空資料庫，圖片找不到
    const result = await buildFullPresentation(
      { analysis, projectContent: pc, images: emptyRepo },
      null, null
    )
    expect(result.warnings.some((w) => w.code === 'PROJECT_IMAGE_NOT_FOUND')).toBe(true)
    // 用了 addText 顯示占位訊息
    const addTextCalls = slideCallHistory.reduce(
      (acc, s) => acc + s.addText.mock.calls.length, 0
    )
    expect(addTextCalls).toBeGreaterThan(0)
  })

  it('單張圖片錯誤不阻擋整份 PPT', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }, { mainItemNo: '2.0' }])
    const pc = makeProjectContentWithImages('1.0', ['bad.png'])
    // 第 2 個專案有圖片，第 1 個圖片缺失
    const item2: ProjectItem = {
      rowIndex: 1, rawItemNo: '2.0', normalizedItemNo: '2.0', itemType: 'main',
      data: {}, imageRefs: [{ column: '已完成工作事項_圖片展示', filenames: ['good.png'] }],
    }
    pc.items.push(item2)
    const repo = makeImageRepo(['good.png'])
    const result = await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    expect(result.blob).toBeInstanceOf(Blob)
  })

  it('空文字欄位不顯示', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const item: ProjectItem = {
      rowIndex: 0, rawItemNo: '1.0', normalizedItemNo: '1.0', itemType: 'main',
      data: { '工作內容': '', '成果說明': '   ' }, imageRefs: [],
    }
    const pc: ProjectContentResult = {
      sheetFound: true, alternativeSheetFound: false, totalRows: 1,
      mainCount: 1, childCount: 0, invalidCount: 0, duplicateCount: 0,
      orphanChildCount: 0, items: [item], detectedHeaders: [], issues: [],
    }
    // 不拋出即可
    await expect(
      buildFullPresentation({ analysis, projectContent: pc, images: new Map() }, null, null)
    ).resolves.not.toThrow()
  })

  it('無成果內容時仍保留專案摘要頁', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', []) // 無圖片
    const emptyItem = pc.items[0]
    emptyItem.data = {} // 無文字
    await buildFullPresentation({ analysis, projectContent: pc, images: new Map() }, null, null)
    const allText = slideCallHistory.flatMap((s) =>
      s.addText.mock.calls.map((c) => String(c[0]))
    )
    expect(allText.some((t) => t.includes('PROJECT CODE'))).toBe(true)
  })

  it('圖片版型（Phase 6I）：1 張圖全寬顯示，兩張圖並排顯示（相同 y，不同 x，各自夠寬）', async () => {
    const analysis1 = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc1 = makeProjectContentWithImages('1.0', ['img1.png'])
    const repo1 = makeImageRepo(['img1.png'])
    slideCallHistory.length = 0
    await buildFullPresentation({ analysis: analysis1, projectContent: pc1, images: repo1 }, null, null)
    const calls1 = slideCallHistory.flatMap((s) => s.addImage.mock.calls)
    const oneImgW = (calls1[0]?.[0] as { w?: number } | undefined)?.w ?? 0

    slideCallHistory.length = 0
    const analysis2 = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc2 = makeProjectContentWithImages('1.0', ['img1.png', 'img2.png'])
    const repo2 = makeImageRepo(['img1.png', 'img2.png'])
    await buildFullPresentation({ analysis: analysis2, projectContent: pc2, images: repo2 }, null, null)
    const calls2 = slideCallHistory.flatMap((s) => s.addImage.mock.calls)
    const twoImgActualW = (calls2[0]?.[0] as { w?: number } | undefined)?.w ?? 0
    const twoImgY0 = (calls2[0]?.[0] as { y?: number } | undefined)?.y ?? 0
    const twoImgY1 = (calls2[1]?.[0] as { y?: number } | undefined)?.y ?? 0
    const twoImgX0 = (calls2[0]?.[0] as { x?: number } | undefined)?.x ?? 0
    const twoImgX1 = (calls2[1]?.[0] as { x?: number } | undefined)?.x ?? 0

    // 1 張圖全寬顯示（≥ 8"）
    expect(oneImgW).toBeGreaterThan(8.0)
    expect(calls2).toHaveLength(2)
    // 2 張圖並排（相同 y，不同 x）
    expect(twoImgY0).toBe(twoImgY1)
    expect(twoImgX1).toBeGreaterThan(twoImgX0)
    // 每張圖夠寬（≥ 3.5"）
    expect(twoImgActualW).toBeGreaterThan(3.5)
  })

  it('投影片標題標示專案名稱，且不把 itemNo 當 PROJECT CODE', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '2.1', name: '核心系統' }])
    const pc = makeProjectContentWithImages('2.1', [])
    await buildFullPresentation({ analysis, projectContent: pc, images: new Map() }, null, null)
    const allTextCalls = slideCallHistory.flatMap((s) =>
      s.addText.mock.calls.map((c) => String(c[0]))
    )
    expect(allTextCalls.some((t) => t.includes('PROJECT CODE'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('PROJECT CODE  2.1'))).toBe(false)
    expect(allTextCalls.some((t) => t.includes('核心系統'))).toBe(true)
  })

  it('四大成果區文字與 URL 內容可顯示', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const item: ProjectItem = {
      rowIndex: 0, rawItemNo: '1.0', normalizedItemNo: '1.0', itemType: 'main',
      data: {
        '已完成工作事項_描述': '完成工作',
        '預計完成工作_描述': '預計工作',
        'UIX執行成果_文字/連結描述': 'UIX 說明 https://example.com/uix',
        '執行成果_文字/連結描述': '一般成果 https://example.com/result',
      },
      imageRefs: [],
    }
    const pc: ProjectContentResult = {
      sheetFound: true, alternativeSheetFound: false, totalRows: 1,
      mainCount: 1, childCount: 0, invalidCount: 0, duplicateCount: 0,
      orphanChildCount: 0, items: [item], detectedHeaders: [], issues: [],
    }

    await buildFullPresentation({ analysis, projectContent: pc, images: new Map() }, null, null)
    const allTextCalls = slideCallHistory.flatMap((s) =>
      s.addText.mock.calls.map((c) => String(c[0]))
    )
    expect(allTextCalls.some((t) => t.includes('已完成工作事項'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('預計完成工作'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('UIX執行成果'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('執行成果'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('UIX 說明'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('一般成果'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('查看 UIX執行成果'))).toBe(true)
    expect(allTextCalls.some((t) => t.includes('查看 執行成果'))).toBe(true)
  })

  it('中文檔名與大小寫差異依 basename lowercase 規則嵌入', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['folder/成果圖.PNG'])
    const repo = new Map<string, Uint8Array>([['成果圖.png', new Uint8Array([1, 2, 3])]])
    await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    const imageSlideCalls = slideCallHistory.reduce(
      (acc, s) => acc + s.addImage.mock.calls.length, 0
    )
    expect(imageSlideCalls).toBeGreaterThanOrEqual(1)
  })

  it('圖片 Data URL 失敗時顯示檔名占位且不空白', async () => {
    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['bad.png'])
    const invalidRepo = new Map<string, Uint8Array | undefined>([['bad.png', undefined]])
    const result = await buildFullPresentation(
      { analysis, projectContent: pc, images: invalidRepo as ReadonlyMap<string, Uint8Array> },
      null, null
    )
    const allTextCalls = slideCallHistory.flatMap((s) =>
      s.addText.mock.calls.map((c) => String(c[0]))
    )
    expect(result.warnings.some((w) => w.code === 'PROJECT_IMAGE_DATA_INVALID')).toBe(true)
    expect(allTextCalls.some((t) => t.includes('圖片未成功載入：bad.png'))).toBe(true)
  })

  it('addImage 失敗時顯示占位並產生 render warning', async () => {
    mockInstanceP.addSlide.mockImplementation(() => {
      const s = createTrackedSlide()
      s.addImage.mockImplementationOnce(() => {
        throw new Error('render failed')
      })
      slideCallHistory.push(s)
      return s
    })

    const analysis = makeAnalysis([{ mainItemNo: '1.0' }])
    const pc = makeProjectContentWithImages('1.0', ['render.png'])
    const repo = makeImageRepo(['render.png'])
    const result = await buildFullPresentation({ analysis, projectContent: pc, images: repo }, null, null)
    const allTextCalls = slideCallHistory.flatMap((s) =>
      s.addText.mock.calls.map((c) => String(c[0]))
    )
    expect(result.warnings.some((w) => w.code === 'PROJECT_IMAGE_RENDER_FAILED')).toBe(true)
    expect(allTextCalls.some((t) => t.includes('圖片未成功載入：render.png'))).toBe(true)
  })
})
