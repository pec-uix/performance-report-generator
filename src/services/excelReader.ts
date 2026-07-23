/**
 * excelReader.ts
 * 使用 xlsx 套件讀取 Excel 檔案。
 * 所有解析在瀏覽器記憶體完成，不輸出至 console 或持久化儲存。
 */

import * as XLSX from 'xlsx'
import { normalizeHeaderName } from './headerNormalizer'
import type { ParsedWorkbookSheet } from '@/types/excel'

/**
 * 從 ArrayBuffer 解析 Excel Workbook。
 * 失敗時拋出可安全顯示的錯誤訊息。
 */
export function parseWorkbookFromBuffer(buffer: ArrayBuffer): XLSX.WorkBook {
  try {
    return XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellDates: false,
      cellText: true,
    })
  } catch {
    throw new Error('無法解析 Excel 檔案，請確認檔案格式正確。')
  }
}

/**
 * 取得工作簿中所有工作表名稱（原始與 trim 後）
 */
export function getSheetNames(
  workbook: XLSX.WorkBook
): { original: string; normalized: string }[] {
  return workbook.SheetNames.map((name) => ({
    original: name,
    normalized: name.trim(),
  }))
}

/**
 * 將指定工作表解析為 ParsedWorkbookSheet。
 * 使用 raw: false 確保項次等欄位以格式化字串讀取，避免被轉為數字或日期。
 */
export function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string
): ParsedWorkbookSheet {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`找不到工作表：${sheetName}`)
  }

  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  const headerRow = ((allRows[0] as string[]) ?? []).map((h) =>
    normalizeHeaderName(String(h))
  )
  const dataRows = allRows.slice(1)
  const nonEmptyRows = dataRows.filter((r) =>
    (r as string[]).some((cell) => String(cell).trim() !== '')
  )

  return {
    originalName: sheetName,
    normalizedName: sheetName.trim(),
    headers: headerRow,
    rowCount: nonEmptyRows.length,
    rows: dataRows,
  }
}
