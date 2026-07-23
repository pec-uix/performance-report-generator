/**
 * textPagination.spec.ts
 * 驗證文字清理、行數估算、截斷與分頁服務。
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeText,
  estimateTextLines,
  truncateTextSafely,
  paginateTextBlocks,
} from '@/services/textPaginationService'

describe('textPaginationService', () => {
  describe('sanitizeText', () => {
    it('空字串回傳空字串', () => {
      expect(sanitizeText('')).toBe('')
    })

    it('移除 HTML 標籤', () => {
      expect(sanitizeText('<b>粗體</b>')).toBe('粗體')
    })

    it('移除 script 標籤及內容', () => {
      const input = '<script>alert("xss")</script>正常文字'
      expect(sanitizeText(input)).not.toContain('alert')
      expect(sanitizeText(input)).toContain('正常文字')
    })

    it('移除 style 標籤及內容', () => {
      const input = '<style>body{color:red}</style>文字'
      expect(sanitizeText(input)).not.toContain('body{color:red}')
      expect(sanitizeText(input)).toContain('文字')
    })

    it('還原 HTML entities', () => {
      expect(sanitizeText('&amp;&lt;&gt;')).toBe('&<>')
    })

    it('保留中文字元', () => {
      const text = '這是中文文字。'
      expect(sanitizeText(text)).toBe(text)
    })

    it('保留換行', () => {
      const input = '第一行\n第二行'
      expect(sanitizeText(input)).toBe('第一行\n第二行')
    })

    it('合併多餘空白', () => {
      expect(sanitizeText('Hello   World')).toBe('Hello World')
    })

    it('trim 頭尾空白', () => {
      expect(sanitizeText('  內容  ')).toBe('內容')
    })
  })

  describe('estimateTextLines', () => {
    it('空字串回傳 0', () => {
      expect(estimateTextLines('', 40)).toBe(0)
    })

    it('短文字（< charsPerLine）回傳 1', () => {
      expect(estimateTextLines('Hello', 40)).toBe(1)
    })

    it('剛好 charsPerLine 個字元回傳 1', () => {
      expect(estimateTextLines('a'.repeat(40), 40)).toBe(1)
    })

    it('超過 charsPerLine 回傳 2', () => {
      expect(estimateTextLines('a'.repeat(41), 40)).toBe(2)
    })

    it('兩倍 charsPerLine 回傳 2', () => {
      expect(estimateTextLines('a'.repeat(80), 40)).toBe(2)
    })

    it('自然換行各自計算', () => {
      const text = '一行\n二行'
      expect(estimateTextLines(text, 40)).toBe(2)
    })

    it('空行計為 1 行', () => {
      const text = '一行\n\n三行'
      expect(estimateTextLines(text, 40)).toBe(3)
    })

    it('使用預設 charsPerLine', () => {
      expect(estimateTextLines('短文字')).toBe(1)
    })
  })

  describe('truncateTextSafely', () => {
    it('短文字不截斷', () => {
      expect(truncateTextSafely('短文字', 10, 40)).toBe('短文字')
    })

    it('剛好 maxLines 不截斷', () => {
      const text = 'a'.repeat(40) // 1 行
      expect(truncateTextSafely(text, 1, 40)).toBe(text)
    })

    it('超出 maxLines 時截斷', () => {
      const longText = Array(5).fill('a'.repeat(40)).join('\n') // 5 行
      const result = truncateTextSafely(longText, 2, 40)
      expect(estimateTextLines(result, 40)).toBeLessThanOrEqual(2)
    })

    it('截斷時加入截斷標記', () => {
      const longText = 'a'.repeat(200) // 5 行（charsPerLine=40）
      const result = truncateTextSafely(longText, 2, 40)
      expect(result).toContain('內容節錄')
    })

    it('空字串回傳空字串', () => {
      expect(truncateTextSafely('', 10, 40)).toBe('')
    })

    it('截斷後長度合理（不超過原始長度 + 標記長度）', () => {
      const longText = 'a'.repeat(400)
      const result = truncateTextSafely(longText, 3, 40)
      expect(result.length).toBeLessThan(longText.length)
    })
  })

  describe('paginateTextBlocks', () => {
    it('空字串回傳包含空字串的陣列', () => {
      const pages = paginateTextBlocks('', 10, 40)
      expect(pages).toHaveLength(1)
      expect(pages[0]).toBe('')
    })

    it('短文字回傳單一頁', () => {
      const text = '短文字'
      const pages = paginateTextBlocks(text, 10, 40)
      expect(pages).toHaveLength(1)
      expect(pages[0]).toBe(text)
    })

    it('長文字分成多頁', () => {
      // 3 頁各 1 行，maxLinesPerPage = 1
      const text = '第一行\n第二行\n第三行'
      const pages = paginateTextBlocks(text, 1, 40)
      expect(pages).toHaveLength(3)
    })

    it('所有內容都保留在分頁結果中', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `第 ${i + 1} 行`)
      const text = lines.join('\n')
      const pages = paginateTextBlocks(text, 3, 40)
      const allContent = pages.join('\n')
      for (const line of lines) {
        expect(allContent).toContain(line)
      }
    })

    it('每頁行數不超過 maxLinesPerPage', () => {
      const text = Array.from({ length: 20 }, (_, i) => `行 ${i + 1}`).join('\n')
      const pages = paginateTextBlocks(text, 5, 40)
      for (const page of pages) {
        const lineCount = estimateTextLines(page, 40)
        expect(lineCount).toBeLessThanOrEqual(5)
      }
    })

    it('自動換行長行正確分頁', () => {
      // 一行 80 chars = 2 虛擬行（charsPerLine=40）
      const text = 'a'.repeat(80)
      const pages = paginateTextBlocks(text, 2, 40)
      expect(pages).toHaveLength(1) // 剛好 2 行可放進一頁
    })
  })
})
