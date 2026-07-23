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

import {
  buildModuleWorkHoursLayout,
  buildModuleWorkforceOption,
  buildModuleWorkHoursOption,
  buildMonthlyProjectMaintenanceOption,
  buildMonthlyWorkTypeOption,
  buildWorkTypePieOption,
  getChartDisplayName,
  renderModuleWorkHoursChart,
  renderMonthlyProjectMaintenanceChart,
  renderMonthlyWorkTypeChart,
  renderWorkTypePieChart,
} from '@/services/chartRenderer'

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

describe('Phase 6A-2 chartRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChart.getDataURL.mockReturnValue('data:image/png;base64,testbase64data')
  })

  const moduleChart = {
    periodType: 'quarter' as const,
    startDate: '2026-04-01',
    endDate: '2026-07-31',
    totalHours: 100,
    items: [
      { moduleKey: 'UNI', displayName: 'UNI', hours: 60, ratio: 0.6, category: 'project' as const },
      { moduleKey: 'ADMIN', displayName: '行政事務', hours: 40, ratio: 0.4, category: 'other' as const },
    ],
  }

  it('圖表顯示名稱會移除 project code，但不改資料比對鍵', () => {
    expect(getChartDisplayName('20220506(團購網&UNI團購網系統優化)')).toBe('團購網&UNI團購網系統優化')
    expect(getChartDisplayName('202606001(AI視覺風險管理平台)')).toBe('AI視覺風險管理平台')
    expect(getChartDisplayName('202312031 EDVP教育訓練影音平台維運')).toBe('EDVP教育訓練影音平台維運')

    const option = buildModuleWorkHoursOption({
      ...moduleChart,
      items: [
        {
          moduleKey: '20220506',
          displayName: '20220506(團購網&UNI團購網系統優化)',
          hours: 60,
          ratio: 0.6,
          category: 'project' as const,
        },
      ],
    }) as { series: Array<{ data: Array<{ name: string }> }> }
    expect(option.series[0].data[0].name).toBe('團購網&UNI團購網系統優化')
    expect(moduleChart.items[0].moduleKey).toBe('UNI')
  })

  it('模組工時圖 option 使用模組名稱、工時與比例', () => {
    const option = buildModuleWorkHoursOption(moduleChart) as {
      series: Array<{ type: string; radius: number[]; data: Array<{ name: string; value: number; ratio: number }> }>
    }
    expect(option.series[0].type).toBe('pie')
    expect(option.series[0].radius).toEqual([100, 178])
    expect(option.series[0].data[0]).toMatchObject({ name: 'UNI', value: 60, ratio: 0.6 })
  })

  it('模組工時圖無資料時回傳 null', () => {
    expect(buildModuleWorkHoursOption({ ...moduleChart, totalHours: 0, items: [] })).toBeNull()
  })

  it('人力公式未設定時不產生假長條圖', () => {
    const option = buildModuleWorkforceOption([
      { moduleKey: 'UNI', displayName: 'UNI', workforce: null, calculationStatus: 'not-configured' },
    ])
    expect(option).toBeNull()
  })

  it('人力公式確認時產生水平長條圖並使用兩位小數標籤', () => {
    const option = buildModuleWorkforceOption([
      { moduleKey: 'UNI', displayName: '20220506(團購網&UNI團購網系統優化)', workforce: 1.6712, calculationStatus: 'confirmed' },
      { moduleKey: 'AI', displayName: 'AI視覺風險管理', workforce: 1.083, calculationStatus: 'confirmed' },
    ]) as {
      yAxis: { type: string; data: string[] }
      series: Array<{
        type: string
        data: number[]
        label: { formatter: (params: { name?: string; value?: number }) => string; backgroundColor?: string }
      }>
    }
    expect(option.yAxis.type).toBe('category')
    expect(option.series[0].type).toBe('bar')
    expect(option.series[0].data).toEqual([1.6712, 1.083])
    expect(option.yAxis.data[0]).toBe('團購網&UNI團購網系統優化')
    expect(option.series[0].label.formatter({ name: 'UNI', value: 1.6712 })).toBe('UNI, 1.67')
    expect(option.series[0].label.backgroundColor).toBeUndefined()
  })

  it('ratio 未確認時 monthly option 仍是工時長條圖', () => {
    const option = buildMonthlyWorkTypeOption([
      {
        month: '2026/04',
        projectHours: 8,
        maintenanceHours: 4,
        otherHours: 2,
        totalHours: 14,
        projectRatio: null,
        maintenanceRatio: null,
        otherRatio: null,
        ratioBasis: 'unconfirmed',
        projectWorkforce: null,
        maintenanceWorkforce: null,
        workforceStatus: 'not-configured',
      },
    ]) as { series: Array<{ name: string; type: string }> }
    expect(option.series.map((series) => series.name)).toEqual(['專案工時', '維運工時', '其他工時'])
    expect(option.series.every((series) => series.type === 'bar')).toBe(true)
  })

  it('renderer 失敗時不拋出且仍 dispose、移除 DOM', () => {
    mockChart.getDataURL.mockImplementationOnce(() => {
      throw new Error('render failed')
    })
    const beforeCount = document.body.children.length
    expect(renderModuleWorkHoursChart(moduleChart)).toBeNull()
    expect(mockChart.dispose).toHaveBeenCalledTimes(1)
    expect(document.body.children.length).toBe(beforeCount)
  })

  it('monthly chart 可顯示工時長條圖', () => {
    const result = renderMonthlyWorkTypeChart([
      {
        month: '2026/04',
        projectHours: 8,
        maintenanceHours: 4,
        otherHours: 2,
        totalHours: 14,
        projectRatio: null,
        maintenanceRatio: null,
        otherRatio: null,
        ratioBasis: 'unconfirmed',
        projectWorkforce: null,
        maintenanceWorkforce: null,
        workforceStatus: 'not-configured',
      },
    ])
    expect(result).toBe('data:image/png;base64,testbase64data')
  })

  it('正式專案／維運圖使用占比與人力四個 series，不顯示 other', () => {
    const option = buildMonthlyProjectMaintenanceOption([
      {
        month: '2025/12',
        projectHours: 0,
        maintenanceHours: 0,
        otherHours: 0,
        totalHours: 0,
        projectRatio: 0.7893,
        maintenanceRatio: 0.2107,
        otherRatio: null,
        ratioBasis: 'project-and-maintenance-only',
        projectWorkforce: 6.3144,
        maintenanceWorkforce: 1.6856,
        workforceStatus: 'confirmed',
        effectiveWorkforce: 8,
      },
    ]) as { series: Array<{ name: string; type: string; stack: string }> }
    expect(option.series.map((series) => series.name)).toEqual([
      '佔比-專案',
      '佔比-維運',
      '人力-專案',
      '人力-維運',
    ])
    expect(option.series.every((series) => series.type === 'bar')).toBe(true)
    expect(option.series.map((series) => series.stack)).toEqual([
      'project-maintenance',
      'project-maintenance',
      'project-maintenance',
      'project-maintenance',
    ])
  })

  it('正式專案／維運圖標籤格式為百分比兩位、人力最多兩位', () => {
    const option = buildMonthlyProjectMaintenanceOption([
      {
        month: '2025/12',
        projectHours: 0,
        maintenanceHours: 0,
        otherHours: 0,
        totalHours: 0,
        projectRatio: 0.7893,
        maintenanceRatio: 0.2107,
        otherRatio: null,
        ratioBasis: 'project-and-maintenance-only',
        projectWorkforce: 6.3144,
        maintenanceWorkforce: 1.6856,
        workforceStatus: 'confirmed',
      },
    ]) as { series: Array<{ label: { formatter: (params: { value?: number }) => string } }> }
    expect(option.series[0].label.formatter({ value: 0.7893 })).toBe('78.93%')
    expect(option.series[2].label.formatter({ value: 6.3144 })).toBe('6.31')
  })

  it('正式專案／維運圖只顯示當季四個月份，每月一條含四個 segment 的 stacked bar', () => {
    const option = buildMonthlyProjectMaintenanceOption(
      ['2026/04', '2026/05', '2026/06', '2026/07'].map((month) => ({
        month,
        projectHours: 0,
        maintenanceHours: 0,
        otherHours: 0,
        totalHours: 0,
        projectRatio: 0.75,
        maintenanceRatio: 0.25,
        otherRatio: null,
        ratioBasis: 'project-and-maintenance-only' as const,
        projectWorkforce: 3,
        maintenanceWorkforce: 1,
        workforceStatus: 'confirmed' as const,
      }))
    ) as {
      yAxis: { data: string[] }
      series: Array<{ type: string; stack: string; data: number[] }>
    }

    expect(option.yAxis.data).toEqual(['2026/04', '2026/05', '2026/06', '2026/07'])
    expect(option.series).toHaveLength(4)
    expect(option.series.every((series) => series.type === 'bar')).toBe(true)
    expect(new Set(option.series.map((series) => series.stack))).toEqual(new Set(['project-maintenance']))
    expect(option.series.every((series) => series.data.length === 4)).toBe(true)
  })

  it('正式專案／維運 renderer 成功時回傳 base64', () => {
    const result = renderMonthlyProjectMaintenanceChart([
      {
        month: '2025/12',
        projectHours: 0,
        maintenanceHours: 0,
        otherHours: 0,
        totalHours: 0,
        projectRatio: 0.7893,
        maintenanceRatio: 0.2107,
        otherRatio: null,
        ratioBasis: 'project-and-maintenance-only',
        projectWorkforce: 6.3144,
        maintenanceWorkforce: 1.6856,
        workforceStatus: 'confirmed',
      },
    ])
    expect(result).toBe('data:image/png;base64,testbase64data')
  })
})

describe('buildModuleWorkHoursOption', () => {
  it('每個切片都有自繪導引線，主要切片才顯示圖上文字避免標籤擁擠', () => {
    const option = buildModuleWorkHoursOption({
      periodType: 'quarter',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      totalHours: 100,
      items: [
        { moduleKey: 'A', displayName: 'A', hours: 80, ratio: 0.8, category: 'project' },
        { moduleKey: 'B', displayName: 'B', hours: 10, ratio: 0.1, category: 'project' },
        { moduleKey: 'C', displayName: 'C', hours: 5, ratio: 0.05, category: 'project' },
        { moduleKey: 'D', displayName: 'D', hours: 1, ratio: 0.01, category: 'project' },
        { moduleKey: 'E', displayName: 'E', hours: 1, ratio: 0.01, category: 'project' },
        { moduleKey: 'F', displayName: 'F', hours: 1, ratio: 0.01, category: 'project' },
        { moduleKey: 'G', displayName: 'G', hours: 1, ratio: 0.01, category: 'project' },
        { moduleKey: 'H', displayName: 'H', hours: 0.5, ratio: 0.005, category: 'project' },
        { moduleKey: 'I', displayName: 'I', hours: 0.3, ratio: 0.003, category: 'project' },
        { moduleKey: 'J', displayName: 'J', hours: 0.1, ratio: 0.001, category: 'project' },
        { moduleKey: 'K', displayName: '202304119(小切片專案)', hours: 0.1, ratio: 0.001, category: 'project' },
      ],
    }) as {
      legend: { show: boolean; type?: string }
      graphic: Array<{ type: string; shape?: { points?: number[][] }; style?: { text?: string } }>
      series: Array<{
        label: { show: boolean }
        labelLine: { show: boolean }
        data: Array<{
          name: string
          hours: number
          ratio: number
          showLabel: boolean
          label: { show: boolean }
          labelLine: { show: boolean }
        }>
      }>
    }

    const customLines = option.graphic.filter((item) => item.type === 'polyline')
    const customTexts = option.graphic.filter((item) =>
      item.type === 'text'
      && item.style?.text !== '完整資料清單'
      && !item.style?.text?.includes('|')
    )
    expect(option.series[0].label.show).toBe(false)
    expect(option.series[0].labelLine.show).toBe(false)
    expect(option.series[0].data.every((item) => item.showLabel)).toBe(true)
    expect(option.series[0].data.every((item) => item.label.show === false && item.labelLine.show === false)).toBe(true)
    expect(customTexts).toHaveLength(option.series[0].data.length)
    expect(customLines).toHaveLength(customTexts.length)
    expect(customTexts.some((item) => item.style?.text?.includes('小切片專案'))).toBe(true)
    expect(customLines.every((item) => item.shape?.points?.length === 2)).toBe(true)
    expect(option.legend.show).toBe(false)
    expect(option.legend.type).toBeUndefined()
  })

  it('右側固定清單包含全部有工時項目，且只顯示名稱與百分比', () => {
    const items = [
      { moduleKey: 'EIP', displayName: '20220508(EIP入口網行動化)', hours: 327, ratio: 0.2519, category: 'project' as const },
      { moduleKey: 'MSM', displayName: 'MSM 2.0', hours: 199, ratio: 0.1533, category: 'project' as const },
      { moduleKey: 'UNI', displayName: '20220506 團購網&UNI團購網系統優化', hours: 172.5, ratio: 0.1329, category: 'project' as const },
    ]
    const result = {
      periodType: 'quarter',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      totalHours: 698.5,
      items,
    }
    const option = buildModuleWorkHoursOption(result) as {
      legend: { show: boolean; type?: string }
      graphic: Array<{ type: string; style?: { text?: string } }>
      series: Array<{ data: Array<{ name: string; hours: number; ratio: number }> }>
    }
    const layout = buildModuleWorkHoursLayout(result)

    expect(option.series[0].data.map((item) => item.name)).toEqual([
      'EIP入口網行動化',
      'MSM 2.0',
      '團購網&UNI團購網系統優化',
    ])
    expect(option.series[0].data.reduce((sum, item) => sum + item.hours, 0)).toBe(698.5)
    expect(option.legend.show).toBe(false)
    expect(option.legend.type).toBeUndefined()
    expect(layout.rows).toHaveLength(items.length)
    expect(layout.totalListHours).toBe(698.5)
    expect(layout.rows[0].text).toBe('EIP入口網行動化 | 25.19%')
    expect(layout.rows[2].text).toBe('團購網&UNI團購網系統優化 | 13.29%')
    for (const row of layout.rows) {
      expect(row.text).toContain(row.name)
      expect(row.text).toContain('%')
      expect(row.text).not.toContain(' H')
    }
  })

  it('固定版面讓圓餅圖區、label 區、labelLine 區與右側清單區不重疊', () => {
    const result = {
      periodType: 'cumulative' as const,
      startDate: '2026-01-01',
      endDate: '2026-07-31',
      totalHours: 465,
      items: Array.from({ length: 18 }, (_, index) => ({
        moduleKey: `M${index}`,
        displayName: `20260${index}(模組${index})`,
        hours: 40 - index,
        ratio: (40 - index) / 465,
        category: 'project' as const,
      })),
    }
    const layout = buildModuleWorkHoursLayout(result)
    const option = buildModuleWorkHoursOption(result) as {
      legend: { show: boolean; type?: string }
      series: Array<{ radius: number[]; center: number[]; data: Array<{ showLabel: boolean }> }>
    }

    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

    expect(layout.listMode).toBe('single-column')
    expect(layout.listFontSize).toBeLessThan(10.5)
    expect(layout.listFontSize).toBeGreaterThanOrEqual(9.8)
    expect(layout.listBounds.x).toBe(720)
    expect(layout.chartWidth - (layout.listBounds.x + layout.listBounds.w)).toBe(12)
    expect(layout.pieBounds.x + layout.pieBounds.w + layout.safeGap).toBeLessThanOrEqual(layout.listBounds.x)
    expect(layout.pieLabelBounds.x + layout.pieLabelBounds.w + layout.safeGap).toBeLessThanOrEqual(layout.listBounds.x)
    expect(layout.labelLineBounds.x + layout.labelLineBounds.w + layout.safeGap).toBeLessThanOrEqual(layout.listBounds.x)
    expect(option.series[0].radius).toEqual([100, 178])
    expect(option.series[0].center).toEqual([330, 224])
    expect(overlaps(layout.pieBounds, layout.listBounds)).toBe(false)
    expect(overlaps(layout.pieLabelBounds, layout.listBounds)).toBe(false)
    expect(overlaps(layout.labelLineBounds, layout.listBounds)).toBe(false)
    expect(Array.from(layout.labelPlacements.values()).every((placement) =>
      placement.x >= layout.pieLabelBounds.x
      && placement.x < layout.listBounds.x
      && placement.y >= layout.pieLabelBounds.y
      && placement.y <= layout.pieLabelBounds.y + layout.pieLabelBounds.h
    )).toBe(true)
    expect(layout.labelGraphics).toHaveLength(result.items.length)
    expect(layout.labelGraphics.every((label) => label.points.length === 2)).toBe(true)
    expect(layout.labelGraphics.every((label) =>
      label.points.every((point) => point[0] < layout.listBounds.x && point[1] >= layout.pieLabelBounds.y)
    )).toBe(true)
    for (const side of ['left', 'right'] as const) {
      const placements = Array.from(layout.labelPlacements.values())
        .filter((placement) => placement.side === side)
        .sort((a, b) => a.y - b.y)
      for (let i = 1; i < placements.length; i++) {
        expect(placements[i].y - placements[i - 1].y).toBeGreaterThanOrEqual(14)
      }
    }
    expect(layout.rows.every((row) =>
      row.bounds.x >= layout.listBounds.x
      && row.bounds.x + row.bounds.w <= layout.listBounds.x + layout.listBounds.w
      && row.bounds.y + row.bounds.h <= layout.listBounds.y + layout.listBounds.h
    )).toBe(true)
    expect(layout.rows.every((row) => row.text.includes('%') && !row.text.includes(' H'))).toBe(true)
    expect(option.legend.show).toBe(false)
    expect(option.legend.type).toBeUndefined()
    expect(option.series[0].data.every((item) => item.showLabel)).toBe(true)
  })
})
