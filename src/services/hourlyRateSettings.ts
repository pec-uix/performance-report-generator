import type { HourlyRateSettings } from '@/types/projectCost'

export type HourlyRateInputState = {
  informationService: string
  frontendDevelopment: string
  backendDevelopment: string
}

export const DEFAULT_HOURLY_RATE_SETTINGS: Required<HourlyRateSettings> = {
  informationService: 709,
  frontendDevelopment: 398,
  backendDevelopment: 433,
}

export function createDefaultHourlyRateInputs(): HourlyRateInputState {
  return {
    informationService: String(DEFAULT_HOURLY_RATE_SETTINGS.informationService),
    frontendDevelopment: String(DEFAULT_HOURLY_RATE_SETTINGS.frontendDevelopment),
    backendDevelopment: String(DEFAULT_HOURLY_RATE_SETTINGS.backendDevelopment),
  }
}

export function parseHourlyRateInput(value: string): number | undefined {
  const text = value.trim()
  if (!text) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function hourlyRateInputError(value: string): string {
  const text = value.trim()
  if (!text) return ''
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return '請輸入有效數字'
  if (parsed < 0) return '不可小於 0'
  return ''
}

export function resolveHourlyRateSettings(inputs: HourlyRateInputState): HourlyRateSettings | undefined {
  const settings = {
    informationService: parseHourlyRateInput(inputs.informationService),
    frontendDevelopment: parseHourlyRateInput(inputs.frontendDevelopment),
    backendDevelopment: parseHourlyRateInput(inputs.backendDevelopment),
  }
  return settings.informationService !== undefined &&
    settings.frontendDevelopment !== undefined &&
    settings.backendDevelopment !== undefined
    ? settings
    : undefined
}

export function formatHourlyRate(value: number | undefined): string {
  return value === undefined ? '—' : `NT$${value.toLocaleString('zh-TW')}／H`
}
