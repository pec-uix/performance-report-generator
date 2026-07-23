/**
 * validationService.ts
 * 統一協調 Phase 2 所有驗證流程。
 * 不呼叫任何網路 API，不持久化任何資料。
 */

import type { WorkbookValidationResult } from '@/types/excel'
import type { ProjectContentResult } from '@/types/project'
import type { ParsedZipResult, ImageMatchResult } from '@/types/image'
import type { ValidationIssue } from '@/types/validation'
import { parseWorkbookFromBuffer } from './excelReader'
import { validateWorkHoursWorkbook } from './workbookValidator'
import { readProjectContent } from './projectContentReader'
import { parseZipBuffer } from './zipReader'
import { matchImages } from './imageMatcher'
import { WORK_HOURS_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'

export type ProcessingStep =
  | 'idle'
  | 'reading-work-excel'
  | 'reading-content-excel'
  | 'reading-zip'
  | 'validating-workbook'
  | 'validating-items'
  | 'matching-images'
  | 'complete'
  | 'error'

export interface ValidationState {
  step: ProcessingStep
  workbookResult: WorkbookValidationResult | null
  projectContentResult: ProjectContentResult | null
  zipResult: ParsedZipResult | null
  imageMatchResult: ImageMatchResult | null
  allIssues: ValidationIssue[]
  errorCount: number
  warningCount: number
  infoCount: number
}

export function createEmptyValidationState(): ValidationState {
  return {
    step: 'idle',
    workbookResult: null,
    projectContentResult: null,
    zipResult: null,
    imageMatchResult: null,
    allIssues: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
  }
}

function buildWorkModuleKeySet(
  workbookResult: WorkbookValidationResult | null
): ReadonlySet<string> | undefined {
  const workSheet = workbookResult?.parsedSheets['工時分析(自助)']
  if (!workSheet) return undefined
  const moduleCol = resolveColumnIndex(workSheet.headers, WORK_HOURS_FIELD_MAPPING.moduleKey)
  if (moduleCol < 0) return undefined

  const modules = new Set<string>()
  for (const row of workSheet.rows) {
    const moduleKey = getCellString(row, moduleCol)
    if (moduleKey) modules.add(moduleKey)
  }
  return modules
}

export async function runValidation(
  workExcelFile: File,
  contentExcelFile: File,
  imageZipFile: File,
  onStep: (step: ProcessingStep) => void
): Promise<ValidationState> {
  const allIssues: ValidationIssue[] = []
  let workbookResult: WorkbookValidationResult | null = null
  let projectContentResult: ProjectContentResult | null = null
  let zipResult: ParsedZipResult | null = null
  let imageMatchResult: ImageMatchResult | null = null

  // ── Step 1：讀取工時 Excel ──────────────────────────────────
  onStep('reading-work-excel')
  try {
    const workBuffer = await workExcelFile.arrayBuffer()
    onStep('validating-workbook')
    const workWorkbook = parseWorkbookFromBuffer(workBuffer)
    workbookResult = validateWorkHoursWorkbook(workWorkbook)
    allIssues.push(...workbookResult.errors, ...workbookResult.warnings, ...workbookResult.info)
  } catch {
    allIssues.push({
      code: 'WH_PARSE_FAILED',
      severity: 'error',
      source: 'work-hours-excel',
      message: '工時 Excel 解析失敗，請確認檔案格式正確。',
    })
  }

  // ── Step 2：讀取專案內容 Excel ─────────────────────────────
  onStep('reading-content-excel')
  try {
    const contentBuffer = await contentExcelFile.arrayBuffer()
    onStep('validating-items')
    const contentWorkbook = parseWorkbookFromBuffer(contentBuffer)
    projectContentResult = readProjectContent(contentWorkbook, {
      projectMasterSheet: workbookResult?.parsedSheets['專案清單'],
      maintenanceSheet: workbookResult?.parsedSheets['維運清單'],
      workModuleKeys: buildWorkModuleKeySet(workbookResult),
    })
    allIssues.push(...projectContentResult.issues)
  } catch {
    allIssues.push({
      code: 'PC_PARSE_FAILED',
      severity: 'error',
      source: 'project-content-excel',
      message: '專案內容 Excel 解析失敗，請確認檔案格式正確。',
    })
  }

  // ── Step 3：安全解析圖片 ZIP ───────────────────────────────
  onStep('reading-zip')
  try {
    const zipBuffer = await imageZipFile.arrayBuffer()
    zipResult = await parseZipBuffer(zipBuffer)
    allIssues.push(...zipResult.issues)
  } catch {
    allIssues.push({
      code: 'ZIP_FAILED',
      severity: 'error',
      source: 'image-zip',
      message: '圖片 ZIP 解析失敗，請確認檔案格式正確。',
    })
  }

  // ── Step 4：比對圖片 ──────────────────────────────────────
  if (projectContentResult && zipResult) {
    onStep('matching-images')
    imageMatchResult = matchImages(projectContentResult, zipResult)
    allIssues.push(...imageMatchResult.issues)
  }

  onStep('complete')

  const errorCount = allIssues.filter((i) => i.severity === 'error').length
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length
  const infoCount = allIssues.filter((i) => i.severity === 'info').length

  return {
    step: 'complete',
    workbookResult,
    projectContentResult,
    zipResult,
    imageMatchResult,
    allIssues,
    errorCount,
    warningCount,
    infoCount,
  }
}
