/**
 * dateNormalizer.spec.ts
 * 測試日期標準化函式。
 */

import { describe, it, expect } from 'vitest'
import { normalizeDate } from '@/services/dateNormalizer'

describe('normalizeDate', () => {
  // ── 有效格式 ─────────────────────────────────────────────────

  it('接受 YYYY-MM-DD 格式', () => {
    const r = normalizeDate('2026-04-01', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-04-01')
    expect(r.issue).toBeUndefined()
  })

  it('接受 YYYY/M/D 格式', () => {
    const r = normalizeDate('2026/4/1', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-04-01')
  })

  it('接受 YYYY/MM/DD 格式', () => {
    const r = normalizeDate('2026/04/01', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-04-01')
  })

  it('接受 YYYY.M.D 格式', () => {
    const r = normalizeDate('2026.4.1', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-04-01')
  })

  it('接受 datetime 字串（截取日期部分）', () => {
    const r = normalizeDate('2026-04-01 08:30:00', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-04-01')
  })

  it('接受有效 Excel 序列數（數字型別）', () => {
    // 45992 = 2025-12-01：(45992-25569)*86400*1000 ms → UTC 2025-12-01
    const r = normalizeDate(45992, 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2025-12-01')
    expect(r.issue).toBeUndefined()
  })

  it('接受 Excel 序列數以字串型態儲存（有效範圍內）', () => {
    // 45992 → 2025-12-01
    const r = normalizeDate('45992', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2025-12-01')
  })

  it('不因時區造成跨日問題（串接 UTC 計算）', () => {
    // 2026-03-31 serial
    const r1 = normalizeDate('2026-03-31', 'workDate', 0)
    expect(r1.value).toBe('2026-03-31')
    const r2 = normalizeDate('2026-04-01', 'workDate', 0)
    expect(r2.value).toBe('2026-04-01')
    // 確認兩個相鄰日期不會互相干擾
    expect(r1.value).not.toBe(r2.value)
  })

  it('接受閏年日期（2026-02-28 非閏年）', () => {
    const r = normalizeDate('2026-02-28', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-02-28')
  })

  it('接受 2025-12-01（季度起始邊界）', () => {
    const r = normalizeDate('2025-12-01', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2025-12-01')
  })

  it('接受 2026-11-30（季度結束邊界）', () => {
    const r = normalizeDate('2026-11-30', 'workDate', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe('2026-11-30')
  })

  // ── 無效格式 ─────────────────────────────────────────────────

  it('拒絕空字串', () => {
    const r = normalizeDate('', 'workDate', 0)
    expect(r.valid).toBe(false)
    expect(r.value).toBeNull()
    expect(r.issue).toBeDefined()
  })

  it('拒絕 null', () => {
    const r = normalizeDate(null, 'workDate', 0)
    expect(r.valid).toBe(false)
    expect(r.value).toBeNull()
  })

  it('拒絕 undefined', () => {
    const r = normalizeDate(undefined, 'workDate', 0)
    expect(r.valid).toBe(false)
  })

  it('拒絕純文字（無法解析）', () => {
    const r = normalizeDate('not-a-date', 'workDate', 0)
    expect(r.valid).toBe(false)
    expect(r.value).toBeNull()
    expect(r.issue?.code).toBe('INVALID_DATE')
  })

  it('拒絕月份超出範圍（2026-13-01）', () => {
    const r = normalizeDate('2026-13-01', 'workDate', 0)
    expect(r.valid).toBe(false)
  })

  it('錯誤訊息中包含列號（rowIndex=3 → 顯示第 5 列）', () => {
    const r = normalizeDate('', 'workDate', 3)
    expect(r.issue?.message).toContain('5')
    expect(r.issue?.row).toBe(5)
  })
})
