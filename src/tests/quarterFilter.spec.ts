/**
 * quarterFilter.spec.ts
 * 測試依日期範圍過濾工時記錄。
 */

import { describe, it, expect } from 'vitest'
import { filterRecordsByDateRange } from '@/services/quarterFilter'
import type { NormalizedWorkRecord } from '@/types/analysis'

function makeRecord(workDate: string, hours = 8): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate,
    employeeKey: 'EMP001',
    workCategory: 'project',
    projectKey: 'PRJ-001',
    hours,
  }
}

const RECORDS: NormalizedWorkRecord[] = [
  makeRecord('2025-11-30'),  // 在 S1 前
  makeRecord('2025-12-01'),  // S1/S2/S3 累計起始
  makeRecord('2026-03-31'),  // S1 結束
  makeRecord('2026-04-01'),  // S2 單季起始
  makeRecord('2026-07-31'),  // S2 單季結束
  makeRecord('2026-08-01'),  // S3 單季起始
  makeRecord('2026-11-30'),  // S3 結束
  makeRecord('2026-12-01'),  // 超出 S3
]

describe('filterRecordsByDateRange', () => {
  it('S1 累計包含 2025-12-01 和 2026-03-31（含首尾）', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2025-12-01', end: '2026-03-31' })
    const dates = result.map((r) => r.workDate)
    expect(dates).toContain('2025-12-01')
    expect(dates).toContain('2026-03-31')
    expect(dates).not.toContain('2025-11-30')
    expect(dates).not.toContain('2026-04-01')
  })

  it('S2 單季包含 2026-04-01 但排除 2026-03-31', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2026-04-01', end: '2026-07-31' })
    const dates = result.map((r) => r.workDate)
    expect(dates).toContain('2026-04-01')
    expect(dates).toContain('2026-07-31')
    expect(dates).not.toContain('2026-03-31')
    expect(dates).not.toContain('2026-08-01')
  })

  it('S2 累計包含 2025-12-01', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2025-12-01', end: '2026-07-31' })
    const dates = result.map((r) => r.workDate)
    expect(dates).toContain('2025-12-01')
    expect(dates).toContain('2026-07-31')
    expect(dates).not.toContain('2025-11-30')
    expect(dates).not.toContain('2026-08-01')
  })

  it('S3 單季範圍（2026-08-01 ～ 2026-11-30）', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2026-08-01', end: '2026-11-30' })
    const dates = result.map((r) => r.workDate)
    expect(dates).toContain('2026-08-01')
    expect(dates).toContain('2026-11-30')
    expect(dates).not.toContain('2026-07-31')
    expect(dates).not.toContain('2026-12-01')
  })

  it('不修改原始陣列', () => {
    const original = [...RECORDS]
    filterRecordsByDateRange(RECORDS, { start: '2025-12-01', end: '2026-03-31' })
    expect(RECORDS).toHaveLength(original.length)
    expect(RECORDS[0].workDate).toBe('2025-11-30')
  })

  it('空陣列輸入回傳空陣列', () => {
    const result = filterRecordsByDateRange([], { start: '2025-12-01', end: '2026-03-31' })
    expect(result).toHaveLength(0)
  })

  it('無記錄落在範圍內時回傳空陣列', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2027-01-01', end: '2027-12-31' })
    expect(result).toHaveLength(0)
  })

  it('單一天範圍（start === end）', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2026-04-01', end: '2026-04-01' })
    expect(result).toHaveLength(1)
    expect(result[0].workDate).toBe('2026-04-01')
  })

  it('只有 start 當天沒有記錄時回傳空陣列', () => {
    const result = filterRecordsByDateRange(
      [makeRecord('2026-05-01')],
      { start: '2026-04-01', end: '2026-04-30' }
    )
    expect(result).toHaveLength(0)
  })

  it('回傳新陣列（不是原始陣列的參照）', () => {
    const result = filterRecordsByDateRange(RECORDS, { start: '2025-12-01', end: '2026-11-30' })
    expect(result).not.toBe(RECORDS)
  })
})
