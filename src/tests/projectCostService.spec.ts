import { describe, expect, it } from 'vitest'
import {
  buildProjectCostHoursByItemNo,
  calculateProjectCostBreakdown,
  hasCompleteHourlyRateSettings,
} from '@/services/projectCostService'
import type { NormalizedWorkRecord } from '@/types/analysis'
import type { PresentationScope } from '@/types/presentationScope'

function record(moduleKey: string, organization: string, hours: number): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate: '2026-04-01',
    employeeKey: 'E001',
    moduleKey,
    moduleName: moduleKey,
    organization,
    workCategory: 'project',
    projectKey: moduleKey,
    hours,
  }
}

function scope(): PresentationScope {
  const main = {
    itemNo: '1',
    itemType: 'main' as const,
    stableItemId: '20220508',
    projectCode: '20220508',
    projectName: 'EIP入口網行動化',
    sourceType: 'project' as const,
    moduleKey: '20220508(EIP入口網行動化)',
    sourceRow: 3,
    content: {
      rowIndex: 1,
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
    projectName: 'UNI團購網系統維運',
    sourceType: 'maintenance' as const,
    moduleKey: '202304119(UNI團購網系統維運)',
    sourceRow: 4,
    content: {
      rowIndex: 2,
      rawItemNo: '1-1',
      normalizedItemNo: '1-1',
      itemType: 'child' as const,
      parentItemNo: '1',
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
    allowedStableItemIds: new Set(['20220508', '202304119']),
    issues: [],
  }
}

describe('projectCostService', () => {
  it('驗證三個平均時薪需皆為有限非負數', () => {
    expect(hasCompleteHourlyRateSettings({
      informationService: 709,
      frontendDevelopment: 398,
      backendDevelopment: 433,
    })).toBe(true)
    expect(hasCompleteHourlyRateSettings({
      informationService: 709,
      frontendDevelopment: 398,
    })).toBe(false)
    expect(hasCompleteHourlyRateSettings({
      informationService: 709,
      frontendDevelopment: Number.POSITIVE_INFINITY,
      backendDevelopment: 433,
    })).toBe(false)
    expect(hasCompleteHourlyRateSettings({
      informationService: -1,
      frontendDevelopment: 398,
      backendDevelopment: 433,
    })).toBe(false)
  })

  it('依三個組織工時計算成本、總費用與績效，不先四捨五入再加總', () => {
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 69,
      frontendDevelopmentHours: 261,
      backendDevelopmentHours: 77.5,
    }, 0, 'matched', {
      informationService: 709,
      frontendDevelopment: 398,
      backendDevelopment: 433,
    })

    expect(result.informationServiceCost).toBe(48921)
    expect(result.frontendDevelopmentCost).toBe(103878)
    expect(result.backendDevelopmentCost).toBe(33557.5)
    expect(result.totalCost).toBe(186356.5)
    expect(result.annualRevenue).toBe(0)
    expect(result.performance).toBe(-186356.5)
    expect(result.calculationStatus).toBe('calculated')
  })

  it('時薪未填完整時不做部分計算', () => {
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 69,
      frontendDevelopmentHours: 261,
      backendDevelopmentHours: 77.5,
    }, 1044000, 'matched', {
      frontendDevelopment: 398,
    })
    expect(result.calculationStatus).toBe('missing-hourly-rates')
    expect(result.totalCost).toBeUndefined()
    expect(result.performance).toBeUndefined()
  })

  it('年度收入 missing 時仍計算成本但不計算績效', () => {
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 69,
      frontendDevelopmentHours: 261,
      backendDevelopmentHours: 77.5,
    }, null, 'matched', {
      informationService: 709,
      frontendDevelopment: 398,
      backendDevelopment: 433,
    })
    expect(result.calculationStatus).toBe('missing-revenue')
    expect(result.totalCost).toBe(186356.5)
    expect(result.performance).toBeUndefined()
  })

  it('未匹配工時不顯示假成本', () => {
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 0,
      frontendDevelopmentHours: 0,
      backendDevelopmentHours: 0,
    }, 1044000, 'unmatched', {
      informationService: 709,
      frontendDevelopment: 398,
      backendDevelopment: 433,
    })
    expect(result.calculationStatus).toBe('unmatched-work-hours')
    expect(result.totalCost).toBeUndefined()
  })

  it('成本工時可分別使用三個組織，並將子項併入主項', () => {
    const hours = buildProjectCostHoursByItemNo([
      record('20220508(EIP入口網行動化)', '資訊服務組', 69),
      record('20220508(EIP入口網行動化)', '前端開發課', 261),
      record('20220508(EIP入口網行動化)', '後端開發課', 77.5),
      record('202304119(UNI團購網系統維運)', '前端開發課', 10),
      record('白名單外', '前端開發課', 999),
    ], scope())

    expect(hours['1']).toEqual({
      informationServiceHours: 69,
      frontendDevelopmentHours: 271,
      backendDevelopmentHours: 77.5,
    })
  })
})
