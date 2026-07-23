/**
 * workHoursCalculator.spec.ts
 * 測試工時分類統計。
 */

import { describe, it, expect } from 'vitest'
import { calculateWorkHours } from '@/services/workHoursCalculator'
import type { NormalizedWorkRecord } from '@/types/analysis'

function makeRecord(
  workCategory: NormalizedWorkRecord['workCategory'],
  hours: number,
  workDate = '2026-04-01'
): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate,
    employeeKey: 'EMP001',
    workCategory,
    hours,
  }
}

describe('calculateWorkHours', () => {
  it('空陣列回傳全零', () => {
    const r = calculateWorkHours([])
    expect(r.totalHours).toBe(0)
    expect(r.projectHours).toBe(0)
    expect(r.maintenanceHours).toBe(0)
    expect(r.otherHours).toBe(0)
    expect(r.recordCount).toBe(0)
  })

  it('totalHours = 0 時 ratio 均為 0（不產生 NaN）', () => {
    const r = calculateWorkHours([])
    expect(r.projectRatio).toBe(0)
    expect(r.maintenanceRatio).toBe(0)
    expect(r.otherRatio).toBe(0)
    expect(isNaN(r.projectRatio)).toBe(false)
  })

  it('正確計算各分類工時', () => {
    const records = [
      makeRecord('project', 10),
      makeRecord('project', 5),
      makeRecord('maintenance', 3),
      makeRecord('other', 2),
    ]
    const r = calculateWorkHours(records)
    expect(r.totalHours).toBe(20)
    expect(r.projectHours).toBe(15)
    expect(r.maintenanceHours).toBe(3)
    expect(r.otherHours).toBe(2)
    expect(r.recordCount).toBe(4)
  })

  it('正確計算比例', () => {
    const records = [
      makeRecord('project', 8),
      makeRecord('maintenance', 2),
    ]
    const r = calculateWorkHours(records)
    expect(r.projectRatio).toBeCloseTo(0.8)
    expect(r.maintenanceRatio).toBeCloseTo(0.2)
    expect(r.otherRatio).toBe(0)
  })

  it('純專案工時 projectRatio = 1', () => {
    const r = calculateWorkHours([makeRecord('project', 100)])
    expect(r.projectRatio).toBe(1)
    expect(r.maintenanceRatio).toBe(0)
    expect(r.otherRatio).toBe(0)
  })

  it('接受小數工時並保留精度', () => {
    const records = [makeRecord('project', 0.5), makeRecord('maintenance', 0.5)]
    const r = calculateWorkHours(records)
    expect(r.totalHours).toBe(1)
    expect(r.projectRatio).toBe(0.5)
  })

  it('累計與單季可各自獨立計算（互不影響）', () => {
    const cumRec = [makeRecord('project', 100, '2025-12-01'), makeRecord('maintenance', 20, '2026-03-31')]
    const qtrRec = [makeRecord('project', 40, '2026-04-01')]
    const cum = calculateWorkHours(cumRec)
    const qtr = calculateWorkHours(qtrRec)
    expect(cum.totalHours).toBe(120)
    expect(qtr.totalHours).toBe(40)
  })

  it('recordCount 與輸入陣列長度一致', () => {
    const records = Array.from({ length: 7 }, () => makeRecord('other', 1))
    const r = calculateWorkHours(records)
    expect(r.recordCount).toBe(7)
  })

  it('只有 other 分類時 projectRatio 和 maintenanceRatio 均為 0', () => {
    const r = calculateWorkHours([makeRecord('other', 8)])
    expect(r.projectRatio).toBe(0)
    expect(r.maintenanceRatio).toBe(0)
    expect(r.otherRatio).toBe(1)
  })
})
