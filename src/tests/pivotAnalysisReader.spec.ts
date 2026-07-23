import { describe, expect, it } from 'vitest'
import type { ParsedWorkbookSheet } from '@/types/excel'
import { readPivotPresentationAnalysis } from '@/services/pivotAnalysisReader'

function sheet(name: string, rows: unknown[][]): ParsedWorkbookSheet {
  return {
    originalName: name,
    normalizedName: name,
    headers: rows[0]?.map((value) => String(value)) ?? [],
    rowCount: Math.max(0, rows.length - 1),
    rows: rows.slice(1),
  }
}

const dateRanges = {
  cumulative: { start: '2025-12-01', end: '2026-03-31' },
  quarter: { start: '2025-12-01', end: '2026-03-31' },
}

const validOptions = {
  selectedSemester: 'S1' as const,
  detailTotalHours: 4373,
}

function makeSheets(org = '前端開發課') {
  return {
    '1.工時比例分析': sheet('1.工時比例分析', [
      ['工時日期', '(全部)'],
      ['組織', org],
      ['姓名', '(全部)'],
      ['', ''],
      ['列標籤', '加總 - 時數'],
      ['UNI', '913.5'],
      ['ART', '209.5'],
      ['EGG', '332.5'],
      ['AI視覺風險管理', '592'],
      ['請假', '342.5'],
      ['總計', '4373'],
    ]),
    '2.人力比例分析': sheet('2.人力比例分析', [
      ['工時日期', '(全部)', '', ''],
      ['組織', org, '', ''],
      ['姓名', '(全部)', '', ''],
      ['', '', '', ''],
      ['列標籤', '加總 - 2.人力佔比(年)', '加總 - 2.人力佔比(季)', '加總 - 2.人力佔比(月)'],
      ['UNI', '1.6712', '1.6712', '6.0553'],
      ['AI視覺風險管理', '1.083', '1.083', '4.2944'],
      ['請假', '0.6266', '0.6266', '2.4849'],
      ['EGG', '0.6083', '0.6083', '2.3354'],
      ['總計', '8', '8', '30.6898'],
    ]),
    '3.專案v.s.維運佔比分析': sheet('3.專案v.s.維運佔比分析', [
      ['組織', org, '', '', '', '', ''],
      ['姓名', '(全部)', '', '', '', '', ''],
      ['', '加總 - 時數', '', '加總 - 3.屏除其他人力By月佔比', '', '', ''],
      ['', '欄標籤', '', '', '', '', ''],
      ['', '佔比', '', '人力', '', '佔比 的加總', '人力 的加總'],
      ['列標籤', '專案', '維運', '專案', '維運', '', ''],
      ['2025/12', '0.7893 ', '0.2107 ', '6.3144', '1.6856', '1.0000 ', '8'],
      ['2026/01', '0.7399 ', '0.2601 ', '5.9196', '2.0804', '1.0000 ', '8'],
      ['2026/02', '0.6837 ', '0.3163 ', '5.4692', '2.5308', '1.0000 ', '8'],
      ['2026/03', '0.6654 ', '0.3346 ', '5.323', '2.677', '1.0000 ', '8'],
      ['總計', '0.7343 ', '0.2657 ', '22.2777', '7.9167', '1.0000 ', '30.1884'],
    ]),
  }
}

describe('pivotAnalysisReader', () => {
  it('可讀取三張 exact 樞紐輸出 sheet 並固定前端開發課口徑', () => {
    const result = readPivotPresentationAnalysis(makeSheets(), dateRanges, validOptions)
    expect(result.presentationAnalysis).not.toBeNull()
    expect(result.freshness.status).toBe('valid')
    expect(result.presentationAnalysis?.sourceStatus).toMatchObject({
      workHours: 'pivot',
      workforce: 'pivot',
      projectMaintenance: 'pivot',
      organization: '前端開發課',
    })
  })

  it('總計列不作為一般模組，工時圖保留全部 row label', () => {
    const analysis = readPivotPresentationAnalysis(makeSheets(), dateRanges, validOptions).presentationAnalysis
    const chart = analysis?.moduleWorkHoursCharts[0]
    expect(chart?.items.map((item) => item.displayName)).toEqual([
      'UNI',
      'ART',
      'EGG',
      'AI視覺風險管理',
      '請假',
    ])
    expect(chart?.items.some((item) => item.displayName === '總計')).toBe(false)
    expect(chart?.totalHours).toBe(4373)
  })

  it('S1 人力數值可重現', () => {
    const workforce = readPivotPresentationAnalysis(makeSheets(), dateRanges, validOptions)
      .presentationAnalysis?.moduleWorkforce ?? []
    const byName = new Map(workforce.map((item) => [item.displayName, item.workforce]))
    expect(byName.get('UNI')).toBe(1.6712)
    expect(byName.get('AI視覺風險管理')).toBe(1.083)
    expect(byName.get('請假')).toBe(0.6266)
    expect(byName.get('EGG')).toBe(0.6083)
  })

  it('S1 每月專案維運占比與人力值可重現且合計正確', () => {
    const monthly = readPivotPresentationAnalysis(makeSheets(), dateRanges, validOptions)
      .presentationAnalysis?.monthlyWorkTypes ?? []
    const dec = monthly[0]
    const jan = monthly[1]
    expect(dec.projectRatio).toBe(0.7893)
    expect(dec.maintenanceRatio).toBe(0.2107)
    expect(dec.projectWorkforce).toBe(6.3144)
    expect(dec.maintenanceWorkforce).toBe(1.6856)
    expect(Number(((dec.projectRatio ?? 0) + (dec.maintenanceRatio ?? 0)).toFixed(4))).toBe(1)
    expect(Number(((dec.projectWorkforce ?? 0) + (dec.maintenanceWorkforce ?? 0)).toFixed(4))).toBe(8)
    expect(jan.projectRatio).toBe(0.7399)
    expect(jan.maintenanceRatio).toBe(0.2601)
    expect(jan.projectWorkforce).toBe(5.9196)
    expect(jan.maintenanceWorkforce).toBe(2.0804)
  })

  it('非前端開發課口徑不使用 pivot，避免納入其他組織', () => {
    const result = readPivotPresentationAnalysis(makeSheets('資訊服務組'), dateRanges, validOptions)
    expect(result.presentationAnalysis).toBeNull()
    expect(result.issues.some((issue) => issue.code === 'PIVOT_ORGANIZATION_MISMATCH')).toBe(true)
  })

  it('不使用模糊 sheet name', () => {
    const result = readPivotPresentationAnalysis({
      ...makeSheets(),
      '1.工時比例分析 ': makeSheets()['1.工時比例分析'],
      '1.工時比例分析': undefined as never,
    }, dateRanges, validOptions)
    expect(result.presentationAnalysis).toBeNull()
  })

  it('S2 pivot 總工時 4373 對不上明細 31533.5 時判定 stale 並改用 fallback', () => {
    const result = readPivotPresentationAnalysis(makeSheets(), {
      cumulative: { start: '2025-12-01', end: '2026-07-31' },
      quarter: { start: '2026-04-01', end: '2026-07-31' },
    }, {
      selectedSemester: 'S2',
      detailTotalHours: 31533.5,
    })

    expect(result.presentationAnalysis).toBeNull()
    expect(result.freshness).toMatchObject({
      status: 'stale',
      selectedSemester: 'S2',
      pivotTotalHours: 4373,
      detailTotalHours: 31533.5,
    })
    expect(result.freshness.difference).toBeCloseTo(-27160.5, 6)
    expect(result.issues.some((issue) => issue.code === 'PIVOT_TOTAL_HOURS_MISMATCH')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'PIVOT_STALE_DATA_FALLBACK')).toBe(true)
  })
})
