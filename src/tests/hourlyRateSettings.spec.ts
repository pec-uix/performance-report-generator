import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultHourlyRateInputs,
  DEFAULT_HOURLY_RATE_SETTINGS,
  formatHourlyRate,
  hourlyRateInputError,
  resolveHourlyRateSettings,
} from '@/services/hourlyRateSettings'
import { calculateProjectCostBreakdown } from '@/services/projectCostService'

describe('hourlyRateSettings', () => {
  it('初次載入時三個欄位分別為 709 / 398 / 433', () => {
    expect(createDefaultHourlyRateInputs()).toEqual({
      informationService: '709',
      frontendDevelopment: '398',
      backendDevelopment: '433',
    })
  })

  it('初次載入即顯示已啟用成本與績效計算', () => {
    const settings = resolveHourlyRateSettings(createDefaultHourlyRateInputs())
    expect(settings).toEqual(DEFAULT_HOURLY_RATE_SETTINGS)
    expect(settings).not.toBeUndefined()
  })

  it('狀態摘要顯示三個預設平均時薪', () => {
    const settings = resolveHourlyRateSettings(createDefaultHourlyRateInputs())
    expect(formatHourlyRate(settings?.informationService)).toBe('NT$709／H')
    expect(formatHourlyRate(settings?.frontendDevelopment)).toBe('NT$398／H')
    expect(formatHourlyRate(settings?.backendDevelopment)).toBe('NT$433／H')
  })

  it('初次下載 PPT 使用 709 / 398 / 433', () => {
    const settings = resolveHourlyRateSettings(createDefaultHourlyRateInputs())
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 1,
      frontendDevelopmentHours: 1,
      backendDevelopmentHours: 1,
    }, 2000, 'matched', settings)

    expect(result.informationServiceRate).toBe(709)
    expect(result.frontendDevelopmentRate).toBe(398)
    expect(result.backendDevelopmentRate).toBe(433)
    expect(result.totalCost).toBe(1540)
    expect(result.performance).toBe(460)
  })

  it('修改資訊服務組為 720 後，計算使用 720', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.informationService = '720'
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 2,
      frontendDevelopmentHours: 0,
      backendDevelopmentHours: 0,
    }, 2000, 'matched', resolveHourlyRateSettings(inputs))

    expect(result.informationServiceRate).toBe(720)
    expect(result.informationServiceCost).toBe(1440)
  })

  it('修改前端開發課為 420 後，計算使用 420', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.frontendDevelopment = '420'
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 0,
      frontendDevelopmentHours: 2,
      backendDevelopmentHours: 0,
    }, 2000, 'matched', resolveHourlyRateSettings(inputs))

    expect(result.frontendDevelopmentRate).toBe(420)
    expect(result.frontendDevelopmentCost).toBe(840)
  })

  it('修改後端開發課為 450 後，計算使用 450', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.backendDevelopment = '450'
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 0,
      frontendDevelopmentHours: 0,
      backendDevelopmentHours: 2,
    }, 2000, 'matched', resolveHourlyRateSettings(inputs))

    expect(result.backendDevelopmentRate).toBe(450)
    expect(result.backendDevelopmentCost).toBe(900)
  })

  it('可輸入小數且會用小數計算', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.frontendDevelopment = '420.5'
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 0,
      frontendDevelopmentHours: 2,
      backendDevelopmentHours: 0,
    }, 2000, 'matched', resolveHourlyRateSettings(inputs))

    expect(result.frontendDevelopmentRate).toBe(420.5)
    expect(result.frontendDevelopmentCost).toBe(841)
  })

  it('不允許負數、NaN 或 Infinity', () => {
    expect(resolveHourlyRateSettings({
      informationService: '-1',
      frontendDevelopment: '398',
      backendDevelopment: '433',
    })).toBeUndefined()
    expect(resolveHourlyRateSettings({
      informationService: 'NaN',
      frontendDevelopment: '398',
      backendDevelopment: '433',
    })).toBeUndefined()
    expect(resolveHourlyRateSettings({
      informationService: 'Infinity',
      frontendDevelopment: '398',
      backendDevelopment: '433',
    })).toBeUndefined()
    expect(hourlyRateInputError('-1')).toBe('不可小於 0')
    expect(hourlyRateInputError('NaN')).toBe('請輸入有效數字')
    expect(hourlyRateInputError('Infinity')).toBe('請輸入有效數字')
  })

  it('清空任一欄位後停止成本與績效計算', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.frontendDevelopment = ''
    const result = calculateProjectCostBreakdown({
      informationServiceHours: 1,
      frontendDevelopmentHours: 1,
      backendDevelopmentHours: 1,
    }, 2000, 'matched', resolveHourlyRateSettings(inputs))

    expect(resolveHourlyRateSettings(inputs)).toBeUndefined()
    expect(result.calculationStatus).toBe('missing-hourly-rates')
    expect(result.totalCost).toBeUndefined()
    expect(result.performance).toBeUndefined()
  })

  it('清空後不得自動補回預設值', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.backendDevelopment = ''
    resolveHourlyRateSettings(inputs)

    expect(inputs.backendDevelopment).toBe('')
  })

  it('重新初始化元件狀態後恢復預設值', () => {
    const inputs = createDefaultHourlyRateInputs()
    inputs.informationService = ''

    expect(createDefaultHourlyRateInputs()).toEqual({
      informationService: '709',
      frontendDevelopment: '398',
      backendDevelopment: '433',
    })
  })

  it('不使用 localStorage、sessionStorage 或 IndexedDB', () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem')
    const sessionSpy = vi.spyOn(window.sessionStorage, 'setItem')
    const indexedDbSpy = window.indexedDB
      ? vi.spyOn(window.indexedDB, 'open')
      : undefined

    const inputs = createDefaultHourlyRateInputs()
    inputs.informationService = '720'
    resolveHourlyRateSettings(inputs)
    inputs.informationService = ''
    resolveHourlyRateSettings(inputs)
    createDefaultHourlyRateInputs()

    expect(localSpy).not.toHaveBeenCalled()
    expect(sessionSpy).not.toHaveBeenCalled()
    if (indexedDbSpy) {
      expect(indexedDbSpy).not.toHaveBeenCalled()
    } else {
      expect(window.indexedDB).toBeUndefined()
    }

    localSpy.mockRestore()
    sessionSpy.mockRestore()
    indexedDbSpy?.mockRestore()
  })
})
