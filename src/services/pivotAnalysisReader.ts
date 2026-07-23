import type { ParsedWorkbookSheet } from '@/types/excel'
import type {
  ModuleWorkforceResult,
  ModuleWorkHoursChartResult,
  ModuleWorkHoursDistribution,
  MonthlyWorkTypeResult,
  PivotFreshnessResult,
  PresentationAnalysisResult,
} from '@/types/presentationAnalysis'
import type { QuarterDateRanges } from '@/types/analysis'
import type { QuarterKey } from '@/types/report'
import type { ValidationIssue } from '@/types/validation'

const SHEET_WORK_HOURS = '1.工時比例分析'
const SHEET_WORKFORCE = '2.人力比例分析'
const SHEET_PROJECT_MAINTENANCE = '3.專案v.s.維運佔比分析'
const FRONTEND_ORGANIZATION = '前端開發課'

interface PivotRow {
  values: unknown[]
}

export interface PivotAnalysisReadResult {
  presentationAnalysis: PresentationAnalysisResult | null
  freshness: PivotFreshnessResult
  issues: ValidationIssue[]
}

interface PivotReadOptions {
  selectedSemester: QuarterKey
  detailTotalHours: number
}

function text(value: unknown): string {
  return String(value ?? '').replace(/\u3000/g, ' ').trim()
}

function num(value: unknown): number | null {
  const raw = text(value).replace(/,/g, '')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function makeIssue(
  code: string,
  severity: ValidationIssue['severity'],
  message: string,
  sheetName?: string
): ValidationIssue {
  return {
    code,
    severity,
    source: 'analysis',
    message,
    sheet: sheetName,
  }
}

function rows(sheet: ParsedWorkbookSheet | undefined): PivotRow[] {
  if (!sheet) return []
  return [
    { values: sheet.headers },
    ...sheet.rows.map((row) => ({ values: row })),
  ]
}

function findOrganization(rowsToCheck: PivotRow[]): string | null {
  for (const row of rowsToCheck.slice(0, 5)) {
    if (text(row.values[0]) === '組織') {
      return text(row.values[1]) || null
    }
  }
  return null
}

function validateOrganization(
  rowsToCheck: PivotRow[],
  sheetName: string,
  issues: ValidationIssue[]
): boolean {
  const org = findOrganization(rowsToCheck)
  if (org !== FRONTEND_ORGANIZATION) {
    issues.push(makeIssue(
      'PIVOT_ORGANIZATION_MISMATCH',
      'warning',
      `樞紐工作表「${sheetName}」組織篩選不是「${FRONTEND_ORGANIZATION}」，改用明細 fallback。`,
      sheetName
    ))
    return false
  }
  return true
}

function parseWorkHoursSheet(
  sheet: ParsedWorkbookSheet | undefined,
  dateRanges: QuarterDateRanges,
  issues: ValidationIssue[]
): ModuleWorkHoursChartResult[] | null {
  const sheetRows = rows(sheet)
  if (sheetRows.length === 0) return null
  if (!validateOrganization(sheetRows, SHEET_WORK_HOURS, issues)) return null

  const headerIndex = sheetRows.findIndex(
    (row) => text(row.values[0]) === '列標籤' && text(row.values[1]).includes('時數')
  )
  if (headerIndex < 0) return null

  const items: ModuleWorkHoursDistribution[] = []
  let totalHours = 0
  for (let i = headerIndex + 1; i < sheetRows.length; i++) {
    const label = text(sheetRows[i].values[0])
    const hours = num(sheetRows[i].values[1])
    if (!label) continue
    if (label === '總計') {
      totalHours = hours ?? totalHours
      break
    }
    if (hours === null || hours <= 0) continue
    items.push({
      moduleKey: label,
      displayName: label,
      hours,
      ratio: 0,
      category: 'project',
    })
  }

  if (totalHours <= 0) totalHours = items.reduce((sum, item) => sum + item.hours, 0)
  if (totalHours <= 0 || items.length === 0) return null
  const withRatio = items.map((item) => ({ ...item, ratio: item.hours / totalHours }))

  const cumulative: ModuleWorkHoursChartResult = {
    periodType: 'cumulative',
    startDate: dateRanges.cumulative.start,
    endDate: dateRanges.cumulative.end,
    totalHours,
    items: withRatio,
  }
  const samePeriod =
    dateRanges.cumulative.start === dateRanges.quarter.start &&
    dateRanges.cumulative.end === dateRanges.quarter.end
  if (samePeriod) return [cumulative]

  return [
    cumulative,
    {
      periodType: 'quarter',
      startDate: dateRanges.quarter.start,
      endDate: dateRanges.quarter.end,
      totalHours,
      items: withRatio,
    },
  ]
}

function parseWorkforceSheet(
  sheet: ParsedWorkbookSheet | undefined,
  issues: ValidationIssue[]
): ModuleWorkforceResult[] | null {
  const sheetRows = rows(sheet)
  if (sheetRows.length === 0) return null
  if (!validateOrganization(sheetRows, SHEET_WORKFORCE, issues)) return null

  const headerIndex = sheetRows.findIndex(
    (row) => text(row.values[0]) === '列標籤' && text(row.values[1]).includes('2.人力佔比')
  )
  if (headerIndex < 0) return null

  const items: ModuleWorkforceResult[] = []
  for (let i = headerIndex + 1; i < sheetRows.length; i++) {
    const label = text(sheetRows[i].values[0])
    const workforce = num(sheetRows[i].values[1])
    if (!label) continue
    if (label === '總計') break
    if (workforce === null) continue
    items.push({
      moduleKey: label,
      displayName: label,
      workforce,
      calculationStatus: 'confirmed',
    })
  }
  return items.length > 0 ? items : null
}

function parseProjectMaintenanceSheet(
  sheet: ParsedWorkbookSheet | undefined,
  issues: ValidationIssue[]
): MonthlyWorkTypeResult[] | null {
  const sheetRows = rows(sheet)
  if (sheetRows.length === 0) return null
  if (!validateOrganization(sheetRows, SHEET_PROJECT_MAINTENANCE, issues)) return null

  const headerIndex = sheetRows.findIndex(
    (row) => text(row.values[0]) === '列標籤' && text(row.values[1]) === '專案'
  )
  if (headerIndex < 0) return null

  const items: MonthlyWorkTypeResult[] = []
  for (let i = headerIndex + 1; i < sheetRows.length; i++) {
    const month = text(sheetRows[i].values[0])
    if (!month) continue
    if (month === '總計') break
    const projectRatio = num(sheetRows[i].values[1])
    const maintenanceRatio = num(sheetRows[i].values[2])
    const projectWorkforce = num(sheetRows[i].values[3])
    const maintenanceWorkforce = num(sheetRows[i].values[4])
    const effectiveWorkforce = num(sheetRows[i].values[6])
    if (
      projectRatio === null ||
      maintenanceRatio === null ||
      projectWorkforce === null ||
      maintenanceWorkforce === null
    ) {
      continue
    }
    items.push({
      month,
      projectHours: 0,
      maintenanceHours: 0,
      otherHours: 0,
      totalHours: 0,
      projectRatio,
      maintenanceRatio,
      otherRatio: null,
      ratioBasis: 'project-and-maintenance-only',
      projectWorkforce,
      maintenanceWorkforce,
      workforceStatus: 'confirmed',
      effectiveWorkforce: effectiveWorkforce ?? projectWorkforce + maintenanceWorkforce,
    })
  }

  return items.length > 0 ? items : null
}

export function readPivotPresentationAnalysis(
  parsedSheets: Readonly<Record<string, ParsedWorkbookSheet>>,
  dateRanges: QuarterDateRanges,
  options: PivotReadOptions
): PivotAnalysisReadResult {
  const issues: ValidationIssue[] = []
  const workHours = parseWorkHoursSheet(parsedSheets[SHEET_WORK_HOURS], dateRanges, issues)
  const workforce = parseWorkforceSheet(parsedSheets[SHEET_WORKFORCE], issues)
  const monthly = parseProjectMaintenanceSheet(parsedSheets[SHEET_PROJECT_MAINTENANCE], issues)
  const freshness: PivotFreshnessResult = {
    status: 'valid',
    selectedSemester: options.selectedSemester,
    expectedStartDate: dateRanges.cumulative.start,
    expectedEndDate: dateRanges.cumulative.end,
    detailTotalHours: options.detailTotalHours,
    reasons: [],
  }

  if (!workHours || !workforce || !monthly) {
    const missing: string[] = []
    if (!workHours) missing.push(SHEET_WORK_HOURS)
    if (!workforce) missing.push(SHEET_WORKFORCE)
    if (!monthly) missing.push(SHEET_PROJECT_MAINTENANCE)
    freshness.status = workHours || workforce || monthly ? 'invalid' : 'missing'
    freshness.reasons.push('pivot structure missing or invalid')
    issues.push(makeIssue(
      'PIVOT_STRUCTURE_INVALID',
      'warning',
      `樞紐分析工作表缺失或格式不符：${missing.join('、')}。`,
    ))
    issues.push(makeIssue(
      'PIVOT_STALE_DATA_FALLBACK',
      'warning',
      `樞紐分析工作表缺失或格式不符：${missing.join('、')}。Presentation 圖表改用明細 fallback。`
    ))
    return { presentationAnalysis: null, freshness, issues }
  }

  const pivotTotalHours = workHours[0]?.totalHours ?? 0
  const difference = pivotTotalHours - options.detailTotalHours
  freshness.pivotTotalHours = pivotTotalHours
  freshness.difference = difference

  if (Math.abs(difference) > 0.001) {
    freshness.status = 'stale'
    freshness.reasons.push('pivot total hours mismatch selected semester detail total hours')
    issues.push(makeIssue(
      'PIVOT_TOTAL_HOURS_MISMATCH',
      'warning',
      `樞紐工時總計 ${pivotTotalHours}H 與目前 ${options.selectedSemester} 明細總工時 ${options.detailTotalHours}H 不一致，改用明細重算。`,
      SHEET_WORK_HOURS
    ))
    issues.push(makeIssue(
      'PIVOT_STALE_DATA_FALLBACK',
      'warning',
      `樞紐資料疑似未更新至 ${options.selectedSemester}，Presentation 圖表改用明細 fallback。`
    ))
    return { presentationAnalysis: null, freshness, issues }
  }

  return {
    presentationAnalysis: {
      moduleWorkHoursCharts: workHours,
      moduleWorkforce: workforce,
      monthlyWorkTypes: monthly,
      workforceConfigured: true,
      monthlyRatioBasis: 'project-and-maintenance-only',
      monthlyPeriod: dateRanges.cumulative,
      pivotFreshness: freshness,
      sourceStatus: {
        workHours: 'pivot',
        workforce: 'pivot',
        projectMaintenance: 'pivot',
        organization: FRONTEND_ORGANIZATION,
      },
      issues,
    },
    freshness,
    issues,
  }
}
