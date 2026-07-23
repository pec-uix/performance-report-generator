/**
 * phase5NetworkGuard.spec.ts
 * 驗證 Phase 5 服務不發出任何網路請求、不寫入本地儲存。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ProjectContentResult } from '@/types/project'

// ── PptxGenJS mock ─────────────────────────────────────────────────────────

const { MockPptxNet, mockSlideNet, mockWriteNet } = vi.hoisted(() => {
  const mockSlideNet = {
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined as unknown,
  }
  const mockWriteNet = vi.fn().mockResolvedValue(new ArrayBuffer(8))
  const mockInstanceNet = {
    addSlide: vi.fn(() => mockSlideNet),
    write: mockWriteNet,
    layout: '', title: '', author: '',
  }
  const MockPptxNet = vi.fn().mockImplementation(() => mockInstanceNet)
  return { MockPptxNet, mockSlideNet, mockWriteNet }
})
vi.mock('pptxgenjs', () => ({ default: MockPptxNet }))

const { mockChartNet, mockInitNet } = vi.hoisted(() => {
  const mockChartNet = {
    setOption: vi.fn(), getDataURL: vi.fn(() => 'data:image/png;base64,NET'), dispose: vi.fn(),
  }
  const mockInitNet = vi.fn().mockReturnValue(mockChartNet)
  return { mockChartNet, mockInitNet }
})
vi.mock('echarts', () => ({ init: mockInitNet }))

const { mockLoadAsyncNet } = vi.hoisted(() => {
  const mockLoadAsyncNet = vi.fn().mockResolvedValue({ files: {} })
  return { mockLoadAsyncNet }
})
vi.mock('jszip', () => ({ default: { loadAsync: mockLoadAsyncNet } }))

import { buildFullPresentation } from '@/services/fullPptxBuilder'
import { buildImageRepository } from '@/services/imagePresentationService'

// ── 最小測試資料 ──────────────────────────────────────────────────────────

const minAnalysis: ReportAnalysisResult = {
  quarter: 'S2',
  dateRanges: {
    cumulative: { start: '2025-12-01', end: '2026-07-31' },
    quarter: { start: '2026-04-01', end: '2026-07-31' },
  },
  cumulative: {
    workHours: { totalHours: 100, projectHours: 60, maintenanceHours: 30, otherHours: 10, projectRatio: 0.6, maintenanceRatio: 0.3, otherRatio: 0.1, recordCount: 10 },
    workforce: { activePeopleCount: 2, totalHours: 100, averageHoursPerPerson: 50, projectPeopleCount: 1, maintenancePeopleCount: 1, otherPeopleCount: 0, people: [], personMonthsStatus: 'not-configured', personMonths: null },
  },
  quarterSummary: {
    workHours: { totalHours: 50, projectHours: 30, maintenanceHours: 15, otherHours: 5, projectRatio: 0.6, maintenanceRatio: 0.3, otherRatio: 0.1, recordCount: 5 },
    workforce: { activePeopleCount: 2, totalHours: 50, averageHoursPerPerson: 25, projectPeopleCount: 1, maintenancePeopleCount: 1, otherPeopleCount: 0, people: [], personMonthsStatus: 'not-configured', personMonths: null },
  },
  projectGroups: [],
  cumulativeProjectRanking: [],
  quarterProjectRanking: [],
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
  dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0, projectMappingAvailable: false, projectMappingBlocked: false, unmappedProjectHours: 0, unmappedProjectRecords: 0 },
  issues: [],
  metadata: { calculatedAt: '2026-07-23T10:00:00.000Z', sourceRowCounts: {} },
}

const emptyProjectContent: ProjectContentResult = {
  sheetFound: false, alternativeSheetFound: false, totalRows: 0,
  mainCount: 0, childCount: 0, invalidCount: 0, duplicateCount: 0,
  orphanChildCount: 0, items: [], detectedHeaders: [], issues: [],
}

// ── 網路/儲存 spy ──────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>
let xhrOpenSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  MockPptxNet.mockImplementation(() => ({
    addSlide: vi.fn(() => mockSlideNet),
    write: mockWriteNet,
    layout: '', title: '', author: '',
  }))
  mockWriteNet.mockResolvedValue(new ArrayBuffer(8))
  mockInitNet.mockReturnValue(mockChartNet)
  mockChartNet.getDataURL.mockReturnValue('data:image/png;base64,NET')

  fetchSpy = vi.fn().mockRejectedValue(new Error('fetch not allowed'))
  vi.stubGlobal('fetch', fetchSpy)

  xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
    throw new Error('XHR not allowed')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── 測試 ───────────────────────────────────────────────────────────────────

describe('phase5NetworkGuard', () => {
  it('buildFullPresentation 不呼叫 fetch', async () => {
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('buildFullPresentation 不呼叫 XMLHttpRequest.open', async () => {
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('buildFullPresentation 不呼叫 navigator.sendBeacon', async () => {
    const beaconSpy = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    expect(beaconSpy).not.toHaveBeenCalled()
  })

  it('buildFullPresentation 不開啟 WebSocket', async () => {
    const wsSpy = vi.fn()
    vi.stubGlobal('WebSocket', wsSpy)
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    expect(wsSpy).not.toHaveBeenCalled()
  })

  it('buildFullPresentation 不寫入 localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('buildFullPresentation 不寫入 sessionStorage', async () => {
    const sessionSpy = vi.spyOn(sessionStorage, 'setItem')
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    expect(sessionSpy).not.toHaveBeenCalled()
  })

  it('buildImageRepository 不呼叫 fetch（使用 arrayBuffer）', async () => {
    const mockFile = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as File
    mockLoadAsyncNet.mockResolvedValueOnce({ files: {} })
    await buildImageRepository(mockFile, [])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('buildFullPresentation 完成後 fetch 仍未被呼叫（確認無延遲請求）', async () => {
    await buildFullPresentation(
      { analysis: minAnalysis, projectContent: emptyProjectContent, images: new Map() },
      null, null
    )
    await Promise.resolve() // 等候微任務佇列
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
