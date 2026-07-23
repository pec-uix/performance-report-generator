import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { validateWorkHoursWorkbook } from '@/services/workbookValidator'
import { OPTIONAL_WORK_SHEETS, PIVOT_ANALYSIS_SHEETS, REQUIRED_WORK_SHEETS } from '@/config/requiredSheets'

// ── 測試輔助 ──────────────────────────────────────────────────────
// 直接建立 WorkBook 物件以避免 XLSX 中文工作表名稱序列化回傳問題
function makeWorkbook(sheetNames: string[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const name of sheetNames) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['col']]), name)
  }
  return wb
}

const ALL_REQUIRED = [...REQUIRED_WORK_SHEETS]

describe('workbookValidator', () => {
  it('四張核心必要工作表完整時 valid = true', () => {
    const wb = makeWorkbook(ALL_REQUIRED)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.missingSheets).toHaveLength(0)
  })

  it('缺少收入工時彙總不產生 error，列為 optional missing info', () => {
    const wb = makeWorkbook(ALL_REQUIRED)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.missingSheets).not.toContain('收入工時彙總')
    expect(result.info.some((i) => i.code === 'WH_OPTIONAL_SHEET_MISSING' && i.sheet === '收入工時彙總')).toBe(true)
  })

  it('收入工時彙總存在時仍可解析，但不是 required', () => {
    const wb = makeWorkbook([...ALL_REQUIRED, ...OPTIONAL_WORK_SHEETS])
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(true)
    expect(result.parsedSheets['收入工時彙總']).toBeDefined()
    expect(result.missingSheets).toHaveLength(0)
  })

  it('Pivot optional sheets 缺少不阻擋驗證', () => {
    const wb = makeWorkbook(ALL_REQUIRED)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(true)
    for (const sheet of PIVOT_ANALYSIS_SHEETS) {
      expect(result.info.some((i) => i.code === 'WH_OPTIONAL_SHEET_MISSING' && i.sheet === sheet)).toBe(true)
    }
  })

  it('缺少「工時分析(自助)」產生 WH_MISSING_SHEET error', () => {
    const sheets = ALL_REQUIRED.filter((s) => s !== '工時分析(自助)')
    const wb = makeWorkbook(sheets)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'WH_MISSING_SHEET')).toBe(true)
    expect(result.missingSheets).toContain('工時分析(自助)')
  })

  it('缺少「專案清單」仍產生 WH_MISSING_SHEET error', () => {
    const sheets = ALL_REQUIRED.filter((s) => s !== '專案清單')
    const wb = makeWorkbook(sheets)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(false)
    expect(result.missingSheets).toContain('專案清單')
  })

  it('缺少「人員清單」仍產生 WH_MISSING_SHEET error', () => {
    const sheets = ALL_REQUIRED.filter((s) => s !== '人員清單')
    const wb = makeWorkbook(sheets)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(false)
    expect(result.missingSheets).toContain('人員清單')
  })

  it('缺少「維運清單」仍產生 WH_MISSING_SHEET error', () => {
    const sheets = ALL_REQUIRED.filter((s) => s !== '維運清單')
    const wb = makeWorkbook(sheets)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(false)
    expect(result.missingSheets).toContain('維運清單')
  })

  it('缺少多張必要工作表時全部列出', () => {
    const wb = makeWorkbook(['其他工作表'])
    const result = validateWorkHoursWorkbook(wb)
    expect(result.missingSheets.length).toBe(ALL_REQUIRED.length)
    expect(result.errors.length).toBe(ALL_REQUIRED.length)
  })

  it('工作表名稱前後空白可以正規化', () => {
    // 工作表名稱帶空白，正規化後應能比對
    const sheetsWithSpaces = ALL_REQUIRED.map((s) => ` ${s} `)
    const wb = makeWorkbook(sheetsWithSpaces)
    const result = validateWorkHoursWorkbook(wb)
    expect(result.valid).toBe(true)
    expect(result.missingSheets).toHaveLength(0)
  })

  it('detectedSheets 包含偵測到的工作表原始名稱', () => {
    const wb = makeWorkbook(ALL_REQUIRED)
    const result = validateWorkHoursWorkbook(wb)
    for (const name of ALL_REQUIRED) {
      expect(result.detectedSheets).toContain(name)
    }
  })

  it('不修改原始工作表名稱（帶空白保留在 detectedSheets）', () => {
    const wb = makeWorkbook([' 工時分析(自助) '])
    const result = validateWorkHoursWorkbook(wb)
    // detectedSheets 保留原始名稱（含空白）
    expect(result.detectedSheets).toContain(' 工時分析(自助) ')
  })

  it('驗證過程不呼叫網路 API', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no fetch'))
    const wb = makeWorkbook(ALL_REQUIRED)
    validateWorkHoursWorkbook(wb)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
