/**
 * workRecordMapper.spec.ts
 * 測試工時記錄映射（以「模組」欄分類、姓名查人員清單）。
 */

import { describe, it, expect } from 'vitest'
import { mapWorkRecords, buildNameToEmployeeKeyMap, AMBIGUOUS_KEY } from '@/services/workRecordMapper'
import type { ParsedWorkbookSheet } from '@/types/excel'
import type { PersonRecord } from '@/types/analysis'

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

const NO_PERSONS = new Map<string, string>()

// ─── buildNameToEmployeeKeyMap ────────────────────────────────────────────────

describe('buildNameToEmployeeKeyMap', () => {
  it('姓名唯一時正確對應員工編號', () => {
    const persons: PersonRecord[] = [
      { employeeKey: 'EMP001', employeeName: '張三' },
      { employeeKey: 'EMP002', employeeName: '李四' },
    ]
    const map = buildNameToEmployeeKeyMap(persons)
    expect(map.get('張三')).toBe('EMP001')
    expect(map.get('李四')).toBe('EMP002')
    expect(map.size).toBe(2)
  })

  it('同名對應多個員工編號時標記 AMBIGUOUS_KEY', () => {
    const persons: PersonRecord[] = [
      { employeeKey: 'EMP001', employeeName: '王五' },
      { employeeKey: 'EMP999', employeeName: '王五' },
    ]
    const map = buildNameToEmployeeKeyMap(persons)
    expect(map.get('王五')).toBe(AMBIGUOUS_KEY)
  })

  it('姓名為空或 undefined 的記錄忽略', () => {
    const persons: PersonRecord[] = [
      { employeeKey: 'EMP001', employeeName: undefined },
      { employeeKey: 'EMP002', employeeName: '' },
    ]
    const map = buildNameToEmployeeKeyMap(persons)
    expect(map.size).toBe(0)
  })
})

// ─── mapWorkRecords ───────────────────────────────────────────────────────────

describe('mapWorkRecords', () => {
  const projectModuleKeySet     = new Set(['20220506(測試專案)'])
  const maintenanceModuleKeySet = new Set(['20220512(維運項目)'])
  const nameMap = new Map<string, string>([
    ['張三', 'EMP001'],
    ['李四', 'EMP002'],
  ])

  // ── [New-1] 工時日期 alias 正確識別 ──────────────────────────────────────

  it('[New-1] 工時日期 alias 正確識別日期欄位並產生記錄', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數', '模組'],
      [['2026-04-01', '張三', '8', '0101(行政事務)']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].workDate).toBe('2026-04-01')
  })

  // ── [New-2] 時數 alias 正確識別 ──────────────────────────────────────────

  it('[New-2] 時數 alias 正確識別工時欄位', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數', '模組'],
      [['2026-04-01', '張三', '8.5', '0101(行政事務)']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].hours).toBe(8.5)
  })

  // ── [New-3] 姓名 → 人員清單 → 員工編號 ──────────────────────────────────

  it('[New-3] 姓名精確對應人員清單取得員工編號', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數'],
      [['2026-04-01', '張三', '8']]
    )
    const result = mapWorkRecords(sheet, new Set(), new Set(), nameMap)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].employeeKey).toBe('EMP001')
  })

  // ── [New-4] 模組欄精確對應專案清單 ──────────────────────────────────────

  it('[New-4] 模組欄精確對應專案清單模組值，分類為 project', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數', '模組'],
      [['2026-04-01', '張三', '8', '20220506(測試專案)']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records).toHaveLength(1)
    const rec = result.records[0]
    expect(rec.workCategory).toBe('project')
    expect(rec.projectKey).toBe('20220506(測試專案)')
    expect(rec.moduleKey).toBe('20220506(測試專案)')
    expect(rec.moduleName).toBe('20220506(測試專案)')
  })

  // ── [New-6] 未對應共用模組歸 other，不產生任何問題 ───────────────────────

  it('[New-6] 未對應模組（共用行政）歸 other，不產生警告', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數', '模組'],
      [['2026-04-01', '張三', '8', '0101(行政事務)']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records[0].workCategory).toBe('other')
    expect(result.records[0].moduleKey).toBe('0101(行政事務)')
    const warningOrErrors = result.issues.filter(
      (i) => i.severity === 'warning' || i.severity === 'error'
    )
    expect(warningOrErrors).toHaveLength(0)
  })

  // ── [New-7] 同時對應專案與維運 → AMBIGUOUS_WORK_ITEM_CATEGORY ────────────

  it('[New-7] 模組鍵同時在專案與維運集合中，產生 AMBIGUOUS_WORK_ITEM_CATEGORY 錯誤並略過', () => {
    const ambiguousKey = '20220512(重複)'
    const projSet  = new Set([ambiguousKey])
    const maintSet = new Set([ambiguousKey])
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數', '模組'],
      [['2026-04-01', '張三', '8', ambiguousKey]]
    )
    const result = mapWorkRecords(sheet, projSet, maintSet, nameMap)
    expect(result.records).toHaveLength(0)
    expect(result.skippedRows).toBe(1)
    expect(result.issues.some((i) => i.code === 'AMBIGUOUS_WORK_ITEM_CATEGORY')).toBe(true)
  })

  // ── [New-9a/9b] 缺必要欄位 → records=[] ──────────────────────────────────

  it('[New-9a] 缺少日期欄時提早返回 MISSING_REQUIRED_FIELD 錯誤', () => {
    const sheet = makeSheet(['姓名', '時數'], [['張三', '8']])
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records).toHaveLength(0)
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_FIELD')).toBe(true)
  })

  it('[New-9b] 缺少工時欄時提早返回 MISSING_REQUIRED_FIELD 錯誤', () => {
    const sheet = makeSheet(['工時日期', '姓名'], [['2026-04-01', '張三']])
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records).toHaveLength(0)
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_FIELD')).toBe(true)
  })

  // ── 維運分類正確識別 ──────────────────────────────────────────────────────

  it('維運模組精確對應維運集合，分類為 maintenance', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數', '模組'],
      [['2026-04-01', '李四', '4', '20220512(維運項目)']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, nameMap)
    expect(result.records[0].workCategory).toBe('maintenance')
    expect(result.records[0].maintenanceKey).toBe('20220512(維運項目)')
    expect(result.records[0].moduleKey).toBe('20220512(維運項目)')
  })

  // ── 日期欄位缺失（沿用原有語意）──────────────────────────────────────────

  it('日期欄位缺失時提早返回錯誤', () => {
    const sheet = makeSheet(['員工編號', '工時'], [['EMP001', '8']])
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, NO_PERSONS)
    expect(result.records).toHaveLength(0)
    expect(result.issues.some((i) => i.code === 'MISSING_REQUIRED_FIELD')).toBe(true)
  })

  it('工時欄位缺失時提早返回錯誤', () => {
    const sheet = makeSheet(['日期', '員工編號'], [['2026-04-01', 'EMP001']])
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, NO_PERSONS)
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
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, NO_PERSONS)
    expect(result.skippedRows).toBe(1)
    expect(result.records).toHaveLength(1)
  })

  it('員工識別欄均空白時略過該列', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '員工姓名', '工時'],
      [['2026-04-01', '', '', '8']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, NO_PERSONS)
    expect(result.records).toHaveLength(0)
    expect(result.skippedRows).toBe(1)
  })

  it('模組欄空白時歸類為 other，不產生警告', () => {
    const sheet = makeSheet(
      ['日期', '員工編號', '工時', '模組'],
      [['2026-04-01', 'EMP001', '8', '']]
    )
    const result = mapWorkRecords(sheet, projectModuleKeySet, maintenanceModuleKeySet, NO_PERSONS)
    expect(result.records[0].workCategory).toBe('other')
    expect(result.records[0].moduleKey).toBeUndefined()
    expect(result.issues).toHaveLength(0)
  })

  it('姓名查找不到時以姓名為 key 並產生 EMPLOYEE_NAME_NOT_FOUND 警告', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數'],
      [['2026-04-01', '查無此人', '4']]
    )
    const result = mapWorkRecords(sheet, new Set(), new Set(), nameMap)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].employeeKey).toBe('查無此人')
    expect(result.issues.some((i) => i.code === 'EMPLOYEE_NAME_NOT_FOUND')).toBe(true)
  })

  it('姓名對應多個員工時產生 AMBIGUOUS_EMPLOYEE_NAME 錯誤並略過', () => {
    const ambiguousMap = new Map<string, string>([['王五', AMBIGUOUS_KEY]])
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數'],
      [['2026-04-01', '王五', '4']]
    )
    const result = mapWorkRecords(sheet, new Set(), new Set(), ambiguousMap)
    expect(result.records).toHaveLength(0)
    expect(result.issues.some((i) => i.code === 'AMBIGUOUS_EMPLOYEE_NAME')).toBe(true)
  })

  it('M/D/YY 格式日期（1/1/26）正確解析並產生記錄', () => {
    const sheet = makeSheet(
      ['工時日期', '姓名', '時數'],
      [['1/1/26', '張三', '8']]
    )
    const result = mapWorkRecords(sheet, new Set(), new Set(), nameMap)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].workDate).toBe('2026-01-01')
  })
})

