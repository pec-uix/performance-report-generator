/**
 * revenueCalculator.spec.ts
 * 測試收入績效計算（保守原則）。
 */

import { describe, it, expect } from 'vitest'
import { calculateRevenue } from '@/services/revenueCalculator'
import type { RevenueRecord, ProjectGroupAnalysis, ProjectAnalysis } from '@/types/analysis'

function makeGroup(mainItemNo: string, hours: number): ProjectGroupAnalysis {
  const p: ProjectAnalysis = {
    itemNo: mainItemNo, itemType: 'main',
    cumulativeHours: hours, quarterHours: 0,
    cumulativePeopleCount: 0, quarterPeopleCount: 0, revenue: null,
  }
  return {
    mainItemNo, mainProject: p, children: [],
    cumulativeHours: hours, quarterHours: 0,
    cumulativePeopleCount: 0, quarterPeopleCount: 0, revenue: null,
  }
}

describe('calculateRevenue', () => {
  it('revenueFieldFound=false 時 configured=false，所有金額為 null', () => {
    const r = calculateRevenue({
      revenueRecords: [],
      revenueFieldFound: false,
      projectGroups: [],
      totalCumulativeHours: 100,
      totalQuarterHours: 40,
    })
    expect(r.configured).toBe(false)
    expect(r.cumulativeRevenue).toBeNull()
    expect(r.quarterRevenue).toBeNull()
    expect(r.revenuePerHour).toBeNull()
  })

  it('收入欄位存在但記錄為空時 configured=false', () => {
    const r = calculateRevenue({
      revenueRecords: [],
      revenueFieldFound: true,
      projectGroups: [],
      totalCumulativeHours: 100,
      totalQuarterHours: 40,
    })
    expect(r.configured).toBe(false)
  })

  it('有效收入記錄時 configured=true', () => {
    const records: RevenueRecord[] = [{ revenueAmount: 1000000 }]
    const r = calculateRevenue({
      revenueRecords: records,
      revenueFieldFound: true,
      projectGroups: [],
      totalCumulativeHours: 100,
      totalQuarterHours: 40,
    })
    expect(r.configured).toBe(true)
    expect(r.cumulativeRevenue).toBe(1000000)
  })

  it('不對年度收入做季度分攤（quarterRevenue 為 null）', () => {
    const records: RevenueRecord[] = [{ revenueAmount: 12000000 }]
    const r = calculateRevenue({
      revenueRecords: records,
      revenueFieldFound: true,
      projectGroups: [],
      totalCumulativeHours: 1000,
      totalQuarterHours: 400,
    })
    // 不應自動將年度收入除以某係數
    expect(r.quarterRevenue).toBeNull()
  })

  it('revenuePerHour = cumulativeRevenue / totalCumulativeHours', () => {
    const records: RevenueRecord[] = [{ revenueAmount: 100000 }]
    const r = calculateRevenue({
      revenueRecords: records,
      revenueFieldFound: true,
      projectGroups: [],
      totalCumulativeHours: 1000,
      totalQuarterHours: 0,
    })
    expect(r.revenuePerHour).toBeCloseTo(100)
  })

  it('totalCumulativeHours = 0 時 revenuePerHour 為 null（不產生除以零）', () => {
    const records: RevenueRecord[] = [{ revenueAmount: 100000 }]
    const r = calculateRevenue({
      revenueRecords: records,
      revenueFieldFound: true,
      projectGroups: [],
      totalCumulativeHours: 0,
      totalQuarterHours: 0,
    })
    expect(r.revenuePerHour).toBeNull()
    expect(isNaN(r.revenuePerHour as number)).toBe(false)
  })

  it('inputOutputRatio 不自動計算（需明確成本口徑）', () => {
    const records: RevenueRecord[] = [{ revenueAmount: 1000000 }]
    const r = calculateRevenue({
      revenueRecords: records,
      revenueFieldFound: true,
      projectGroups: [makeGroup('1', 100)],
      totalCumulativeHours: 100,
      totalQuarterHours: 40,
    })
    expect(r.inputOutputRatio).toBeNull()
  })

  it('所有收入金額均為 null 時 configured=false', () => {
    const records: RevenueRecord[] = [{ revenueAmount: null }]
    const r = calculateRevenue({
      revenueRecords: records,
      revenueFieldFound: true,
      projectGroups: [],
      totalCumulativeHours: 100,
      totalQuarterHours: 40,
    })
    expect(r.configured).toBe(false)
    expect(r.cumulativeRevenue).toBeNull()
  })
})
