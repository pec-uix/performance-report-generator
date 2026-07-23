/**
 * projectContentReader.ts
 * 讀取「專案內容」工作表，解析兩層表頭與項次。
 * 不在 console 輸出任何工作表內容。
 */

import * as XLSX from 'xlsx'
import type { ProjectItem, ProjectContentResult, ImageRef } from '@/types/project'
import type { ValidationIssue } from '@/types/validation'
import {
  PROJECT_CONTENT_SHEET,
  PROJECT_CONTENT_ALTERNATIVE_SHEET,
  IMAGE_FIELD_KEYWORDS,
  ITEM_NO_COLUMN_NAMES,
} from '@/config/requiredSheets'
import { buildTwoLayerHeaders, normalizeHeaderName } from './headerNormalizer'
import { normalizeItemNo, classifyItemNo, validateProjectItems } from './projectItemValidator'

/**
 * 解析逗號分隔的圖片檔名清單
 */
function parseImageFilenames(raw: string): string[] {
  return raw
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f !== '')
}

/**
 * 判斷欄位鍵是否為圖片欄位
 */
function isImageColumn(key: string): boolean {
  return IMAGE_FIELD_KEYWORDS.some((kw) => key.includes(kw))
}

export function readProjectContent(workbook: XLSX.WorkBook): ProjectContentResult {
  const issues: ValidationIssue[] = []

  const sheetNames = workbook.SheetNames
  const normalizedNames = sheetNames.map((n) => n.trim())

  const sheetFound = normalizedNames.includes(PROJECT_CONTENT_SHEET)
  const alternativeSheetFound = normalizedNames.includes(PROJECT_CONTENT_ALTERNATIVE_SHEET)

  if (!sheetFound) {
    issues.push({
      code: 'PC_MISSING_SHEET',
      severity: 'error',
      source: 'project-content-excel',
      message: `找不到必要的工作表「${PROJECT_CONTENT_SHEET}」`,
      sheet: PROJECT_CONTENT_SHEET,
    })
    return {
      sheetFound: false,
      alternativeSheetFound,
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

  // 找到原始工作表名稱（保留前後空白的原始名）
  const originalSheetName =
    sheetNames.find((n) => n.trim() === PROJECT_CONTENT_SHEET) ?? PROJECT_CONTENT_SHEET

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
      message: `工作表「${PROJECT_CONTENT_SHEET}」不足兩列（需要表頭列 + 資料列）`,
      sheet: PROJECT_CONTENT_SHEET,
    })
    return {
      sheetFound: true,
      alternativeSheetFound,
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

  // ── 解析兩層表頭 ─────────────────────────────────────────────
  const groupRow = (allRows[0] as string[]).map((c) => String(c))
  const fieldRow = (allRows[1] as string[]).map((c) => String(c))
  const headerDefs = buildTwoLayerHeaders(groupRow, fieldRow)
  const detectedHeaders = headerDefs.map((h) => h.key)

  // ── 找項次欄位 index ──────────────────────────────────────────
  const itemNoColIndex = headerDefs.findIndex((h) => {
    const normalized = normalizeHeaderName(h.originalField)
    return (ITEM_NO_COLUMN_NAMES as readonly string[]).includes(normalized)
  })

  if (itemNoColIndex === -1) {
    issues.push({
      code: 'PC_NO_ITEM_NO_COLUMN',
      severity: 'warning',
      source: 'project-content-excel',
      message: `工作表「${PROJECT_CONTENT_SHEET}」中找不到項次欄位（${Array.from(ITEM_NO_COLUMN_NAMES).join('、')}）`,
      sheet: PROJECT_CONTENT_SHEET,
    })
  }

  // ── 解析資料列（從第 3 列開始，index 2）─────────────────────────
  const dataRows = allRows.slice(2).filter((r) =>
    (r as string[]).some((cell) => String(cell).trim() !== '')
  )

  const items: ProjectItem[] = dataRows.map((row, idx) => {
    const rawArr = row as string[]
    const rawItemNo =
      itemNoColIndex !== -1 ? String(rawArr[itemNoColIndex] ?? '') : ''

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
      rawItemNo,
      normalizedItemNo: normalized,
      itemType: classifyItemNo(normalized),
      data,
      imageRefs,
    }
  })

  // ── 驗證項次 ─────────────────────────────────────────────────
  const itemValidation = validateProjectItems(items)
  issues.push(...itemValidation.issues)

  return {
    sheetFound: true,
    alternativeSheetFound,
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
