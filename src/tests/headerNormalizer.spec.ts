import { describe, it, expect } from 'vitest'
import {
  normalizeHeaderName,
  fillMergedGroupNames,
  buildTwoLayerHeaders,
} from '@/services/headerNormalizer'

describe('headerNormalizer', () => {
  describe('normalizeHeaderName', () => {
    it('前後空白修剪', () => {
      expect(normalizeHeaderName('  欄位  ')).toBe('欄位')
    })

    it('全形空白轉半形', () => {
      // U+3000 IDEOGRAPHIC SPACE
      expect(normalizeHeaderName('群\u3000組')).toBe('群 組')
    })

    it('換行符號轉空白', () => {
      expect(normalizeHeaderName('欄\n位')).toBe('欄 位')
    })

    it('連續空白合併為單一空白', () => {
      expect(normalizeHeaderName('a  b   c')).toBe('a b c')
    })

    it('空字串回傳空字串', () => {
      expect(normalizeHeaderName('')).toBe('')
    })
  })

  describe('fillMergedGroupNames', () => {
    it('空格向右延伸', () => {
      expect(fillMergedGroupNames(['A', '', '', 'B'])).toEqual(['A', 'A', 'A', 'B'])
    })

    it('第一格空白不延伸（保持空）', () => {
      expect(fillMergedGroupNames(['', 'B', ''])).toEqual(['', 'B', 'B'])
    })

    it('全部空格維持原樣', () => {
      expect(fillMergedGroupNames(['', '', ''])).toEqual(['', '', ''])
    })
  })

  describe('buildTwoLayerHeaders', () => {
    it('合併群組行 + 欄位行', () => {
      const groups = ['群組', '', '', '其他']
      const fields = ['名稱', '子欄A', '子欄B', '標題']
      const result = buildTwoLayerHeaders(groups, fields)
      expect(result[0].key).toBe('群組_名稱')
      expect(result[1].key).toBe('群組_子欄A')
      expect(result[2].key).toBe('群組_子欄B')
      expect(result[3].key).toBe('其他_標題')
    })

    it('群組名稱 === 欄位名稱時不重複', () => {
      const groups = ['欄位']
      const fields = ['欄位']
      const result = buildTwoLayerHeaders(groups, fields)
      expect(result[0].key).toBe('欄位')
    })

    it('重複鍵加後綴 _2 _3', () => {
      // 同一群組同一欄位名稱出現三次
      const groups = ['G', 'G', 'G']
      const fields = ['F', 'F', 'F']
      const result = buildTwoLayerHeaders(groups, fields)
      expect(result[0].key).toBe('G_F')
      expect(result[1].key).toBe('G_F_2')
      expect(result[2].key).toBe('G_F_3')
    })

    it('群組空白 + 欄位有值，直接使用欄位名稱', () => {
      const groups = ['']
      const fields = ['欄位名稱']
      const result = buildTwoLayerHeaders(groups, fields)
      expect(result[0].key).toBe('欄位名稱')
    })

    it('originalGroup 與 originalField 保留原始值', () => {
      const groups = ['Group']
      const fields = ['Field']
      const result = buildTwoLayerHeaders(groups, fields)
      expect(result[0].originalGroup).toBe('Group')
      expect(result[0].originalField).toBe('Field')
    })
  })
})
