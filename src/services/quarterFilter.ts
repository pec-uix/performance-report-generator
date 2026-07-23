/**
 * quarterFilter.ts
 * 依日期範圍過濾工時記錄。
 *
 * 設計原則：
 * - 使用 YYYY-MM-DD 字串的字典序比較（等同於日期大小比較）。
 * - 含首尾兩端（inclusive）。
 * - 不修改原始陣列。
 */

import type { DateRange } from '@/types/analysis'

/**
 * 過濾出日期落在 range 內的記錄。
 * 泛型 T 必須包含 workDate: string（YYYY-MM-DD）。
 *
 * @param records - 原始記錄陣列（不被修改）
 * @param range   - 日期範圍（start/end 均為 YYYY-MM-DD，含首尾）
 * @returns 新陣列，僅包含在範圍內的記錄
 */
export function filterRecordsByDateRange<T extends { workDate: string }>(
  records: T[],
  range: DateRange
): T[] {
  return records.filter(
    (r) => r.workDate >= range.start && r.workDate <= range.end
  )
}
