import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readProjectContent } from '@/services/projectContentReader'

function makeWorkbook(itemCell: XLSX.CellObject): XLSX.WorkBook {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['', '', ''],
    ['項次', '專案名稱', 'PM'],
    ['1', '主項', 'A'],
    ['', '子項', 'B'],
  ])
  sheet.A4 = itemCell
  return {
    SheetNames: ['專案內容'],
    Sheets: { 專案內容: sheet },
  }
}

describe('projectContentReader itemNo display restore', () => {
  it('46023 在項次欄為日期格式且顯示 1-1 時還原為 1-1', () => {
    const workbook = makeWorkbook({ t: 'n', v: 46023, w: '1-1', z: 'm\\-d' })
    const result = readProjectContent(workbook)

    expect(result.items[1]?.rawItemNo).toBe('1-1')
    expect(result.items[1]?.normalizedItemNo).toBe('1-1')
    expect(result.items[1]?.parentItemNo).toBe('1')
    expect(result.issues.some((issue) => issue.code === 'PRESENTATION_SCOPE_ITEM_NO_DISPLAY_RESTORED')).toBe(true)
  })

  it('46082 與 46083 使用同一通用規則還原，不 hardcode 序號', () => {
    const wb31 = makeWorkbook({ t: 'n', v: 46082, w: '3-1', z: 'm\\-d' })
    const wb32 = makeWorkbook({ t: 'n', v: 46083, w: '3-2', z: 'm\\-d' })

    expect(readProjectContent(wb31).items[1]?.normalizedItemNo).toBe('3-1')
    expect(readProjectContent(wb32).items[1]?.normalizedItemNo).toBe('3-2')
  })

  it('非日期格式數字不得套用顯示值還原', () => {
    const workbook = makeWorkbook({ t: 'n', v: 46023, w: '1-1', z: '0' })
    const result = readProjectContent(workbook)

    expect(result.items[1]?.rawItemNo).toBe('1-1')
    expect(result.issues.some((issue) => issue.code === 'PRESENTATION_SCOPE_ITEM_NO_DISPLAY_RESTORED')).toBe(false)
  })
})

