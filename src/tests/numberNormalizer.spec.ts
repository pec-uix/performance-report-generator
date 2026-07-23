/**
 * numberNormalizer.spec.ts
 * 測試數字標準化函式。
 */

import { describe, it, expect } from 'vitest'
import { normalizeNumber } from '@/services/numberNormalizer'

describe('normalizeNumber', () => {
  // ── 有效輸入 ─────────────────────────────────────────────────

  it('接受整數（number 型別）', () => {
    const r = normalizeNumber(8, 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(8)
  })

  it('接受小數（number 型別）', () => {
    const r = normalizeNumber(4.5, 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(4.5)
  })

  it('接受 0', () => {
    const r = normalizeNumber(0, 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(0)
  })

  it('接受整數字串', () => {
    const r = normalizeNumber('8', 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(8)
  })

  it('接受小數字串', () => {
    const r = normalizeNumber('0.5', 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(0.5)
  })

  it('接受含千分位的字串', () => {
    const r = normalizeNumber('1,234.5', 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(1234.5)
  })

  it('接受前後有空白的字串', () => {
    const r = normalizeNumber('  8  ', 'hours', 0)
    expect(r.valid).toBe(true)
    expect(r.value).toBe(8)
  })

  // ── 無效輸入 ─────────────────────────────────────────────────

  it('拒絕空字串', () => {
    const r = normalizeNumber('', 'hours', 0)
    expect(r.valid).toBe(false)
    expect(r.value).toBeNull()
    expect(r.issue).toBeDefined()
  })

  it('拒絕 null', () => {
    const r = normalizeNumber(null, 'hours', 0)
    expect(r.valid).toBe(false)
    expect(r.value).toBeNull()
  })

  it('拒絕 undefined', () => {
    const r = normalizeNumber(undefined, 'hours', 0)
    expect(r.valid).toBe(false)
  })

  it('拒絕 NaN', () => {
    const r = normalizeNumber(NaN, 'hours', 0)
    expect(r.valid).toBe(false)
    expect(r.issue?.code).toBe('INVALID_NUMBER')
  })

  it('拒絕 Infinity', () => {
    const r = normalizeNumber(Infinity, 'hours', 0)
    expect(r.valid).toBe(false)
  })

  it('拒絕負數', () => {
    const r = normalizeNumber(-1, 'hours', 0)
    expect(r.valid).toBe(false)
    expect(r.issue?.code).toBe('INVALID_NUMBER')
  })

  it('拒絕含文字單位的字串（如「8 小時」）', () => {
    const r = normalizeNumber('8小時', 'hours', 0)
    expect(r.valid).toBe(false)
  })

  it('拒絕純文字（N/A）', () => {
    const r = normalizeNumber('N/A', 'hours', 0)
    expect(r.valid).toBe(false)
  })

  it('拒絕橫線（-）', () => {
    const r = normalizeNumber('-', 'hours', 0)
    expect(r.valid).toBe(false)
  })

  it('錯誤訊息中包含列號（rowIndex=5 → 顯示第 7 列）', () => {
    const r = normalizeNumber('', 'hours', 5)
    expect(r.issue?.row).toBe(7)
    expect(r.issue?.message).toContain('7')
  })
})
