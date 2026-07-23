import type { NormalizedWorkRecord } from '@/types/analysis'
import type { PresentationScope } from '@/types/presentationScope'
import type {
  HourlyRateSettings,
  ProjectCostBreakdown,
  ProjectOrganizationHours,
} from '@/types/projectCost'

const ORG_INFORMATION_SERVICE = '資訊服務組'
const ORG_FRONTEND_DEVELOPMENT = '前端開發課'
const ORG_BACKEND_DEVELOPMENT = '後端開發課'

function isValidRate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function hasCompleteHourlyRateSettings(settings?: HourlyRateSettings): settings is Required<HourlyRateSettings> {
  return !!settings &&
    isValidRate(settings.informationService) &&
    isValidRate(settings.frontendDevelopment) &&
    isValidRate(settings.backendDevelopment)
}

function makeEmptyHours(): ProjectOrganizationHours {
  return {
    informationServiceHours: 0,
    frontendDevelopmentHours: 0,
    backendDevelopmentHours: 0,
  }
}

function addHours(target: ProjectOrganizationHours, organization: string | undefined, hours: number): void {
  if (organization === ORG_INFORMATION_SERVICE) {
    target.informationServiceHours += hours
  } else if (organization === ORG_FRONTEND_DEVELOPMENT) {
    target.frontendDevelopmentHours += hours
  } else if (organization === ORG_BACKEND_DEVELOPMENT) {
    target.backendDevelopmentHours += hours
  }
}

export function buildProjectCostHoursByItemNo(
  records: readonly NormalizedWorkRecord[],
  scope?: PresentationScope
): Record<string, ProjectOrganizationHours> {
  const result: Record<string, ProjectOrganizationHours> = {}
  if (!scope) return result

  const moduleToMainItemNo = new Map<string, string>()
  for (const item of scope.mainItems) {
    if (item.moduleKey && item.matchStatus !== 'unmatched') {
      moduleToMainItemNo.set(item.moduleKey, item.itemNo)
    }
  }
  for (const child of scope.childItems) {
    if (child.moduleKey && child.parentItemNo && child.matchStatus !== 'unmatched') {
      moduleToMainItemNo.set(child.moduleKey, child.parentItemNo)
    }
  }

  for (const record of records) {
    const moduleKey = record.projectKey ?? record.maintenanceKey ?? record.moduleKey
    if (!moduleKey) continue
    const mainItemNo = moduleToMainItemNo.get(moduleKey)
    if (!mainItemNo) continue
    result[mainItemNo] ??= makeEmptyHours()
    addHours(result[mainItemNo], record.organization, record.hours)
  }

  return result
}

export function calculateProjectCostBreakdown(
  hours: ProjectOrganizationHours | undefined,
  annualRevenue: number | null,
  workHoursStatus: 'matched' | 'zero-hours' | 'unmatched',
  hourlyRates?: HourlyRateSettings
): ProjectCostBreakdown {
  const resolvedHours = hours ?? makeEmptyHours()

  if (workHoursStatus === 'unmatched') {
    return {
      ...resolvedHours,
      annualRevenue: annualRevenue ?? undefined,
      calculationStatus: 'unmatched-work-hours',
    }
  }

  if (!hasCompleteHourlyRateSettings(hourlyRates)) {
    return {
      ...resolvedHours,
      annualRevenue: annualRevenue ?? undefined,
      calculationStatus: 'missing-hourly-rates',
    }
  }

  const informationServiceCost =
    resolvedHours.informationServiceHours * hourlyRates.informationService
  const frontendDevelopmentCost =
    resolvedHours.frontendDevelopmentHours * hourlyRates.frontendDevelopment
  const backendDevelopmentCost =
    resolvedHours.backendDevelopmentHours * hourlyRates.backendDevelopment
  const totalCost = informationServiceCost + frontendDevelopmentCost + backendDevelopmentCost

  const base = {
    ...resolvedHours,
    informationServiceRate: hourlyRates.informationService,
    informationServiceCost,
    frontendDevelopmentRate: hourlyRates.frontendDevelopment,
    frontendDevelopmentCost,
    backendDevelopmentRate: hourlyRates.backendDevelopment,
    backendDevelopmentCost,
    totalCost,
    annualRevenue: annualRevenue ?? undefined,
  }

  if (annualRevenue === null) {
    return {
      ...base,
      calculationStatus: 'missing-revenue',
    }
  }

  return {
    ...base,
    performance: annualRevenue - totalCost,
    calculationStatus: 'calculated',
  }
}
