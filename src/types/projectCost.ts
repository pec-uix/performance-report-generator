export interface HourlyRateSettings {
  informationService?: number
  frontendDevelopment?: number
  backendDevelopment?: number
}

export interface ProjectOrganizationHours {
  informationServiceHours: number
  frontendDevelopmentHours: number
  backendDevelopmentHours: number
}

export interface ProjectCostBreakdown extends ProjectOrganizationHours {
  informationServiceRate?: number
  informationServiceCost?: number

  frontendDevelopmentRate?: number
  frontendDevelopmentCost?: number

  backendDevelopmentRate?: number
  backendDevelopmentCost?: number

  totalCost?: number
  annualRevenue?: number
  performance?: number

  calculationStatus:
    | 'calculated'
    | 'missing-hourly-rates'
    | 'missing-revenue'
    | 'unmatched-work-hours'
}
