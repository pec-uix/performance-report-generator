import { describe, expect, it } from 'vitest'
import type { NormalizedWorkRecord, QuarterDateRanges, WorkCategory } from '@/types/analysis'
import type { PresentationScope } from '@/types/presentationScope'
import { buildPresentationAnalysis } from '@/services/presentationAnalysisService'

function record(
  workDate: string,
  moduleKey: string | undefined,
  workCategory: WorkCategory,
  hours: number,
  employeeKey = 'EMP001'
): NormalizedWorkRecord {
  return {
    sourceRow: 1,
    workDate,
    employeeKey,
    moduleKey,
    moduleName: moduleKey,
    workCategory,
    projectKey: workCategory === 'project' ? moduleKey : undefined,
    maintenanceKey: workCategory === 'maintenance' ? moduleKey : undefined,
    hours,
  }
}

const S1: QuarterDateRanges = {
  cumulative: { start: '2025-12-01', end: '2026-03-31' },
  quarter: { start: '2025-12-01', end: '2026-03-31' },
}

const S2: QuarterDateRanges = {
  cumulative: { start: '2025-12-01', end: '2026-07-31' },
  quarter: { start: '2026-04-01', end: '2026-07-31' },
}

const S3: QuarterDateRanges = {
  cumulative: { start: '2025-12-01', end: '2026-11-30' },
  quarter: { start: '2026-08-01', end: '2026-11-30' },
}

function makeScope(): PresentationScope {
  const main = {
    itemNo: '1',
    itemType: 'main' as const,
    stableItemId: '20220506',
    projectCode: '20220506',
    projectName: 'UNI',
    sourceType: 'project' as const,
    moduleKey: '20220506(UNI)',
    sourceRow: 3,
    content: {
      rowIndex: 0,
      rawItemNo: '1',
      normalizedItemNo: '1',
      itemType: 'main' as const,
      data: {},
      imageRefs: [],
    },
    matchStatus: 'exact' as const,
  }
  const child = {
    itemNo: '1-1',
    parentItemNo: '1',
    itemType: 'child' as const,
    stableItemId: '202304119',
    projectCode: '202304119',
    projectName: 'UNI維運',
    sourceType: 'maintenance' as const,
    moduleKey: '202304119(UNI維運)',
    sourceRow: 4,
    content: {
      rowIndex: 1,
      rawItemNo: '1-1',
      normalizedItemNo: '1-1',
      parentItemNo: '1',
      itemType: 'child' as const,
      data: {},
      imageRefs: [],
    },
    matchStatus: 'exact' as const,
  }
  return {
    items: [main, child],
    mainItems: [main],
    childItems: [child],
    orderedMainItemIds: ['1'],
    allowedStableItemIds: new Set(['20220506', '202304119']),
    issues: [],
  }
}

describe('buildPresentationAnalysis', () => {
  it('S1 只產生一張工時圖資料', () => {
    const result = buildPresentationAnalysis([record('2026-01-01', 'UNI', 'project', 8)], S1)
    expect(result.moduleWorkHoursCharts).toHaveLength(1)
  })

  it('S2 產生累計與當季兩份工時資料', () => {
    const result = buildPresentationAnalysis([record('2026-04-01', 'UNI', 'project', 8)], S2)
    expect(result.moduleWorkHoursCharts.map((chart) => chart.periodType)).toEqual(['cumulative', 'quarter'])
  })

  it('S3 產生累計與當季兩份工時資料', () => {
    const result = buildPresentationAnalysis([record('2026-08-01', 'UNI', 'project', 8)], S3)
    expect(result.moduleWorkHoursCharts.map((chart) => chart.periodType)).toEqual(['cumulative', 'quarter'])
  })

  it('S2 累計包含 2025-12-01，當季排除 2026-03-31 且包含 2026-04-01', () => {
    const result = buildPresentationAnalysis([
      record('2025-12-01', 'UNI', 'project', 10),
      record('2026-03-31', 'AI', 'project', 20),
      record('2026-04-01', 'OPS', 'maintenance', 30),
    ], S2)
    const cumulative = result.moduleWorkHoursCharts[0]
    const quarter = result.moduleWorkHoursCharts[1]
    expect(cumulative.totalHours).toBe(60)
    expect(quarter.totalHours).toBe(30)
    expect(quarter.items.map((item) => item.moduleKey)).toEqual(['OPS'])
  })

  it('模組工時總和等於期間 totalHours 且 ratio 正確', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', 'UNI', 'project', 30),
      record('2026-04-02', 'AI', 'project', 70),
    ], S2)
    const quarter = result.moduleWorkHoursCharts[1]
    expect(quarter.items.reduce((sum, item) => sum + item.hours, 0)).toBe(quarter.totalHours)
    expect(quarter.items.find((item) => item.moduleKey === 'AI')?.ratio).toBe(0.7)
  })

  it('0 工時模組不顯示', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', 'ZERO', 'project', 0),
      record('2026-04-02', 'UNI', 'project', 8),
    ], S2)
    expect(result.moduleWorkHoursCharts[1].items.map((item) => item.moduleKey)).toEqual(['UNI'])
  })

  it('未標記模組工時不遺失且無資料不產生 NaN', () => {
    const result = buildPresentationAnalysis([record('2026-04-01', undefined, 'other', 5)], S2)
    const item = result.moduleWorkHoursCharts[1].items[0]
    expect(item.displayName).toBe('未標記模組')
    expect(item.hours).toBe(5)
    expect(Number.isNaN(item.ratio)).toBe(false)
  })

  it('明細 fallback 以期間工時比例計算模組人力，不使用占位假資料', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', 'UNI', 'project', 8),
      record('2026-04-01', 'AI', 'project', 8),
    ], S2)
    expect(result.workforceConfigured).toBe(true)
    expect(result.sourceStatus?.workforce).toBe('detail-fallback')
    expect(result.moduleWorkforce.every((item) => item.workforce === 0.5)).toBe(true)
    expect(result.moduleWorkforce.every((item) => item.calculationStatus === 'confirmed')).toBe(true)
  })

  it('月份排序正確且缺少月份建立 0 工時月份', () => {
    const result = buildPresentationAnalysis([
      record('2025-12-01', 'UNI', 'project', 8),
      record('2026-02-01', 'OPS', 'maintenance', 4),
    ], S1)
    expect(result.monthlyWorkTypes.map((item) => item.month)).toEqual([
      '2025/12',
      '2026/01',
      '2026/02',
      '2026/03',
    ])
    expect(result.monthlyWorkTypes[1].totalHours).toBe(0)
  })

  it('每月 project / maintenance / other 加總正確', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', 'UNI', 'project', 8),
      record('2026-04-02', 'OPS', 'maintenance', 4),
      record('2026-04-03', 'ADMIN', 'other', 2),
    ], S2)
    const april = result.monthlyWorkTypes.find((item) => item.month === '2026/04')
    expect(april?.projectHours).toBe(8)
    expect(april?.maintenanceHours).toBe(4)
    expect(april?.otherHours).toBe(2)
    expect(april?.totalHours).toBe(14)
  })

  it('明細 fallback 以專案加維運為分母產生 confirmed ratio 與人力', () => {
    const result = buildPresentationAnalysis([record('2026-04-01', 'UNI', 'project', 8)], S2)
    const april = result.monthlyWorkTypes.find((item) => item.month === '2026/04')
    expect(result.monthlyRatioBasis).toBe('project-and-maintenance-only')
    expect(result.sourceStatus?.projectMaintenance).toBe('detail-fallback')
    expect(april?.projectRatio).toBe(1)
    expect(april?.maintenanceRatio).toBe(0)
    expect(april?.otherRatio).toBeNull()
    expect(april?.projectWorkforce).toBe(1)
    expect(april?.maintenanceWorkforce).toBe(0)
    expect(april?.workforceStatus).toBe('confirmed')
  })

  it('S2 明細 fallback 工時總和保留累計 31533.5 與當季 14579.5', () => {
    const result = buildPresentationAnalysis([
      record('2025-12-01', 'UNI', 'project', 16954),
      record('2026-04-01', 'AI', 'project', 14579.5),
    ], S2)
    expect(result.sourceStatus?.workHours).toBe('detail-fallback')
    expect(result.moduleWorkHoursCharts[0].totalHours).toBe(31533.5)
    expect(result.moduleWorkHoursCharts[1].totalHours).toBe(14579.5)
  })

  it('S1 明細 fallback 可依確認公式重現模組人力', () => {
    const result = buildPresentationAnalysis([
      record('2025-12-01', 'UNI', 'project', 913.5, 'EMP001'),
      record('2025-12-01', 'AI視覺風險管理', 'project', 592, 'EMP002'),
      record('2025-12-01', '請假', 'other', 342.5, 'EMP003'),
      record('2025-12-01', 'EGG', 'project', 332.5, 'EMP004'),
      record('2025-12-01', 'OTHER', 'other', 548, 'EMP005'),
      record('2025-12-01', 'OTHER', 'other', 548, 'EMP006'),
      record('2025-12-01', 'OTHER', 'other', 548, 'EMP007'),
      record('2025-12-01', 'OTHER', 'other', 548.5, 'EMP008'),
    ], S1)
    const byName = new Map(result.moduleWorkforce.map((item) => [item.displayName, item.workforce]))
    expect(byName.get('UNI')).toBe(1.6712)
    expect(byName.get('AI視覺風險管理')).toBe(1.083)
    expect(byName.get('請假')).toBe(0.6266)
    expect(byName.get('EGG')).toBe(0.6083)
  })

  it('S1 明細 fallback 可重現每月專案維運占比與人力', () => {
    const result = buildPresentationAnalysis([
      record('2025-12-01', 'P-DEC', 'project', 2000, 'EMP001'),
      record('2025-12-01', 'P-DEC', 'project', 2000, 'EMP002'),
      record('2025-12-01', 'P-DEC', 'project', 2000, 'EMP003'),
      record('2025-12-01', 'P-DEC', 'project', 1893, 'EMP004'),
      record('2025-12-01', 'M-DEC', 'maintenance', 500, 'EMP005'),
      record('2025-12-01', 'M-DEC', 'maintenance', 500, 'EMP006'),
      record('2025-12-01', 'M-DEC', 'maintenance', 500, 'EMP007'),
      record('2025-12-01', 'M-DEC', 'maintenance', 607, 'EMP008'),
      record('2026-01-01', 'P-JAN', 'project', 2000, 'EMP001'),
      record('2026-01-01', 'P-JAN', 'project', 2000, 'EMP002'),
      record('2026-01-01', 'P-JAN', 'project', 2000, 'EMP003'),
      record('2026-01-01', 'P-JAN', 'project', 1399, 'EMP004'),
      record('2026-01-01', 'M-JAN', 'maintenance', 650, 'EMP005'),
      record('2026-01-01', 'M-JAN', 'maintenance', 650, 'EMP006'),
      record('2026-01-01', 'M-JAN', 'maintenance', 650, 'EMP007'),
      record('2026-01-01', 'M-JAN', 'maintenance', 651, 'EMP008'),
    ], S1)
    const dec = result.monthlyWorkTypes.find((item) => item.month === '2025/12')
    const jan = result.monthlyWorkTypes.find((item) => item.month === '2026/01')
    expect(dec?.projectRatio).toBe(0.7893)
    expect(dec?.maintenanceRatio).toBe(0.2107)
    expect(dec?.projectWorkforce).toBe(6.3144)
    expect(dec?.maintenanceWorkforce).toBe(1.6856)
    expect(jan?.projectRatio).toBe(0.7399)
    expect(jan?.maintenanceRatio).toBe(0.2601)
    expect(jan?.projectWorkforce).toBe(5.9192)
    expect(jan?.maintenanceWorkforce).toBe(2.0808)
  })

  it('明細 fallback 可使用人員清單確認的有效人數，而非期間 active employeeKey 數', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', 'UNI', 'project', 75, 'EMP001'),
      record('2026-04-01', 'OPS', 'maintenance', 25, 'EMP002'),
    ], S2, undefined, { effectivePeopleCount: 8 })
    const april = result.monthlyWorkTypes.find((item) => item.month === '2026/04')
    expect(result.moduleWorkforce.find((item) => item.displayName === 'UNI')?.workforce).toBe(6)
    expect(april?.projectWorkforce).toBe(6)
    expect(april?.maintenanceWorkforce).toBe(2)
    expect(april?.effectiveWorkforce).toBe(8)
  })

  it('白名單專案工時圖只含 scope 主項並合併子項，不含行政請假與白名單外專案', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', '20220506(UNI)', 'project', 80),
      record('2026-04-02', '202304119(UNI維運)', 'maintenance', 20),
      record('2026-04-03', '0101(行政事務)', 'other', 50),
      record('2026-04-04', '0201(請假)', 'other', 30),
      record('2026-04-05', 'OUTSIDE', 'project', 90),
    ], S2, undefined, { effectivePeopleCount: 8, presentationScope: makeScope() })
    const scopeChart = result.presentationScopeAnalysis?.moduleWorkHoursCharts[1]
    expect(scopeChart?.totalHours).toBe(100)
    expect(scopeChart?.items).toHaveLength(1)
    expect(scopeChart?.items[0]).toMatchObject({ displayName: 'UNI', hours: 100, ratio: 1 })
    expect(scopeChart?.items.some((item) => item.displayName.includes('行政'))).toBe(false)
    expect(scopeChart?.items.some((item) => item.displayName.includes('請假'))).toBe(false)
    expect(scopeChart?.items.some((item) => item.displayName.includes('OUTSIDE'))).toBe(false)
  })

  it('完整工時圖不限制白名單，保留前端有效模組與行政請假訓練研究類別', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', '20220506(UNI)', 'project', 80),
      record('2026-04-02', '202304119(UNI維運)', 'maintenance', 20),
      record('2026-04-03', '0101(行政事務)', 'other', 50),
      record('2026-04-04', '0201(請假)', 'other', 30),
      record('2026-04-05', '0301(教育訓練)', 'other', 10),
      record('2026-04-06', '0401(技術研討)', 'other', 5),
      record('2026-04-07', '0501(AI研究與應用)', 'other', 4),
      record('2026-04-08', 'OUTSIDE', 'project', 90),
    ], S2, undefined, { effectivePeopleCount: 8, presentationScope: makeScope() })

    const fullQuarterChart = result.moduleWorkHoursCharts[1]
    expect(fullQuarterChart.totalHours).toBe(289)
    expect(fullQuarterChart.items.map((item) => item.displayName)).toEqual(expect.arrayContaining([
      '20220506(UNI)',
      '202304119(UNI維運)',
      '0101(行政事務)',
      '0201(請假)',
      '0301(教育訓練)',
      '0401(技術研討)',
      '0501(AI研究與應用)',
      'OUTSIDE',
    ]))
    expect(result.presentationScopeAnalysis?.moduleWorkHoursCharts[1].totalHours).toBe(100)
  })

  it('PPT 工時圖只使用白名單專案加五類共用工時，不含其他白名單外模組', () => {
    const result = buildPresentationAnalysis([
      record('2025-12-01', '20220506(UNI)', 'project', 40),
      record('2026-04-01', '20220506(UNI)', 'project', 80),
      record('2026-04-02', '202304119(UNI維運)', 'maintenance', 20),
      record('2026-04-03', '0101(行政事務)', 'other', 50),
      record('2026-04-04', '0201(請假)', 'other', 30),
      record('2026-04-05', '0301(教育訓練)', 'other', 10),
      record('2026-04-06', '0401(技術研討)', 'other', 5),
      record('2026-04-07', '0501(AI研究與應用)', 'other', 4),
      record('2026-04-08', 'OUTSIDE', 'project', 90),
      record('2026-04-09', '0601(其他非保留共用)', 'other', 70),
    ], S2, undefined, { effectivePeopleCount: 8, presentationScope: makeScope() })

    const cumulative = result.presentationWorkHoursCharts?.[0]
    const quarter = result.presentationWorkHoursCharts?.[1]
    expect(cumulative?.totalHours).toBe(239)
    expect(quarter?.totalHours).toBe(199)
    expect(quarter?.items.map((item) => item.displayName)).toEqual([
      'UNI',
      '0101(行政事務)',
      '0201(請假)',
      '0301(教育訓練)',
      '0401(技術研討)',
      '0501(AI研究與應用)',
    ])
    expect(quarter?.items.some((item) => item.displayName.includes('OUTSIDE'))).toBe(false)
    expect(quarter?.items.some((item) => item.displayName.includes('其他非保留共用'))).toBe(false)
    expect(quarter?.items.reduce((sum, item) => sum + item.hours, 0)).toBe(quarter?.totalHours)
    expect(quarter?.items.reduce((sum, item) => sum + item.ratio, 0)).toBeCloseTo(1, 10)
    expect(result.presentationScopeAnalysis?.moduleWorkHoursCharts[1].totalHours).toBe(100)
    expect(result.moduleWorkHoursCharts[1].totalHours).toBe(359)
  })

  it('專案維運月圖仍使用前端整體 project + maintenance，不受白名單限制且排除 other 比例分母', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', '20220506(UNI)', 'project', 80),
      record('2026-04-02', '202304119(UNI維運)', 'maintenance', 20),
      record('2026-04-03', 'OUTSIDE', 'project', 100),
      record('2026-04-04', '0101(行政事務)', 'other', 50),
    ], S2, undefined, { effectivePeopleCount: 8, presentationScope: makeScope() })
    const april = result.monthlyWorkTypes.find((item) => item.month === '2026/04')
    expect(april?.projectHours).toBe(180)
    expect(april?.maintenanceHours).toBe(20)
    expect(april?.otherHours).toBe(50)
    expect(april?.projectRatio).toBe(0.9)
    expect(april?.maintenanceRatio).toBe(0.1)
    expect(april?.otherRatio).toBeNull()
    expect(april?.projectWorkforce).toBe(7.2)
    expect(april?.maintenanceWorkforce).toBe(0.8)
  })

  it('同一 moduleKey 出現多個 category 時保留工時並產生 warning', () => {
    const result = buildPresentationAnalysis([
      record('2026-04-01', 'SHARED', 'project', 8),
      record('2026-04-02', 'SHARED', 'maintenance', 4),
    ], S2)
    const item = result.moduleWorkHoursCharts[1].items[0]
    expect(item.hours).toBe(12)
    expect(item.categoryConflict).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'PRESENTATION_MODULE_CATEGORY_CONFLICT')).toBe(true)
  })
})
