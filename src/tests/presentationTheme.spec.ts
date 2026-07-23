/**
 * presentationTheme.spec.ts
 * 驗證 Phase 5 統一視覺設定的完整性與規範。
 */

import { describe, it, expect } from 'vitest'
import {
  PRES_FONT,
  PRES_FONT_SIZE,
  PRES_COLOR,
  PRES_LAYOUT,
  PRES_TABLE_BORDER,
  PRES_TEXT_LAYOUT,
  PRES_IMAGE_PER_PAGE,
} from '@/config/presentationTheme'

// ── 輔助函式 ──────────────────────────────────────────────────────────────

function isValidHex(color: string): boolean {
  return /^[0-9A-Fa-f]{6}$/.test(color)
}

describe('presentationTheme', () => {
  describe('PRES_FONT', () => {
    it('字型名稱為非空字串', () => {
      expect(typeof PRES_FONT).toBe('string')
      expect(PRES_FONT.length).toBeGreaterThan(0)
    })

    it('字型名稱包含 JhengHei（正黑體）', () => {
      expect(PRES_FONT).toContain('JhengHei')
    })
  })

  describe('PRES_FONT_SIZE', () => {
    it('最小字級 min >= 12', () => {
      expect(PRES_FONT_SIZE.min).toBeGreaterThanOrEqual(12)
    })

    it('標題最小字級 titleMin >= 20', () => {
      expect(PRES_FONT_SIZE.titleMin).toBeGreaterThanOrEqual(20)
    })

    it('slideTitle >= min', () => {
      expect(PRES_FONT_SIZE.slideTitle).toBeGreaterThanOrEqual(PRES_FONT_SIZE.min)
    })

    it('tableBody >= 10（表格專用小字型可低於全域最小值）', () => {
      expect(PRES_FONT_SIZE.tableBody).toBeGreaterThanOrEqual(10)
    })

    it('caption >= 10（圖說專用小字型可低於全域最小值）', () => {
      expect(PRES_FONT_SIZE.caption).toBeGreaterThanOrEqual(10)
    })

    it('coverTitle 為最大字級', () => {
      expect(PRES_FONT_SIZE.coverTitle).toBeGreaterThanOrEqual(PRES_FONT_SIZE.slideTitle)
    })
  })

  describe('PRES_COLOR', () => {
    it('所有色票均為 6 位 hex 字串', () => {
      for (const [key, value] of Object.entries(PRES_COLOR)) {
        expect(isValidHex(value), `Color ${key} = "${value}" 應為 6-char hex`).toBe(true)
      }
    })

    it('封面背景色為深藍', () => {
      expect(PRES_COLOR.coverBg).toBe('1E3A5F')
    })

    it('封面文字色為白色', () => {
      expect(PRES_COLOR.coverText).toBe('FFFFFF')
    })

    it('表格標頭背景色與標題色相同', () => {
      expect(PRES_COLOR.headerBg).toBe(PRES_COLOR.titleText)
    })
  })

  describe('PRES_LAYOUT', () => {
    it('投影片寬度 16:9 比例（slideW > slideH）', () => {
      expect(PRES_LAYOUT.slideW).toBeGreaterThan(PRES_LAYOUT.slideH)
    })

    it('slideW = 10 inches（LAYOUT_16x9）', () => {
      expect(PRES_LAYOUT.slideW).toBe(10)
    })

    it('footerY < slideH（頁尾在投影片內）', () => {
      expect(PRES_LAYOUT.footerY).toBeLessThan(PRES_LAYOUT.slideH)
    })

    it('contentY > titleY（內容在標題下方）', () => {
      expect(PRES_LAYOUT.contentY).toBeGreaterThan(PRES_LAYOUT.titleY)
    })

    it('padX > 0', () => {
      expect(PRES_LAYOUT.padX).toBeGreaterThan(0)
    })
  })

  describe('PRES_TABLE_BORDER', () => {
    it('type 為 solid', () => {
      expect(PRES_TABLE_BORDER.type).toBe('solid')
    })

    it('color 為有效 hex', () => {
      expect(isValidHex(PRES_TABLE_BORDER.color)).toBe(true)
    })
  })

  describe('PRES_TEXT_LAYOUT', () => {
    it('charsPerLineZh > 0', () => {
      expect(PRES_TEXT_LAYOUT.charsPerLineZh).toBeGreaterThan(0)
    })

    it('maxLinesPerTextSlide > 0', () => {
      expect(PRES_TEXT_LAYOUT.maxLinesPerTextSlide).toBeGreaterThan(0)
    })

    it('truncateSuffix 非空', () => {
      expect(PRES_TEXT_LAYOUT.truncateSuffix.length).toBeGreaterThan(0)
    })
  })

  describe('PRES_IMAGE_PER_PAGE', () => {
    it('每頁圖片上限 = 4', () => {
      expect(PRES_IMAGE_PER_PAGE).toBe(4)
    })
  })
})
