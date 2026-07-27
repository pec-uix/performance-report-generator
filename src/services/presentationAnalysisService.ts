import type { DateRange, NormalizedWorkRecord, QuarterDateRanges, WorkCategory } from '@/types/analysis'
import type {
  ModuleWorkHoursChartResult,
  ModuleWorkHoursDistribution,
  ModuleWorkforceResult,
  MonthlyWorkTypeResult,
  PivotFreshnessResult,
  PresentationAnalysisResult,
} from '@/types/presentationAnalysis'
import type { ValidationIssue } from '@/types/validation'
import type { PresentationScope } from '@/types/presentationScope'
import { filterRecordsByDateRange } from './quarterFilter'

const UNLABELED_MODULE_KEY = '__UNLABELED_MODULE__'
const UNLABELED_MODULE_NAME = '未標記模組'
const PRESENTATION_COMMON_WORK_LABELS = [
  'AI研究與應用',
  '教育訓練',
  '技術研討',
  '行政事務',
  '請假',
] as const

const MODULE_DISPLAY_NAME_MAPPING: Readonly<Record<string, string>> = {}

interface ModuleAccumulator {
  moduleKey: string
  displayName: string
  hours: number
  categoryHours: Record<WorkCategory, number>
}

export interface PresentationAnalysisFallbackOptions {
  effectivePeopleCount?: number
  presentationScope?: PresentationScope
}

function getModuleKey(record: NormalizedWorkRecord): string {
  return record.moduleKey?.trim() || UNLABELED_MODULE_KEY
}

function getModuleDisplayName(record: NormalizedWorkRecord): string {
  const key = getModuleKey(record)
  if (key !== UNLABELED_MODULE_KEY && MODULE_DISPLAY_NAME_MAPPING[key]) {
    return MODULE_DISPLAY_NAME_MAPPING[key]
  }
  return record.moduleName?.trim() || (key !== UNLABELED_MODULE_KEY ? key : UNLABELED_MODULE_NAME)
}

function getPresentationComparableName(record: NormalizedWorkRecord): string {
  return getModuleDisplayName(record)
    .replace(/^\d+\((.*)\)$/, '$1')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, '')
    .trim()
}

function isPresentationCommonWorkRecord(record: NormalizedWorkRecord): boolean {
  const comparable = getPresentationComparableName(record)
  return PRESENTATION_COMMON_WORK_LABELS.some((label) => comparable.includes(label))
}

function chooseCategory(categoryHours: Record<WorkCategory, number>): WorkCategory {
  const ordered: WorkCategory[] = ['project', 'maintenance', 'other']
  return ordered.reduce((best, current) => {
    if (categoryHours[current] > categoryHours[best]) return current
    return best
  }, 'project' as WorkCategory)
}

function buildModuleWorkHoursChart(
  periodType: 'cumulative' | 'quarter',
  range: DateRange,
  records: NormalizedWorkRecord[],
  issues: ValidationIssue[]
): ModuleWorkHoursChartResult {
  const moduleMap = new Map<string, ModuleAccumulator>()

  for (const record of records) {
    const key = getModuleKey(record)
    const existing = moduleMap.get(key)
    const acc = existing ?? {
      moduleKey: key,
      displayName: getModuleDisplayName(record),
      hours: 0,
      categoryHours: { project: 0, maintenance: 0, other: 0 },
    }
    acc.hours += record.hours
    acc.categoryHours[record.workCategory] += record.hours
    if (!existing) moduleMap.set(key, acc)
  }

  const totalHours = records.reduce((sum, record) => sum + record.hours, 0)
  const items: ModuleWorkHoursDistribution[] = []

  for (const acc of moduleMap.values()) {
    if (acc.hours === 0) continue
    const nonZeroCategories = (Object.keys(acc.categoryHours) as WorkCategory[]).filter(
      (category) => acc.categoryHours[category] > 0
    )
    const categoryConflict = nonZeroCategories.length > 1
    if (categoryConflict) {
      issues.push({
        code: 'PRESENTATION_MODULE_CATEGORY_CONFLICT',
        severity: 'warning',
        source: 'analysis',
        message: `模組「${acc.displayName}」在同一期間內同時出現於多個分類，圖表保留全部工時並以最大工時分類著色。`,
      })
    }
    items.push({
      moduleKey: acc.moduleKey,
      displayName: acc.displayName,
      hours: acc.hours,
      ratio: totalHours > 0 ? acc.hours / totalHours : 0,
      category: chooseCategory(acc.categoryHours),
      categoryConflict,
    })
  }

  items.sort((a, b) => b.hours - a.hours || a.displayName.localeCompare(b.displayName, 'zh-Hant'))

  return {
    periodType,
    startDate: range.start,
    endDate: range.end,
    totalHours,
    items,
  }
}

function monthKey(date: string): string {
  return date.slice(0, 7).replace('-', '/')
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function listMonths(range: DateRange): string[] {
  const [startY, startM] = range.start.split('-').map(Number)
  const [endY, endM] = range.end.split('-').map(Number)
  const months: string[] = []
  let cursor = new Date(startY, startM - 1, 1)
  const end = new Date(endY, endM - 1, 1)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    months.push(`${y}/${m}`)
    cursor = addMonths(cursor, 1)
  }
  return months
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function getEffectivePeopleCount(records: NormalizedWorkRecord[]): number {
  return new Set(records.filter((record) => record.hours > 0).map((record) => record.employeeKey)).size
}

function buildMonthlyWorkTypes(
  records: NormalizedWorkRecord[],
  range: DateRange,
  effectivePeopleCount?: number
): MonthlyWorkTypeResult[] {
  const monthMap = new Map<string, MonthlyWorkTypeResult>()
  for (const month of listMonths(range)) {
    monthMap.set(month, {
      month,
      projectHours: 0,
      maintenanceHours: 0,
      otherHours: 0,
      totalHours: 0,
      projectRatio: null,
      maintenanceRatio: null,
      otherRatio: null,
      ratioBasis: 'unconfirmed',
      projectWorkforce: null,
      maintenanceWorkforce: null,
      workforceStatus: 'not-configured',
    })
  }

  for (const record of records) {
    const month = monthKey(record.workDate)
    const entry = monthMap.get(month)
    if (!entry) continue
    if (record.workCategory === 'project') {
      entry.projectHours += record.hours
    } else if (record.workCategory === 'maintenance') {
      entry.maintenanceHours += record.hours
    } else {
      entry.otherHours += record.hours
    }
    entry.totalHours += record.hours
  }

  const recordsByMonth = new Map<string, NormalizedWorkRecord[]>()
  for (const record of records) {
    const month = monthKey(record.workDate)
    recordsByMonth.set(month, [...(recordsByMonth.get(month) ?? []), record])
  }

  for (const entry of monthMap.values()) {
    const denominator = entry.projectHours + entry.maintenanceHours
    if (denominator > 0) {
      const effectivePeople = effectivePeopleCount ?? getEffectivePeopleCount(recordsByMonth.get(entry.month) ?? [])
      entry.projectRatio = entry.projectHours / denominator
      entry.maintenanceRatio = entry.maintenanceHours / denominator
      entry.otherRatio = null
      entry.ratioBasis = 'project-and-maintenance-only'
      entry.projectWorkforce = round4((entry.projectHours / denominator) * effectivePeople)
      entry.maintenanceWorkforce = round4((entry.maintenanceHours / denominator) * effectivePeople)
      entry.workforceStatus = 'confirmed'
      entry.effectiveWorkforce = effectivePeople
    }
  }

  return Array.from(monthMap.values())
}

function buildModuleWorkforce(
  chart: ModuleWorkHoursChartResult,
  effectivePeopleCount: number
): ModuleWorkforceResult[] {
  return chart.items
    .map((item) => ({
      moduleKey: item.moduleKey,
      displayName: item.displayName,
      workforce: chart.totalHours > 0 ? round4((item.hours / chart.totalHours) * effectivePeopleCount) : null,
      calculationStatus: 'confirmed' as const,
    }))
    .sort((a, b) => (b.workforce ?? 0) - (a.workforce ?? 0) || a.displayName.localeCompare(b.displayName, 'zh-Hant'))
}

function buildScopeModuleWorkHoursChart(
  periodType: 'cumulative' | 'quarter',
  range: DateRange,
  records: NormalizedWorkRecord[],
  scope: PresentationScope,
  issues: ValidationIssue[]
): ModuleWorkHoursChartResult {
  const moduleToMain = new Map<string, { mainItemNo: string; displayName: string }>()
  const mainCategoryHours = new Map<string, Record<WorkCategory, number>>()
  const mainHours = new Map<string, number>()

  for (const main of scope.mainItems) {
    if (main.matchStatus === 'unmatched') continue
    if (main.moduleKey) {
      moduleToMain.set(main.moduleKey, { mainItemNo: main.itemNo, displayName: main.projectName })
    }
    mainCategoryHours.set(main.itemNo, { project: 0, maintenance: 0, other: 0 })
    mainHours.set(main.itemNo, 0)
  }

  for (const child of scope.childItems) {
    if (child.matchStatus === 'unmatched' || !child.moduleKey || !child.parentItemNo) continue
    const parent = scope.mainItems.find((item) => item.itemNo === child.parentItemNo)
    if (!parent) continue
    moduleToMain.set(child.moduleKey, { mainItemNo: parent.itemNo, displayName: parent.projectName })
  }

  for (const record of records) {
    if (!record.moduleKey) continue
    const mapped = moduleToMain.get(record.moduleKey)
    if (!mapped) continue
    mainHours.set(mapped.mainItemNo, (mainHours.get(mapped.mainItemNo) ?? 0) + record.hours)
    const categoryHours = mainCategoryHours.get(mapped.mainItemNo) ?? { project: 0, maintenance: 0, other: 0 }
    categoryHours[record.workCategory] += record.hours
    mainCategoryHours.set(mapped.mainItemNo, categoryHours)
  }

  const totalHours = Array.from(mainHours.values()).reduce((sum, hours) => sum + hours, 0)
  const items: ModuleWorkHoursDistribution[] = []
  for (const main of scope.mainItems) {
    const hours = mainHours.get(main.itemNo) ?? 0
    if (hours <= 0) continue
    const categoryHours = mainCategoryHours.get(main.itemNo) ?? { project: 0, maintenance: 0, other: 0 }
    const nonZeroCategories = (Object.keys(categoryHours) as WorkCategory[]).filter(
      (category) => categoryHours[category] > 0
    )
    const categoryConflict = nonZeroCategories.length > 1
    if (categoryConflict) {
      issues.push({
        code: 'PRESENTATION_MODULE_CATEGORY_CONFLICT',
        severity: 'warning',
        source: 'analysis',
        message: `白名單主項「${main.projectName}」合併子項後同時出現於多個分類，圖表保留全部工時並以最大工時分類著色。`,
      })
    }
    items.push({
      moduleKey: main.stableItemId,
      displayName: main.projectName,
      hours,
      ratio: totalHours > 0 ? hours / totalHours : 0,
      category: chooseCategory(categoryHours),
      categoryConflict,
    })
  }

  items.sort((a, b) => b.hours - a.hours || a.displayName.localeCompare(b.displayName, 'zh-Hant'))

  return {
    periodType,
    startDate: range.start,
    endDate: range.end,
    totalHours,
    items,
  }
}

function buildPresentationWorkHoursChart(
  periodType: 'cumulative' | 'quarter',
  range: DateRange,
  records: NormalizedWorkRecord[],
  scope: PresentationScope,
  issues: ValidationIssue[]
): ModuleWorkHoursChartResult {
  const moduleToMain = new Map<string, { mainItemNo: string; displayName: string }>()
  const mainCategoryHours = new Map<string, Record<WorkCategory, number>>()
  const mainHours = new Map<string, number>()
  const commonRecords: NormalizedWorkRecord[] = []

  for (const main of scope.mainItems) {
    if (main.matchStatus === 'unmatched') continue
    if (main.moduleKey) {
      moduleToMain.set(main.moduleKey, { mainItemNo: main.itemNo, displayName: main.projectName })
    }
    mainCategoryHours.set(main.itemNo, { project: 0, maintenance: 0, other: 0 })
    mainHours.set(main.itemNo, 0)
  }

  for (const child of scope.childItems) {
    if (child.matchStatus === 'unmatched' || !child.moduleKey || !child.parentItemNo) continue
    const parent = scope.mainItems.find((item) => item.itemNo === child.parentItemNo)
    if (!parent) continue
    moduleToMain.set(child.moduleKey, { mainItemNo: parent.itemNo, displayName: parent.projectName })
  }

  for (const record of records) {
    const mapped = record.moduleKey ? moduleToMain.get(record.moduleKey) : undefined
    if (mapped) {
      mainHours.set(mapped.mainItemNo, (mainHours.get(mapped.mainItemNo) ?? 0) + record.hours)
      const categoryHours = mainCategoryHours.get(mapped.mainItemNo) ?? { project: 0, maintenance: 0, other: 0 }
      categoryHours[record.workCategory] += record.hours
      mainCategoryHours.set(mapped.mainItemNo, categoryHours)
      continue
    }
    if (isPresentationCommonWorkRecord(record)) {
      commonRecords.push(record)
    }
  }

  const scopeItems: ModuleWorkHoursDistribution[] = []
  for (const main of scope.mainItems) {
    const hours = mainHours.get(main.itemNo) ?? 0
    if (hours <= 0) continue
    const categoryHours = mainCategoryHours.get(main.itemNo) ?? { project: 0, maintenance: 0, other: 0 }
    const nonZeroCategories = (Object.keys(categoryHours) as WorkCategory[]).filter(
      (category) => categoryHours[category] > 0
    )
    const categoryConflict = nonZeroCategories.length > 1
    if (categoryConflict) {
      issues.push({
        code: 'PRESENTATION_MODULE_CATEGORY_CONFLICT',
        severity: 'warning',
        source: 'analysis',
        message: `白名單主項「${main.projectName}」合併子項後同時出現於多個分類，圖表保留全部工時並以最大工時分類著色。`,
      })
    }
    scopeItems.push({
      moduleKey: main.stableItemId,
      displayName: main.projectName,
      hours,
      ratio: 0,
      category: chooseCategory(categoryHours),
      categoryConflict,
    })
  }

  const commonChart = buildModuleWorkHoursChart(periodType, range, commonRecords, issues)
  const items = [...scopeItems, ...commonChart.items]
  const totalHours = items.reduce((sum, item) => sum + item.hours, 0)
  for (const item of items) {
    item.ratio = totalHours > 0 ? item.hours / totalHours : 0
  }
  items.sort((a, b) => b.hours - a.hours || a.displayName.localeCompare(b.displayName, 'zh-Hant'))

  return {
    periodType,
    startDate: range.start,
    endDate: range.end,
    totalHours,
    items,
  }
}

export function buildPresentationAnalysis(
  allRecords: NormalizedWorkRecord[],
  dateRanges: QuarterDateRanges,
  pivotFreshness?: PivotFreshnessResult,
  options: PresentationAnalysisFallbackOptions = {}
): PresentationAnalysisResult {
  const issues: ValidationIssue[] = []
  const cumulativeRecords = filterRecordsByDateRange(allRecords, dateRanges.cumulative)
  const quarterRecords = filterRecordsByDateRange(allRecords, dateRanges.quarter)

  const cumulativeChart = buildModuleWorkHoursChart(
    'cumulative',
    dateRanges.cumulative,
    cumulativeRecords,
    issues
  )
  const quarterChart = buildModuleWorkHoursChart('quarter', dateRanges.quarter, quarterRecords, issues)

  const samePeriod =
    dateRanges.cumulative.start === dateRanges.quarter.start &&
    dateRanges.cumulative.end === dateRanges.quarter.end
  const moduleWorkHoursCharts = samePeriod ? [cumulativeChart] : [cumulativeChart, quarterChart]
  const monthlyWorkTypes = buildMonthlyWorkTypes(
    cumulativeRecords,
    dateRanges.cumulative,
    options.effectivePeopleCount
  )

  const effectivePeopleCount = options.effectivePeopleCount ?? getEffectivePeopleCount(cumulativeRecords)
  const scopeCumulativeChart = options.presentationScope
    ? buildScopeModuleWorkHoursChart(
        'cumulative',
        dateRanges.cumulative,
        cumulativeRecords,
        options.presentationScope,
        issues
      )
    : null
  const scopeQuarterChart = options.presentationScope
    ? buildScopeModuleWorkHoursChart(
        'quarter',
        dateRanges.quarter,
        quarterRecords,
        options.presentationScope,
        issues
      )
    : null
  const scopeCharts = scopeCumulativeChart
    ? samePeriod || !scopeQuarterChart
      ? [scopeCumulativeChart]
      : [scopeCumulativeChart, scopeQuarterChart]
    : undefined
  const presentationCumulativeChart = options.presentationScope
    ? buildPresentationWorkHoursChart(
        'cumulative',
        dateRanges.cumulative,
        cumulativeRecords,
        options.presentationScope,
        issues
      )
    : null
  const presentationQuarterChart = options.presentationScope
    ? buildPresentationWorkHoursChart(
        'quarter',
        dateRanges.quarter,
        quarterRecords,
        options.presentationScope,
        issues
      )
    : null
  const presentationWorkHoursCharts = presentationCumulativeChart
    ? samePeriod || !presentationQuarterChart
      ? [presentationCumulativeChart]
      : [presentationCumulativeChart, presentationQuarterChart]
    : undefined

  return {
    moduleWorkHoursCharts,
    presentationWorkHoursCharts,
    moduleWorkforce: buildModuleWorkforce(cumulativeChart, effectivePeopleCount),
    moduleWorkforceQuarter: samePeriod ? undefined : buildModuleWorkforce(quarterChart, effectivePeopleCount),
    monthlyWorkTypes,
    workforceConfigured: true,
    monthlyRatioBasis: 'project-and-maintenance-only',
    monthlyPeriod: dateRanges.cumulative,
    sourceStatus: {
      workHours: 'detail-fallback',
      workforce: 'detail-fallback',
      projectMaintenance: 'detail-fallback',
      organization: '前端開發課',
    },
    pivotFreshness,
    presentationScopeAnalysis: scopeCharts
      ? {
          moduleWorkHoursCharts: scopeCharts,
          moduleWorkforce: buildModuleWorkforce(scopeCharts[0] as ModuleWorkHoursChartResult, effectivePeopleCount),
          moduleWorkforceQuarter: scopeCharts.length > 1
            ? buildModuleWorkforce(scopeCharts[1] as ModuleWorkHoursChartResult, effectivePeopleCount)
            : undefined,
          cumulativeTotalHours: scopeCumulativeChart?.totalHours ?? 0,
          quarterTotalHours: scopeQuarterChart?.totalHours ?? scopeCumulativeChart?.totalHours ?? 0,
        }
      : undefined,
    issues,
  }
}
