import { describe, it, expect } from 'vitest'
import {
  normalizeItemNo,
  classifyItemNo,
  validateProjectItems,
} from '@/services/projectItemValidator'
import type { ProjectItem } from '@/types/project'

// ── 測試輔助 ──────────────────────────────────────────────────────
function makeItem(rawItemNo: string, rowIndex: number = 0): ProjectItem {
  return {
    rowIndex,
    rawItemNo,
    normalizedItemNo: '',
    itemType: 'invalid',
    data: {},
    imageRefs: [],
  }
}

describe('projectItemValidator', () => {
  describe('normalizeItemNo', () => {
    it('純整數不變', () => {
      expect(normalizeItemNo('1')).toBe('1')
    })

    it('全形破折號轉半形', () => {
      expect(normalizeItemNo('1－1')).toBe('1-1')
    })

    it('破折號前後空白移除', () => {
      expect(normalizeItemNo('1 - 1')).toBe('1-1')
    })

    it('前後空白修剪', () => {
      expect(normalizeItemNo('  3  ')).toBe('3')
    })

    it('空字串保持空字串', () => {
      expect(normalizeItemNo('')).toBe('')
    })
  })

  describe('classifyItemNo', () => {
    it('純整數 → main', () => {
      expect(classifyItemNo('1')).toBe('main')
      expect(classifyItemNo('10')).toBe('main')
      expect(classifyItemNo('999')).toBe('main')
    })

    it('整數-整數 → child', () => {
      expect(classifyItemNo('1-1')).toBe('child')
      expect(classifyItemNo('10-3')).toBe('child')
    })

    it('空字串 → invalid', () => {
      expect(classifyItemNo('')).toBe('invalid')
    })

    it('多層巢狀 → invalid', () => {
      expect(classifyItemNo('1-1-1')).toBe('invalid')
    })

    it('英文字母 → invalid', () => {
      expect(classifyItemNo('A-1')).toBe('invalid')
      expect(classifyItemNo('ABC')).toBe('invalid')
    })

    it('小數點 → invalid', () => {
      expect(classifyItemNo('1.1')).toBe('invalid')
    })

    it('底線分隔 → invalid', () => {
      expect(classifyItemNo('1_1')).toBe('invalid')
    })
  })

  describe('validateProjectItems', () => {
    it('正常主+子專案，無 issue', () => {
      const items = [makeItem('1', 0), makeItem('1-1', 1), makeItem('2', 2)]
      const result = validateProjectItems(items)
      expect(result.issues).toHaveLength(0)
      expect(result.mainCount).toBe(2)
      expect(result.childCount).toBe(1)
    })

    it('重複項次 → PI_DUPLICATE_ITEM_NO error', () => {
      const items = [makeItem('1', 0), makeItem('1', 1)]
      const result = validateProjectItems(items)
      expect(result.issues.some((i) => i.code === 'PI_DUPLICATE_ITEM_NO')).toBe(true)
      expect(result.duplicateCount).toBe(1)
    })

    it('孤兒子專案 → PI_ORPHAN_CHILD error', () => {
      const items = [makeItem('1-1', 0)] // 沒有父專案 1
      const result = validateProjectItems(items)
      expect(result.issues.some((i) => i.code === 'PI_ORPHAN_CHILD')).toBe(true)
      expect(result.orphanChildCount).toBe(1)
    })

    it('子先於父 → PI_CHILD_BEFORE_PARENT warning', () => {
      const items = [makeItem('1-1', 0), makeItem('1', 1)]
      const result = validateProjectItems(items)
      expect(result.issues.some((i) => i.code === 'PI_CHILD_BEFORE_PARENT')).toBe(true)
      const warn = result.issues.find((i) => i.code === 'PI_CHILD_BEFORE_PARENT')
      expect(warn?.severity).toBe('warning')
    })

    it('空白項次 → PI_INVALID_ITEM_NO error', () => {
      const items = [makeItem('', 0)]
      const result = validateProjectItems(items)
      expect(result.issues.some((i) => i.code === 'PI_INVALID_ITEM_NO')).toBe(true)
    })

    it('無效格式 → PI_INVALID_ITEM_NO error', () => {
      const items = [makeItem('ABC', 0)]
      const result = validateProjectItems(items)
      expect(result.issues.some((i) => i.code === 'PI_INVALID_ITEM_NO')).toBe(true)
    })
  })
})
