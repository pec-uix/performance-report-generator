/**
 * phase4NetworkGuard.spec.ts
 * 確保 Phase 4 服務不呼叫任何網路 API 或持久化儲存。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WorkHoursSummary } from '@/types/analysis'
import type { PptSlideData } from '@/types/ppt'

// ── ECharts mock（避免 jsdom 無 Canvas 問題）────────────────────────────

const { mockChartN, mockInitN } = vi.hoisted(() => {
  const mockChartN = {
    setOption: vi.fn(),
    getDataURL: vi.fn(() => 'data:image/png;base64,NETWORKGUARDTEST'),
    dispose: vi.fn(),
  }
  const mockInitN = vi.fn().mockReturnValue(mockChartN)
  return { mockChartN, mockInitN }
})

vi.mock('echarts', () => ({ init: mockInitN }))

// PptxGenJS mock
const { MockPptxN, mockSlideN: pptMockSlideN, mockInstanceN: pptMockInstanceN } = vi.hoisted(() => {
  const mockSlideN = {
    addText: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    background: undefined,
  }
  const mockInstanceN = {
    addSlide: vi.fn().mockReturnValue(mockSlideN),
    write: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    layout: '',
    title: '',
    author: '',
  }
  const MockPptxN = vi.fn().mockImplementation(() => mockInstanceN)
  return { MockPptxN, mockSlideN, mockInstanceN }
})

vi.mock('pptxgenjs', () => ({ default: MockPptxN }))

import {
  renderModuleWorkHoursChart,
  renderMonthlyWorkTypeChart,
  renderWorkTypePieChart,
} from '@/services/chartRenderer'
import { preparePptSlideData, assemblePptBlob } from '@/services/pptxBuilder'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'

// ── 測試輔助 ──────────────────────────────────────────────────────────────

function makeBasicWorkHours(): WorkHoursSummary {
  return {
    totalHours: 100,
    projectHours: 60,
    maintenanceHours: 30,
    otherHours: 10,
    projectRatio: 0.6,
    maintenanceRatio: 0.3,
    otherRatio: 0.1,
    recordCount: 10,
  }
}

function makeMinimalResult(): ReportAnalysisResult {
  const wh = makeBasicWorkHours()
  const wf = {
    activePeopleCount: 3,
    totalHours: 100,
    averageHoursPerPerson: 33.3,
    projectPeopleCount: 2,
    maintenancePeopleCount: 1,
    otherPeopleCount: 0,
    people: [],
    personMonthsStatus: 'not-configured' as const,
    personMonths: null,
  }
  const group = {
    mainItemNo: '1',
    mainProject: {
      itemNo: '1',
      itemType: 'main' as const,
      projectName: '測試專案',
      cumulativeHours: 200,
      quarterHours: 50,
      cumulativePeopleCount: 2,
      quarterPeopleCount: 1,
      revenue: null,
    },
    children: [],
    cumulativeHours: 200,
    quarterHours: 50,
    cumulativePeopleCount: 2,
    quarterPeopleCount: 1,
    revenue: null,
  }
  return {
    quarter: 'S2',
    dateRanges: {
      cumulative: { start: '2025-12-01', end: '2026-07-31' },
      quarter: { start: '2026-04-01', end: '2026-07-31' },
    },
    cumulative: { workHours: wh, workforce: wf },
    quarterSummary: { workHours: wh, workforce: wf },
    projectGroups: [group],
    cumulativeProjectRanking: [group],
    quarterProjectRanking: [group],
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
      monthlyRatioBasis: 'unconfirmed',
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
    issues: [],
    metadata: {
      calculatedAt: '2026-07-22T10:30:00.000Z',
      sourceRowCounts: {},
    },
  }
}

// ── 網路隔離測試 ──────────────────────────────────────────────────────────

describe('Phase 4 網路隔離：無網路呼叫', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let xhrOpenSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // vi.restoreAllMocks() 會清除 vi.fn() 的 implementation，需在每次測試前重設
    mockInitN.mockReturnValue(mockChartN)
    mockChartN.getDataURL.mockReturnValue('data:image/png;base64,NETWORKGUARDTEST')
    mockChartN.setOption.mockReset()
    mockChartN.dispose.mockReset()
    MockPptxN.mockImplementation(() => pptMockInstanceN)
    pptMockInstanceN.addSlide.mockReturnValue(pptMockSlideN)
    pptMockInstanceN.write.mockResolvedValue(new ArrayBuffer(8))

    fetchSpy = vi.fn().mockRejectedValue(new Error('fetch should not be called'))
    xhrOpenSpy = vi.fn().mockImplementation(() => { throw new Error('XHR should not be called') })
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(xhrOpenSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renderWorkTypePieChart 不呼叫 fetch', () => {
    renderWorkTypePieChart(makeBasicWorkHours())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Phase 6A-2 renderer 不呼叫 fetch 或 XHR', () => {
    renderModuleWorkHoursChart({
      periodType: 'quarter',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      totalHours: 8,
      items: [{ moduleKey: 'UNI', displayName: 'UNI', hours: 8, ratio: 1, category: 'project' }],
    })
    renderMonthlyWorkTypeChart([
      {
        month: '2026/04',
        projectHours: 8,
        maintenanceHours: 0,
        otherHours: 0,
        totalHours: 8,
        projectRatio: null,
        maintenanceRatio: null,
        otherRatio: null,
        ratioBasis: 'unconfirmed',
        projectWorkforce: null,
        maintenanceWorkforce: null,
        workforceStatus: 'not-configured',
      },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('assemblePptBlob 不呼叫 fetch', async () => {
    const result = makeMinimalResult()
    const data = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('assemblePptBlob 不呼叫 XMLHttpRequest.open', async () => {
    const result = makeMinimalResult()
    const data = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('assemblePptBlob 不使用 navigator.sendBeacon', async () => {
    const beaconSpy = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })
    const result = makeMinimalResult()
    const data: PptSlideData = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)
    expect(beaconSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('Phase 4 服務不讀寫 localStorage/sessionStorage', async () => {
    const lsGetSpy = vi.spyOn(Storage.prototype, 'getItem')
    const lsSetSpy = vi.spyOn(Storage.prototype, 'setItem')
    const ssSpy = vi.spyOn(Storage.prototype, 'setItem')

    renderWorkTypePieChart(makeBasicWorkHours())
    renderModuleWorkHoursChart({
      periodType: 'quarter',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      totalHours: 8,
      items: [{ moduleKey: 'UNI', displayName: 'UNI', hours: 8, ratio: 1, category: 'project' }],
    })
    const result = makeMinimalResult()
    const data = preparePptSlideData(result, null, null)
    await assemblePptBlob(data)

    expect(lsGetSpy).not.toHaveBeenCalled()
    expect(lsSetSpy).not.toHaveBeenCalled()
    expect(ssSpy).not.toHaveBeenCalled()
  })
})
