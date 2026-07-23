import { describe, it, expect } from 'vitest'
import { QUARTER_CONFIG } from '@/config/quarterConfig'

describe('QUARTER_CONFIG', () => {
  describe('S1', () => {
    it('應顯示正確標籤', () => {
      expect(QUARTER_CONFIG.S1.label).toBe('2026 S1')
    })

    it('累積期間應為 2025-12-01 至 2026-03-31', () => {
      expect(QUARTER_CONFIG.S1.cumulativeStart).toBe('2025-12-01')
      expect(QUARTER_CONFIG.S1.cumulativeEnd).toBe('2026-03-31')
    })

    it('單季期間應為 2025-12-01 至 2026-03-31', () => {
      expect(QUARTER_CONFIG.S1.periodStart).toBe('2025-12-01')
      expect(QUARTER_CONFIG.S1.periodEnd).toBe('2026-03-31')
    })

    it('累積期間標籤應包含正確文字', () => {
      expect(QUARTER_CONFIG.S1.cumulativeLabel).toContain('2025/12')
      expect(QUARTER_CONFIG.S1.cumulativeLabel).toContain('2026/03')
    })

    it('單季期間標籤應包含正確文字', () => {
      expect(QUARTER_CONFIG.S1.periodLabel).toContain('2025/12')
      expect(QUARTER_CONFIG.S1.periodLabel).toContain('2026/03')
    })
  })

  describe('S2', () => {
    it('應顯示正確標籤', () => {
      expect(QUARTER_CONFIG.S2.label).toBe('2026 S2')
    })

    it('累積期間應為 2025-12-01 至 2026-07-31', () => {
      expect(QUARTER_CONFIG.S2.cumulativeStart).toBe('2025-12-01')
      expect(QUARTER_CONFIG.S2.cumulativeEnd).toBe('2026-07-31')
    })

    it('單季期間應為 2026-04-01 至 2026-07-31', () => {
      expect(QUARTER_CONFIG.S2.periodStart).toBe('2026-04-01')
      expect(QUARTER_CONFIG.S2.periodEnd).toBe('2026-07-31')
    })

    it('累積期間標籤應包含正確文字', () => {
      expect(QUARTER_CONFIG.S2.cumulativeLabel).toContain('2025/12')
      expect(QUARTER_CONFIG.S2.cumulativeLabel).toContain('2026/07')
    })

    it('單季期間標籤應包含正確文字', () => {
      expect(QUARTER_CONFIG.S2.periodLabel).toContain('2026/04')
      expect(QUARTER_CONFIG.S2.periodLabel).toContain('2026/07')
    })
  })

  describe('S3', () => {
    it('應顯示正確標籤', () => {
      expect(QUARTER_CONFIG.S3.label).toBe('2026 S3')
    })

    it('累積期間應為 2025-12-01 至 2026-11-30', () => {
      expect(QUARTER_CONFIG.S3.cumulativeStart).toBe('2025-12-01')
      expect(QUARTER_CONFIG.S3.cumulativeEnd).toBe('2026-11-30')
    })

    it('單季期間應為 2026-08-01 至 2026-11-30', () => {
      expect(QUARTER_CONFIG.S3.periodStart).toBe('2026-08-01')
      expect(QUARTER_CONFIG.S3.periodEnd).toBe('2026-11-30')
    })

    it('累積期間標籤應包含正確文字', () => {
      expect(QUARTER_CONFIG.S3.cumulativeLabel).toContain('2025/12')
      expect(QUARTER_CONFIG.S3.cumulativeLabel).toContain('2026/11')
    })

    it('單季期間標籤應包含正確文字', () => {
      expect(QUARTER_CONFIG.S3.periodLabel).toContain('2026/08')
      expect(QUARTER_CONFIG.S3.periodLabel).toContain('2026/11')
    })
  })
})
