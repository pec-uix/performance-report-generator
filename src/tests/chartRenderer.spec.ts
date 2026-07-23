/**
 * chartRenderer.spec.ts
 * ECharts 圖片服務測試。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkHoursSummary } from '@/types/analysis'

// ── ECharts mock（必須在 import 前 hoisted）──────────────────────────────

const { mockChart, mockInit } = vi.hoisted(() => {
  const mockChart = {
    setOption: vi.fn(),
    getDataURL: vi.fn(() => 'data:image/png;base64,testbase64data'),
    dispose: vi.fn(),
  }
  const mockInit = vi.fn().mockReturnValue(mockChart)
  return { mockChart, mockInit }
})

vi.mock('echarts', () => ({
  init: mockInit,
}))

import { buildWorkTypePieOption, renderWorkTypePieChart } from '@/services/chartRenderer'

// ── 測試輔助 ──────────────────────────────────────────────────────────────

function makeWorkHoursSummary(overrides: Partial<WorkHoursSummary> = {}): WorkHoursSummary {
  return {
    totalHours: 100,
    projectHours: 60,
    maintenanceHours: 30,
    otherHours: 10,
    projectRatio: 0.6,
    maintenanceRatio: 0.3,
    otherRatio: 0.1,
    recordCount: 20,
    ...overrides,
  }
}

// ── 測試 ──────────────────────────────────────────────────────────────────

describe('buildWorkTypePieOption', () => {
  it('series data 使用實際工時（非比率）', () => {
    const summary = makeWorkHoursSummary({ projectHours: 60, maintenanceHours: 30, otherHours: 10 })
    const option = buildWorkTypePieOption(summary) as {
      series: Array<{ data: Array<{ value: number; name: string }> }>
    }
    const data = option.series[0].data
    expect(data[0].value).toBe(60)
    expect(data[1].value).toBe(30)
    expect(data[2].value).toBe(10)
  })

  it('series data 包含 3 個分類（專案、維運、其他）', () => {
    const option = buildWorkTypePieOption(makeWorkHoursSummary()) as {
      series: Array<{ data: Array<{ value: number; name: string }> }>
    }
    const data = option.series[0].data
    expect(data).toHaveLength(3)
    expect(data.map((d) => d.name)).toEqual(['專案', '維運', '其他'])
  })
})

describe('renderWorkTypePieChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChart.getDataURL.mockReturnValue('data:image/png;base64,testbase64data')
  })

  it('totalHours = 0 回傳 null，不呼叫 echarts.init', () => {
    const result = renderWorkTypePieChart(makeWorkHoursSummary({ totalHours: 0 }))
    expect(result).toBeNull()
    expect(mockInit).not.toHaveBeenCalled()
  })

  it('totalHours > 0 呼叫 echarts.init 並傳入 DOM 元素', () => {
    renderWorkTypePieChart(makeWorkHoursSummary())
    expect(mockInit).toHaveBeenCalledTimes(1)
    const arg = mockInit.mock.calls[0][0]
    expect(arg).toBeInstanceOf(HTMLDivElement)
  })

  it('getDataURL 以 { type: png, pixelRatio: 2 } 呼叫', () => {
    renderWorkTypePieChart(makeWorkHoursSummary())
    expect(mockChart.getDataURL).toHaveBeenCalledWith({ type: 'png', pixelRatio: 2 })
  })

  it('成功時回傳 getDataURL 的字串', () => {
    const result = renderWorkTypePieChart(makeWorkHoursSummary())
    expect(result).toBe('data:image/png;base64,testbase64data')
  })

  it('成功時 dispose 並移除容器 DOM', () => {
    const beforeCount = document.body.children.length
    renderWorkTypePieChart(makeWorkHoursSummary())
    expect(mockChart.dispose).toHaveBeenCalledTimes(1)
    expect(document.body.children.length).toBe(beforeCount)
  })

  it('getDataURL 拋出錯誤時仍 dispose 並移除容器 DOM', () => {
    mockChart.getDataURL.mockImplementationOnce(() => {
      throw new Error('render failed')
    })
    const beforeCount = document.body.children.length
    expect(() => renderWorkTypePieChart(makeWorkHoursSummary())).toThrow('render failed')
    expect(mockChart.dispose).toHaveBeenCalledTimes(1)
    expect(document.body.children.length).toBe(beforeCount)
  })
})
