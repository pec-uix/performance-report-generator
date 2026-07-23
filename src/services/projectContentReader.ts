/**
 * projectContentReader.ts
 * 讀取「專案內容」工作表，解析兩層表頭與項次。
 * 不在 console 輸出任何工作表內容。
 */

import * as XLSX from 'xlsx'
import type {
  ProjectItem,
  ProjectContentResult,
  ImageRef,
  LegacyContentSourceType,
  LegacyResolvedIdentity,
  LegacySlideContentRow,
} from '@/types/project'
import type { ValidationIssue } from '@/types/validation'
import type { ParsedWorkbookSheet } from '@/types/excel'
import {
  PROJECT_CONTENT_SHEET,
  PROJECT_CONTENT_LEGACY_SLIDE_SHEET,
  PROJECT_CONTENT_SHEET_ALIASES,
  IMAGE_FIELD_KEYWORDS,
  ITEM_NO_COLUMN_NAMES,
} from '@/config/requiredSheets'
import {
  PROJECT_MASTER_FIELD_MAPPING,
  MAINTENANCE_FIELD_MAPPING,
  type FieldAliasConfig,
} from '@/config/workbookFieldMappings'
import { buildTwoLayerHeaders, normalizeHeaderName } from './headerNormalizer'
import { normalizeItemNo, classifyItemNo, validateProjectItems } from './projectItemValidator'
import { resolveColumnIndex, getCellString } from './fieldResolver'

type ProjectContentSheetAlias = (typeof PROJECT_CONTENT_SHEET_ALIASES)[number]

export interface ProjectContentReaderContext {
  projectMasterSheet?: ParsedWorkbookSheet
  maintenanceSheet?: ParsedWorkbookSheet
  workModuleKeys?: ReadonlySet<string>
}

interface LegacyIdentityCandidate extends LegacyResolvedIdentity {
  sourceType: LegacyContentSourceType
}

interface LegacyColumnIndexes {
  projectName: number
  pm: number
  sectionTitle: number
  content: number
  imageFilename: number
  chartSheetName: number
}

const LEGACY_SLIDE_FIELD_ALIASES: Record<keyof LegacyColumnIndexes, FieldAliasConfig> = {
  projectName: {
    canonicalField: 'projectName',
    required: true,
    aliases: ['專案名稱'],
    configuredStatus: 'configured',
  },
  pm: {
    canonicalField: 'pm',
    required: false,
    aliases: ['PM'],
    configuredStatus: 'configured',
  },
  sectionTitle: {
    canonicalField: 'sectionTitle',
    required: false,
    aliases: ['段落標題'],
    configuredStatus: 'configured',
  },
  content: {
    canonicalField: 'content',
    required: false,
    aliases: ['內容（條列項目） Alt+Enter 換行', '內容（條列項目）\nAlt+Enter 換行'],
    configuredStatus: 'configured',
  },
  imageFilename: {
    canonicalField: 'imageFilename',
    required: false,
    aliases: ['圖片檔名'],
    configuredStatus: 'configured',
  },
  chartSheetName: {
    canonicalField: 'chartSheetName',
    required: false,
    aliases: ['圖表工作表'],
    configuredStatus: 'configured',
  },
}

function parseImageFilenames(raw: string): string[] {
  return raw
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f !== '')
}

function isImageColumn(key: string): boolean {
  return IMAGE_FIELD_KEYWORDS.some((kw) => key.includes(kw))
}

function resolveProjectContentSheet(sheetNames: string[]): {
  selectedOriginalName: string | null
  selectedAlias: ProjectContentSheetAlias | null
  matchedAliases: { alias: ProjectContentSheetAlias; originalName: string }[]
} {
  const matchedAliases: { alias: ProjectContentSheetAlias; originalName: string }[] = []
  for (const alias of PROJECT_CONTENT_SHEET_ALIASES) {
    const originalName = sheetNames.find((name) => name.trim() === alias)
    if (originalName) matchedAliases.push({ alias, originalName })
  }

  const selected = matchedAliases[0] ?? null
  return {
    selectedOriginalName: selected?.originalName ?? null,
    selectedAlias: selected?.alias ?? null,
    matchedAliases,
  }
}

function makeEmptyProjectContentResult(
  sheetFound: boolean,
  alternativeSheetFound: boolean,
  issues: ValidationIssue[],
  legacyMode = false
): ProjectContentResult {
  return {
    sheetFound,
    alternativeSheetFound,
    legacyMode,
    totalRows: 0,
    mainCount: 0,
    childCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    orphanChildCount: 0,
    items: [],
    detectedHeaders: [],
    issues,
  }
}

function getRequiredColumn(
  headers: string[],
  config: FieldAliasConfig,
  issues: ValidationIssue[],
  sheet: string
): number {
  const col = resolveColumnIndex(headers, config)
  if (col < 0) {
    issues.push({
      code: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      source: 'project-content-excel',
      message: `找不到必要欄位「${config.aliases[0]}」。`,
      sheet,
    })
  }
  return col
}

function addIdentity(
  map: Map<string, LegacyIdentityCandidate[]>,
  projectName: string,
  candidate: LegacyIdentityCandidate
): void {
  const key = normalizeHeaderName(projectName)
  if (!key) return
  const list = map.get(key) ?? []
  list.push(candidate)
  map.set(key, list)
}

function buildLegacyIdentityMap(
  context: ProjectContentReaderContext,
  issues: ValidationIssue[]
): Map<string, LegacyIdentityCandidate[]> | null {
  const identityMap = new Map<string, LegacyIdentityCandidate[]>()
  const projectSheet = context.projectMasterSheet
  const maintenanceSheet = context.maintenanceSheet

  if (!projectSheet || !maintenanceSheet) {
    issues.push({
      code: 'LEGACY_CONTENT_MASTER_SHEETS_MISSING',
      severity: 'error',
      source: 'project-content-excel',
      message: '投影片內容缺少項次欄，需同時讀取專案清單與維運清單後才能建立穩定識別。',
      reason: 'project and maintenance master sheets are required for legacy content mode',
    })
    return null
  }

  const pCode = getRequiredColumn(projectSheet.headers, PROJECT_MASTER_FIELD_MAPPING.projectCode, issues, projectSheet.originalName)
  const pName = getRequiredColumn(projectSheet.headers, PROJECT_MASTER_FIELD_MAPPING.projectName, issues, projectSheet.originalName)
  const pModule = getRequiredColumn(projectSheet.headers, PROJECT_MASTER_FIELD_MAPPING.projectModuleKey, issues, projectSheet.originalName)
  const mCode = getRequiredColumn(maintenanceSheet.headers, MAINTENANCE_FIELD_MAPPING.maintenanceCode, issues, maintenanceSheet.originalName)
  const mName = getRequiredColumn(maintenanceSheet.headers, MAINTENANCE_FIELD_MAPPING.maintenanceName, issues, maintenanceSheet.originalName)

  if (pCode < 0 || pName < 0 || pModule < 0 || mCode < 0 || mName < 0) return null

  for (let i = 0; i < projectSheet.rows.length; i++) {
    const row = projectSheet.rows[i]
    const projectName = getCellString(row, pName)
    if (!projectName) continue
    addIdentity(identityMap, projectName, {
      sourceType: 'project',
      stableItemId: getCellString(row, pCode),
      moduleKey: getCellString(row, pModule),
      matchedName: projectName,
      sourceRow: i + 2,
    })
  }

  for (let i = 0; i < maintenanceSheet.rows.length; i++) {
    const row = maintenanceSheet.rows[i]
    const maintenanceName = getCellString(row, mName)
    const maintenanceCode = getCellString(row, mCode)
    if (!maintenanceName) continue
    addIdentity(identityMap, maintenanceName, {
      sourceType: 'maintenance',
      stableItemId: maintenanceCode,
      moduleKey: maintenanceCode && maintenanceName ? `${maintenanceCode}(${maintenanceName})` : '',
      matchedName: maintenanceName,
      sourceRow: i + 2,
    })
  }

  return identityMap
}

function resolveLegacyColumns(headers: string[]): LegacyColumnIndexes {
  return {
    projectName: resolveColumnIndex(headers, LEGACY_SLIDE_FIELD_ALIASES.projectName),
    pm: resolveColumnIndex(headers, LEGACY_SLIDE_FIELD_ALIASES.pm),
    sectionTitle: resolveColumnIndex(headers, LEGACY_SLIDE_FIELD_ALIASES.sectionTitle),
    content: resolveColumnIndex(headers, LEGACY_SLIDE_FIELD_ALIASES.content),
    imageFilename: resolveColumnIndex(headers, LEGACY_SLIDE_FIELD_ALIASES.imageFilename),
    chartSheetName: resolveColumnIndex(headers, LEGACY_SLIDE_FIELD_ALIASES.chartSheetName),
  }
}

function makeLegacyImageRefs(imageFilename: string): ImageRef[] {
  const filenames = parseImageFilenames(imageFilename)
  return filenames.length > 0 ? [{ column: 'legacyGenericSection_圖片檔名', filenames }] : []
}

function isDateLikeNumberFormat(format: unknown): boolean {
  const text = String(format ?? '').toLowerCase()
  if (!text) return false
  return /(^|[^a-z])m([^a-z]|$)/.test(text) && /(^|[^a-z])d([^a-z]|$)/.test(text)
}

function resolveItemNoCellText(
  sheet: XLSX.WorkSheet,
  sourceRow: number,
  colIndex: number,
  fallback: string,
  issues: ValidationIssue[],
  selectedAlias: string
): string {
  const cellAddress = XLSX.utils.encode_cell({ r: sourceRow - 1, c: colIndex })
  const cell = sheet[cellAddress]
  const displayText = String(cell?.w ?? '').trim()
  if (
    cell &&
    typeof cell.v === 'number' &&
    isDateLikeNumberFormat(cell.z) &&
    /^\d+-\d+$/.test(displayText)
  ) {
    issues.push({
      code: 'PRESENTATION_SCOPE_ITEM_NO_DISPLAY_RESTORED',
      severity: 'warning',
      source: 'project-content-excel',
      message: `第 ${sourceRow} 列項次欄為日期格式數字，已使用顯示值「${displayText}」。`,
      row: sourceRow,
      sheet: selectedAlias,
      itemNo: displayText,
      reason: 'item number display text restored from date-formatted numeric cell',
    })
    return displayText
  }
  return fallback
}

function makeLegacyIssue(
  code: string,
  message: string,
  row: LegacySlideContentRow,
  severity: ValidationIssue['severity'],
  reason: string,
  identity?: Partial<LegacyResolvedIdentity>
): ValidationIssue {
  return {
    code,
    severity,
    source: 'project-content-excel',
    message,
    row: row.sourceRow,
    sheet: PROJECT_CONTENT_LEGACY_SLIDE_SHEET,
    projectName: row.projectName,
    sourceType: identity?.sourceType,
    stableItemId: identity?.stableItemId,
    moduleKey: identity?.moduleKey,
    matchedName: identity?.matchedName,
    reason,
  }
}

function readLegacySlideContent(
  allRows: unknown[][],
  context: ProjectContentReaderContext,
  baseIssues: ValidationIssue[]
): ProjectContentResult {
  const issues = baseIssues
  const headerRow = (allRows[0] as string[]).map((c) => normalizeHeaderName(String(c)))
  const cols = resolveLegacyColumns(headerRow)

  if (cols.projectName < 0) {
    issues.push({
      code: 'LEGACY_CONTENT_PROJECT_NAME_COLUMN_MISSING',
      severity: 'error',
      source: 'project-content-excel',
      message: '投影片內容缺少「專案名稱」欄，無法建立穩定識別。',
      sheet: PROJECT_CONTENT_LEGACY_SLIDE_SHEET,
    })
    return makeEmptyProjectContentResult(true, true, issues, true)
  }

  const identityMap = buildLegacyIdentityMap(context, issues)
  if (!identityMap) return makeEmptyProjectContentResult(true, true, issues, true)

  issues.push({
    code: 'LEGACY_CONTENT_MODE_USED',
    severity: 'warning',
    source: 'project-content-excel',
    message: '投影片內容缺少項次欄，已使用專案清單／維運清單 exact match 建立穩定識別。',
    sheet: PROJECT_CONTENT_LEGACY_SLIDE_SHEET,
  })

  const dataRows = allRows.slice(2).filter((r) =>
    (r as string[]).some((cell) => String(cell).trim() !== '')
  )
  const items: ProjectItem[] = []

  dataRows.forEach((row, idx) => {
    const rowArr = row as unknown[]
    const sourceRow = idx + 3
    const legacyRow: LegacySlideContentRow = {
      projectName: getCellString(rowArr, cols.projectName),
      pm: getCellString(rowArr, cols.pm) || undefined,
      sectionTitle: getCellString(rowArr, cols.sectionTitle) || undefined,
      content: getCellString(rowArr, cols.content) || undefined,
      imageFilename: getCellString(rowArr, cols.imageFilename) || undefined,
      chartSheetName: getCellString(rowArr, cols.chartSheetName) || undefined,
      sourceRow,
    }

    const candidates = identityMap.get(normalizeHeaderName(legacyRow.projectName)) ?? []
    if (candidates.length === 0) {
      issues.push(makeLegacyIssue(
        'LEGACY_CONTENT_PROJECT_MATCH_NOT_FOUND',
        `第 ${sourceRow} 列專案名稱「${legacyRow.projectName}」無法精確對應專案清單或維運清單。`,
        legacyRow,
        'error',
        'exact match not found'
      ))
      return
    }

    if (candidates.length > 1) {
      issues.push(makeLegacyIssue(
        'LEGACY_CONTENT_PROJECT_MATCH_AMBIGUOUS',
        `第 ${sourceRow} 列專案名稱「${legacyRow.projectName}」精確命中多筆專案／維運清單資料。`,
        legacyRow,
        'error',
        'exact match is ambiguous'
      ))
      return
    }

    const identity = candidates[0] as LegacyIdentityCandidate
    if (!identity.stableItemId) {
      issues.push(makeLegacyIssue(
        'LEGACY_CONTENT_STABLE_ID_MISSING',
        `第 ${sourceRow} 列專案名稱「${legacyRow.projectName}」已命中，但來源清單缺少穩定識別碼。`,
        legacyRow,
        'error',
        'stable item id is empty',
        identity
      ))
      return
    }

    if (!identity.moduleKey) {
      issues.push(makeLegacyIssue(
        'LEGACY_CONTENT_MODULE_MISSING',
        `第 ${sourceRow} 列專案名稱「${legacyRow.projectName}」已命中，但來源清單缺少模組鍵。`,
        legacyRow,
        'error',
        'module key is empty',
        identity
      ))
      return
    }

    if (context.workModuleKeys && !context.workModuleKeys.has(identity.moduleKey)) {
      issues.push(makeLegacyIssue(
        'LEGACY_CONTENT_WORK_HOURS_UNMATCHED',
        `第 ${sourceRow} 列模組「${identity.moduleKey}」未在工時明細模組欄精確命中，內容仍保留。`,
        legacyRow,
        'warning',
        'module key did not match work records',
        identity
      ))
    }

    const data: Record<string, unknown> = {
      專案名稱: legacyRow.projectName,
      PM: legacyRow.pm ?? '',
      legacyGenericSection_段落標題: legacyRow.sectionTitle ?? '',
      legacyGenericSection_內容: legacyRow.content ?? '',
      legacyGenericSection_圖片檔名: legacyRow.imageFilename ?? '',
      legacyGenericSection_圖表工作表: legacyRow.chartSheetName ?? '',
      legacySourceType: identity.sourceType,
      legacyStableItemId: identity.stableItemId,
      legacyModuleKey: identity.moduleKey,
      legacyMatchedName: identity.matchedName,
      legacySourceRow: String(sourceRow),
    }

    items.push({
      rowIndex: idx,
      sourceRow,
      rawItemNo: identity.stableItemId,
      normalizedItemNo: normalizeItemNo(identity.stableItemId),
      itemType: 'main',
      sourceType: identity.sourceType,
      stableItemId: identity.stableItemId,
      moduleKey: identity.moduleKey,
      displayName: legacyRow.projectName,
      legacySectionTitle: legacyRow.sectionTitle,
      legacyContent: legacyRow,
      data,
      imageRefs: legacyRow.imageFilename ? makeLegacyImageRefs(legacyRow.imageFilename) : [],
    })
  })

  const itemValidation = validateProjectItems(items)
  issues.push(...itemValidation.issues)

  return {
    sheetFound: true,
    alternativeSheetFound: true,
    legacyMode: true,
    totalRows: dataRows.length,
    mainCount: itemValidation.mainCount,
    childCount: itemValidation.childCount,
    invalidCount: itemValidation.invalidCount,
    duplicateCount: itemValidation.duplicateCount,
    orphanChildCount: itemValidation.orphanChildCount,
    items: itemValidation.items,
    detectedHeaders: Object.values(LEGACY_SLIDE_FIELD_ALIASES).map((config) => config.canonicalField),
    issues,
  }
}

export function readProjectContent(
  workbook: XLSX.WorkBook,
  context: ProjectContentReaderContext = {}
): ProjectContentResult {
  const issues: ValidationIssue[] = []

  const sheetNames = workbook.SheetNames
  const resolvedSheet = resolveProjectContentSheet(sheetNames)
  const sheetFound = resolvedSheet.selectedOriginalName !== null
  const alternativeSheetFound = resolvedSheet.matchedAliases.some(
    (match) => match.alias !== PROJECT_CONTENT_SHEET
  )

  if (!sheetFound) {
    issues.push({
      code: 'PC_MISSING_SHEET',
      severity: 'error',
      source: 'project-content-excel',
      message: `找不到必要的工作表「${PROJECT_CONTENT_SHEET}」`,
      sheet: PROJECT_CONTENT_SHEET,
    })
    return makeEmptyProjectContentResult(false, alternativeSheetFound, issues)
  }

  const originalSheetName = resolvedSheet.selectedOriginalName as string
  const selectedAlias = resolvedSheet.selectedAlias as string
  if (selectedAlias !== PROJECT_CONTENT_SHEET) {
    issues.push({
      code: 'PROJECT_CONTENT_SHEET_ALIAS_USED',
      severity: 'warning',
      source: 'project-content-excel',
      message: `已使用工作表 alias「${selectedAlias}」作為專案內容來源。`,
      sheet: selectedAlias,
    })
  }

  if (resolvedSheet.matchedAliases.length > 1) {
    const ignored = resolvedSheet.matchedAliases
      .filter((match) => match.originalName !== originalSheetName)
      .map((match) => match.alias)
    if (ignored.length > 0) {
      issues.push({
        code: 'PROJECT_CONTENT_MULTIPLE_SHEETS_FOUND',
        severity: 'warning',
        source: 'project-content-excel',
        message: `同時找到多個專案內容工作表，已使用「${selectedAlias}」，忽略：${ignored.join('、')}。`,
        sheet: selectedAlias,
      })
    }
  }

  const sheet = workbook.Sheets[originalSheetName]
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  if (allRows.length < 2) {
    issues.push({
      code: 'PC_EMPTY_SHEET',
      severity: 'error',
      source: 'project-content-excel',
      message: `工作表「${selectedAlias}」不足兩列（需要表頭列 + 資料列）`,
      sheet: selectedAlias,
    })
    return makeEmptyProjectContentResult(true, alternativeSheetFound, issues)
  }

  const groupRow = (allRows[0] as string[]).map((c) => String(c))
  const fieldRow = (allRows[1] as string[]).map((c) => String(c))
  const headerDefs = buildTwoLayerHeaders(groupRow, fieldRow)
  const detectedHeaders = headerDefs.map((h) => h.key)

  const itemNoColIndex = headerDefs.findIndex((h) => {
    const normalized = normalizeHeaderName(h.originalField)
    return (ITEM_NO_COLUMN_NAMES as readonly string[]).includes(normalized)
  })

  if (itemNoColIndex === -1) {
    issues.push({
      code: 'PC_NO_ITEM_NO_COLUMN',
      severity: 'warning',
      source: 'project-content-excel',
      message: `工作表「${selectedAlias}」中找不到項次欄位（${Array.from(ITEM_NO_COLUMN_NAMES).join('、')}）`,
      sheet: selectedAlias,
    })
    if (selectedAlias === PROJECT_CONTENT_LEGACY_SLIDE_SHEET) {
      return readLegacySlideContent(allRows, context, issues)
    }
  }

  const dataRows = allRows
    .slice(2)
    .map((row, offset) => ({ row, sourceRow: offset + 3 }))
    .filter(({ row }) => (row as string[]).some((cell) => String(cell).trim() !== ''))

  const items: ProjectItem[] = dataRows.map(({ row, sourceRow }, idx) => {
    const rawArr = row as string[]
    const fallbackItemNo = itemNoColIndex !== -1 ? String(rawArr[itemNoColIndex] ?? '') : ''
    const rawItemNo =
      itemNoColIndex !== -1
        ? resolveItemNoCellText(sheet, sourceRow, itemNoColIndex, fallbackItemNo, issues, selectedAlias)
        : ''

    const data: Record<string, unknown> = {}
    const imageRefs: ImageRef[] = []

    headerDefs.forEach((h, colIdx) => {
      const cell = String(rawArr[colIdx] ?? '')
      data[h.key] = cell

      if (isImageColumn(h.key) && cell.trim() !== '') {
        const filenames = parseImageFilenames(cell)
        if (filenames.length > 0) {
          imageRefs.push({ column: h.key, filenames })
        }
      }
    })

    const normalized = normalizeItemNo(rawItemNo)
    return {
      rowIndex: idx,
      sourceRow,
      rawItemNo,
      normalizedItemNo: normalized,
      itemType: classifyItemNo(normalized),
      data,
      imageRefs,
    }
  })

  const itemValidation = validateProjectItems(items)
  issues.push(...itemValidation.issues)

  return {
    sheetFound: true,
    alternativeSheetFound,
    legacyMode: false,
    totalRows: dataRows.length,
    mainCount: itemValidation.mainCount,
    childCount: itemValidation.childCount,
    invalidCount: itemValidation.invalidCount,
    duplicateCount: itemValidation.duplicateCount,
    orphanChildCount: itemValidation.orphanChildCount,
    items: itemValidation.items,
    detectedHeaders,
    issues,
  }
}
