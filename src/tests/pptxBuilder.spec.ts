/**
 * pptxBuilder.spec.ts
 * PPT 產生服務測試。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { PptSlideData } from '@/types/ppt'
import { PPT_MIME_TYPE } from '@/services/pptxBuilder'

// ── PptxGenJS mock ─────────────────────────────────────────────────────────

const { MockPptxClass, getMockPptxInstance, getMockSlide } = vi.hoisted(() => {
  const createMockSlide = () => ({
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  })

  let currentSlide = createMockSlide()
  let currentPptxInstance = {
    addSlide: vi.fn(() => currentSlide),
    write: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
    layout: '',
    title: '',
    author: '',
  }

  const MockPptxClass = vi.fn(() => currentPptxInstance)

  return {
    MockPptxClass,
    getMockPptxInstance: () => currentPptxInstance,
    getMockSlide: () => currentSlide,
    _createMockSlide: createMockSlide,
    _setCurrentSlide: (s: ReturnType<typeof createMockSlide>) => { currentSlide = s },
    _setCurrentInstance: (i: typeof currentPptxInstance) => { currentPptxInstance = i },
  }
})

vi.mock('pptxgenjs', () => ({ default: MockPptxClass }))

import { preparePptSlideData, assemblePptBlob } from '@/services/pptxBuilder'

// ── 測試輔助 ──────────────────────────────────────────────────────────────

function makeWorkHours(total: number) {
  return {
    totalHours: total,
    projectHours: total * 0.6,
    maintenanceHours: total * 0.3,
    otherHours: total * 0.1,
    projectRatio: 0.6,
    maintenanceRatio: 0.3,
    otherRatio: 0.1,
    recordCount: 10,
  }
}

function makeWorkforce(count: number) {
  return {
    activePeopleCount: count,
    totalHours: 100,
    averageHoursPerPerson: count > 0 ? 20 : null,
    projectPeopleCount: count,
    maintenancePeopleCount: 0,
    otherPeopleCount: 0,
    people: [],
    personMonthsStatus: 'not-configured' as const,
    personMonths: null,
  }
}

function makeProjectGroup(mainItemNo: string, qHours: number, cHours: number) {
  return {
    mainItemNo,
    mainProject: {
      itemNo: mainItemNo,
      itemType: 'main' as const,
      projectName: `專案 ${mainItemNo}`,
      cumulativeHours: cHours,
      quarterHours: qHours,
      cumulativePeopleCount: 3,
      quarterPeopleCount: 2,
      revenue: null,
    },
    children: [],
    cumulativeHours: cHours,
    quarterHours: qHours,
    cumulativePeopleCount: 3,
    quarterPeopleCount: 2,
    revenue: null,
  }
}

function makeAnalysisResult(
  overrides: { quarterRanking?: ReturnType<typeof makeProjectGroup>[]; groups?: ReturnType<typeof makeProjectGroup>[] } = {}
): ReportAnalysisResult {
  const groups = overrides.groups ?? [
    makeProjectGroup('1', 50, 200),
    makeProjectGroup('2', 40, 180),
    makeProjectGroup('3', 30, 150),
  ]
  const quarterRanking = overrides.quarterRanking ?? [...groups].sort((a, b) => b.quarterHours - a.quarterHours)

  return {
    quarter: 'S2',
    dateRanges: {
      cumulative: { start: '2025-12-01', end: '2026-07-31' },
      quarter: { start: '2026-04-01', end: '2026-07-31' },
    },
    cumulative: {
      workHours: makeWorkHours(300),
      workforce: makeWorkforce(5),
    },
    quarterSummary: {
      workHours: makeWorkHours(120),
      workforce: makeWorkforce(4),
    },
    projectGroups: groups,
    cumulativeProjectRanking: [...groups].sort((a, b) => b.cumulativeHours - a.cumulativeHours),
    quarterProjectRanking: quarterRanking,
    revenue: {
      configured: false,
      cumulativeRevenue: null,
      quarterRevenue: null,
      revenuePerHour: null,
      inputOutputRatio: null,
      issues: [],
    },
    presentationAnalysis: {
      moduleWorkHoursCharts: [],
      moduleWorkforce: [],
      monthlyWorkTypes: [],
      workforceConfigured: false,
      monthlyRatioBasis: 'unconfirmed' as const,
      monthlyPeriod: { start: '2025-12-01', end: '2026-07-31' },
      issues: [],
    },
    dataQuality: {
      invalidDateRows: 0,
      invalidHourRows: 0,
      unmatchedPeopleRows: 0,
      unmatchedProjectRows: 0,
      unmatchedMaintenanceRows: 0,
      unclassifiedRows: 0,
      unclassifiedHours: 0,
      projectMappingAvailable: false,
      projectMappingBlocked: false,
      unmappedProjectHours: 0,
      unmappedProjectRecords: 0,
    },
    frontendPeopleCount: 5,
    issues: [],
    metadata: {
      calculatedAt: '2026-07-22T10:30:00.000Z',
      sourceRowCounts: {},
    },
  }
}

// ── preparePptSlideData 測試（純函式，不需要 mock）────────────────────────

describe('preparePptSlideData', () => {
  it('slide2 totalHours 取自 cumulative.workHours', () => {
    const result = makeAnalysisResult()
    const data = preparePptSlideData(result, null, null)
    expect(data.slide2Cumulative.totalHours).toBe(result.cumulative.workHours.totalHours)
    expect(data.slide2Cumulative.projectHours).toBe(result.cumulative.workHours.projectHours)
  })

  it('slide3 totalHours 取自 quarterSummary.workHours', () => {
    const result = makeAnalysisResult()
    const data = preparePptSlideData(result, null, null)
    expect(data.slide3Quarter.totalHours).toBe(result.quarterSummary.workHours.totalHours)
    expect(data.slide3Quarter.projectHours).toBe(result.quarterSummary.workHours.projectHours)
  })

  it('slide4 top5 取自 quarterProjectRanking', () => {
    const groups = [
      makeProjectGroup('A', 80, 300),
      makeProjectGroup('B', 70, 280),
      makeProjectGroup('C', 60, 260),
      makeProjectGroup('D', 50, 240),
      makeProjectGroup('E', 40, 220),
      makeProjectGroup('F', 30, 200),
    ]
    const result = makeAnalysisResult({ groups, quarterRanking: groups })
    const data = preparePptSlideData(result, null, null)
    // top5 第一筆應來自 quarterProjectRanking[0]
    expect(data.slide4Ranking.top5[0].mainItemNo).toBe(result.quarterProjectRanking[0].mainItemNo)
  })

  it('slide4 top5 最多 5 筆（主項次群組，非子項）', () => {
    const groups = Array.from({ length: 8 }, (_, i) => makeProjectGroup(String(i + 1), 80 - i * 5, 300 - i * 10))
    const result = makeAnalysisResult({ groups, quarterRanking: groups })
    const data = preparePptSlideData(result, null, null)
    expect(data.slide4Ranking.top5).toHaveLength(5)
    // 確認是主項次（mainItemNo），不含子項
    data.slide4Ranking.top5.forEach((row) => {
      expect(row.mainItemNo).toBeTruthy()
      expect(row.rank).toBeGreaterThanOrEqual(1)
    })
  })

  it('slide4 rank 連續從 1 到 top5.length', () => {
    const groups = Array.from({ length: 3 }, (_, i) => makeProjectGroup(String(i + 1), 50 - i * 10, 200 - i * 20))
    const result = makeAnalysisResult({ groups, quarterRanking: groups })
    const data = preparePptSlideData(result, null, null)
    expect(data.slide4Ranking.top5.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('slide5 group 數 ≤ 10 時 hasMore = false', () => {
    const groups = Array.from({ length: 5 }, (_, i) => makeProjectGroup(String(i + 1), 50, 200))
    const result = makeAnalysisResult({ groups })
    const data = preparePptSlideData(result, null, null)
    expect(data.slide5Detail.hasMore).toBe(false)
    expect(data.slide5Detail.remainingCount).toBe(0)
    expect(data.slide5Detail.displayCount).toBe(5)
  })

  it('slide5 group 數 > 10 時 hasMore = true，remainingCount 正確', () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeProjectGroup(String(i + 1), 50, 200))
    const result = makeAnalysisResult({ groups })
    const data = preparePptSlideData(result, null, null)
    expect(data.slide5Detail.hasMore).toBe(true)
    expect(data.slide5Detail.remainingCount).toBe(5)
    expect(data.slide5Detail.displayCount).toBe(10)
    expect(data.slide5Detail.totalGroups).toBe(15)
  })

  it('slide2 chartBase64 與傳入的 cumulativeChartBase64 相同', () => {
    const result = makeAnalysisResult()
    const data = preparePptSlideData(result, 'data:image/png;base64,ABC', 'data:image/png;base64,DEF')
    expect(data.slide2Cumulative.chartBase64).toBe('data:image/png;base64,ABC')
    expect(data.slide3Quarter.chartBase64).toBe('data:image/png;base64,DEF')
  })
})

// ── assemblePptBlob 測試（使用 mock PptxGenJS）───────────────────────────

describe('assemblePptBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMockPptxInstance().addSlide.mockReturnValue(getMockSlide())
    getMockPptxInstance().write.mockResolvedValue(new ArrayBuffer(8))
  })

  function makeMinimalSlideData(): PptSlideData {
    const result = makeAnalysisResult()
    return preparePptSlideData(result, null, null)
  }

  it('固定產生 5 頁（addSlide 呼叫 5 次）', async () => {
    await assemblePptBlob(makeMinimalSlideData())
    expect(getMockPptxInstance().addSlide).toHaveBeenCalledTimes(5)
  })

  it('回傳 Blob，MIME type 為 PPT_MIME_TYPE', async () => {
    const blob = await assemblePptBlob(makeMinimalSlideData())
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe(PPT_MIME_TYPE)
  })

  it('write 以 outputType: arraybuffer 呼叫', async () => {
    await assemblePptBlob(makeMinimalSlideData())
    expect(getMockPptxInstance().write).toHaveBeenCalledWith({ outputType: 'arraybuffer' })
  })

  it('slide2 addTable 包含 cumulative totalHours', async () => {
    const result = makeAnalysisResult()
    const data = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)
    const allTableCalls = getMockSlide().addTable.mock.calls
    const totalHoursStr = result.cumulative.workHours.totalHours.toFixed(1)
    const found = allTableCalls.some((call: unknown[]) =>
      JSON.stringify(call[0]).includes(totalHoursStr)
    )
    expect(found).toBe(true)
  })

  it('slide4 addTable 有 6 列（1 標題 + 5 資料）', async () => {
    const groups = Array.from({ length: 8 }, (_, i) => makeProjectGroup(String(i + 1), 80 - i * 5, 300 - i * 10))
    const result = makeAnalysisResult({ groups, quarterRanking: groups })
    const data = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)
    // 找到包含 5 筆資料行的 addTable 呼叫（header + 5）
    const allTableCalls = getMockSlide().addTable.mock.calls
    const rankingTable = allTableCalls.find((call: unknown[]) => {
      const rows = call[0] as unknown[]
      return Array.isArray(rows) && rows.length === 6 // header + 5
    })
    expect(rankingTable).toBeDefined()
  })

  it('slide5 hasMore 時 addText 包含「共N個」訊息', async () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeProjectGroup(String(i + 1), 50, 200))
    const result = makeAnalysisResult({ groups })
    const data = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)
    const allTextCalls = getMockSlide().addText.mock.calls
    const hasMoreText = allTextCalls.some((call: unknown[]) => {
      const text = call[0]
      return typeof text === 'string' && text.includes('共 15 個') && text.includes('前 10 個')
    })
    expect(hasMoreText).toBe(true)
  })

  it('write() 未回傳 ArrayBuffer 時拋出 Error', async () => {
    getMockPptxInstance().write.mockResolvedValueOnce('not-an-arraybuffer')
    await expect(assemblePptBlob(makeMinimalSlideData())).rejects.toThrow(
      'PPT 產生失敗：write() 未回傳 ArrayBuffer'
    )
  })
})
