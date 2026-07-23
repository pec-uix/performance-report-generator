/**
 * workforceCalculator.spec.ts
 * 測試人力統計計算。
 */

import { describe, it, expect } from 'vitest'
import { calculateWorkforce } from '@/services/workforceCalculator'
import type { NormalizedWorkRecord } from '@/types/analysis'

function makeRecord(
  employeeKey: string,
  workCategory: NormalizedWorkRecord['workCategory'],
  hours: number,
  employeeName?: string
): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate: '2026-04-01',
    employeeKey,
    employeeName,
    workCategory,
    hours,
  }
}

describe('calculateWorkforce', () => {
  it('空陣列回傳全零', () => {
    const r = calculateWorkforce([])
    expect(r.activePeopleCount).toBe(0)
    expect(r.totalHours).toBe(0)
    expect(r.averageHoursPerPerson).toBeNull()
  })

  it('activePeopleCount 去重（同一人多筆記錄算一次）', () => {
    const records = [
      makeRecord('EMP001', 'project', 8),
      makeRecord('EMP001', 'project', 4),
      makeRecord('EMP002', 'maintenance', 8),
    ]
    const r = calculateWorkforce(records)
    expect(r.activePeopleCount).toBe(2)
  })

  it('hours = 0 的員工不計入 activePeopleCount', () => {
    const records = [
      makeRecord('EMP001', 'project', 8),
      makeRecord('EMP002', 'other', 0),
    ]
    const r = calculateWorkforce(records)
    expect(r.activePeopleCount).toBe(1)
  })

  it('同一人同時有專案和維運工時，activePeopleCount 只算一次', () => {
    const records = [
      makeRecord('EMP001', 'project', 4),
      makeRecord('EMP001', 'maintenance', 4),
    ]
    const r = calculateWorkforce(records)
    expect(r.activePeopleCount).toBe(1)
    expect(r.projectPeopleCount).toBe(1)
    expect(r.maintenancePeopleCount).toBe(1)
  })

  it('projectPeopleCount 正確（僅計有專案工時者）', () => {
    const records = [
      makeRecord('EMP001', 'project', 8),
      makeRecord('EMP002', 'maintenance', 8),
      makeRecord('EMP003', 'other', 8),
    ]
    const r = calculateWorkforce(records)
    expect(r.projectPeopleCount).toBe(1)
    expect(r.maintenancePeopleCount).toBe(1)
    expect(r.otherPeopleCount).toBe(1)
    expect(r.activePeopleCount).toBe(3)
  })

  it('averageHoursPerPerson = totalHours / activePeopleCount', () => {
    const records = [
      makeRecord('EMP001', 'project', 80),
      makeRecord('EMP002', 'project', 40),
    ]
    const r = calculateWorkforce(records)
    expect(r.averageHoursPerPerson).toBe(60)
  })

  it('activePeopleCount = 0 時 averageHoursPerPerson 為 null', () => {
    const r = calculateWorkforce([makeRecord('EMP001', 'project', 0)])
    expect(r.averageHoursPerPerson).toBeNull()
  })

  it('people 陣列包含每人的工時摘要', () => {
    const records = [
      makeRecord('EMP001', 'project', 4, '張三'),
      makeRecord('EMP001', 'maintenance', 2, '張三'),
    ]
    const r = calculateWorkforce(records)
    expect(r.people).toHaveLength(1)
    const p = r.people[0]
    expect(p.totalHours).toBe(6)
    expect(p.projectHours).toBe(4)
    expect(p.maintenanceHours).toBe(2)
  })

  it('personMonthsStatus 預設為 not-configured', () => {
    const r = calculateWorkforce([makeRecord('EMP001', 'project', 8)])
    expect(r.personMonthsStatus).toBe('not-configured')
    expect(r.personMonths).toBeNull()
  })

  it('不假設人月換算（只回傳 null）', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord(`EMP${i}`, 'project', 160)
    )
    const r = calculateWorkforce(records)
    // 即使每人有 160 小時，也不自動計算人月
    expect(r.personMonths).toBeNull()
    expect(r.personMonthsStatus).toBe('not-configured')
  })
})
