/**
 * workRecordMapper.spec.ts
 * 測試工時記錄映射。
 */

import { describe, it, expect } from 'vitest'
import { mapWorkRecords } from '@/services/workRecordMapper'
import type { ParsedWorkbookSheet } from '@/types/excel'

function makeSheet(
  headers: string[],
  rows: unknown[][]
): ParsedWorkbookSheet {
  return {
    originalName: '工時分析(自助)',
    normalizedName: '工時分析(自助)',
    headers,
    rowCount: rows.length,
    rows,
  }
}

describe('mapWorkRecords', () => {
  const projectKeySet = new Set(['PRJ-001', 'PRJ-002'])
  const maintenanceKeySet = new Set(['MAINT-001'])

  it('正確映射含完整欄位的記錄', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '員工姓名', '工時', '專案代碼', '維運代碼'],
      [['2026-04-01', 'EMP001', '張三', '8', 'PRJ-001', '']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records).toHaveLength(1)
    const rec = result.records[0]
    expect(rec.workDate).toBe('2026-04-01')
    expect(rec.employeeKey).toBe('EMP001')
    expect(rec.hours).toBe(8)
    expect(rec.workCategory).toBe('project')
    expect(rec.projectKey).toBe('PRJ-001')
  })

  it('維運分類正確識別', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '工時', '維運代碼'],
      [['2026-04-01', 'EMP002', '4', 'MAINT-001']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records[0].workCategory).toBe('maintenance')
    expect(result.records[0].maintenanceKey).toBe('MAINT-001')
  })

  it('找不到主檔時歸類為 other，並產生警告', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '工時', '專案代碼'],
      [['2026-04-01', 'EMP003', '6', 'UNKNOWN-001']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records[0].workCategory).toBe('other')
    expect(result.issues.some((i) => i.code === 'UNMATCHED_WORK_ITEM')).toBe(true)
  })

  it('日期欄位缺失時提早返回錯誤', () => {
    const sheet = makeSheet(
      ['員工編號', '工時'],
      [['EMP001', '8']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records).toHaveLength(0)
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_FIELD')).toBe(true)
  })

  it('工時欄位缺失時提早返回錯誤', () => {
    const sheet = makeSheet(
      ['日期', '員工編號'],
      [['2026-04-01', 'EMP001']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records).toHaveLength(0)
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_FIELD')).toBe(true)
  })

  it('無效日期的列被略過並計入 skippedRows', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '工時'],
      [
        ['not-a-date', 'EMP001', '8'],
        ['2026-04-01', 'EMP001', '8'],
      ]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.skippedRows).toBe(1)
    expect(result.records).toHaveLength(1)
  })

  it('員工識別欄均空白時略過該列', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '員工姓名', '工時'],
      [['2026-04-01', '', '', '8']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records).toHaveLength(0)
    expect(result.skippedRows).toBe(1)
  })

  it('工作項目欄均空白時歸類為 other（不產生警告）', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '工時', '專案代碼'],
      [['2026-04-01', 'EMP001', '8', '']]
    )
    const result = mapWorkRecords(sheet, projectKeySet, maintenanceKeySet)
    expect(result.records[0].workCategory).toBe('other')
    // 空白不產生 UNMATCHED_WORK_ITEM 警告
    expect(result.issues.some((i) => i.code === 'UNMATCHED_WORK_ITEM')).toBe(false)
  })
})
