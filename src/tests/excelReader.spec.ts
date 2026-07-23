import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbookFromBuffer, getSheetNames, parseSheet } from '@/services/excelReader'

// ── 測試輔助：在記憶體中建立 xlsx buffer ──────────────────────────
function createWorkbookBuffer(sheets: { name: string; data: unknown[][] }[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.data)
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  return arr.buffer
}

describe('excelReader', () => {
  it('有效 xlsx 可解析', () => {
    const buffer = createWorkbookBuffer([{ name: 'Sheet1', data: [['A', 'B'], [1, 2]] }])
    const wb = parseWorkbookFromBuffer(buffer)
    expect(wb.SheetNames).toContain('Sheet1')
  })

  it('無法解析的假檔案拋出安全錯誤', () => {
    // 使用 PNG magic bytes（XLSX 無法辨識的格式）觸發錯誤
    const fakePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
    expect(() => parseWorkbookFromBuffer(fakePng.buffer)).toThrow('無法解析 Excel 檔案')
  })

  it('getSheetNames 回傳原始與 trim 名稱', () => {
    // 直接建立 WorkBook 以避免 XLSX 中文 sheet 名稱序列化問題
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['X']]), ' 工時分析 ')
    const names = getSheetNames(wb)
    expect(names[0].original).toBe(' 工時分析 ')
    expect(names[0].normalized).toBe('工時分析')
  })

  it('parseSheet 回傳正確欄位與列數', () => {
    // 直接建立 WorkBook 以避免 XLSX sheet 名稱序列化問題
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['\u59d3\u540d', '\u5de5\u6642'], ['Alice', '8'], ['Bob', '6']])
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    const sheet = parseSheet(wb, 'Data')
    expect(sheet.headers).toContain('姓名')
    expect(sheet.rowCount).toBe(2)
    expect(sheet.originalName).toBe('Data')
  })

  it('parseSheet 找不到工作表時拋出錯誤', () => {
    const buffer = createWorkbookBuffer([{ name: 'Sheet1', data: [['A']] }])
    const wb = parseWorkbookFromBuffer(buffer)
    expect(() => parseSheet(wb, '不存在')).toThrow('找不到工作表')
  })
})
