/**
 * projectRanking.ts
 * 將 ProjectGroupAnalysis[] 依工時由高到低排序。
 *
 * 設計原則：
 * - 不修改原始陣列。
 * - 相同工時時，以原始順序（主項次字典序）為穩定次排序鍵。
 * - 回傳完整列表；呈現層（view/component）自行決定顯示幾筆。
 */

import type { ProjectGroupAnalysis } from '@/types/analysis'

/**
 * 依累計工時排序（由高到低）。
 */
export function rankByCumulativeHours(
  groups: ProjectGroupAnalysis[]
): ProjectGroupAnalysis[] {
  return [...groups].sort((a, b) => {
    const diff = b.cumulativeHours - a.cumulativeHours
    if (diff !== 0) return diff
    // 穩定次排序：主項次字典序
    return a.mainItemNo.localeCompare(b.mainItemNo, 'zh-TW', { numeric: true })
  })
}

/**
 * 依單季工時排序（由高到低）。
 */
export function rankByQuarterHours(
  groups: ProjectGroupAnalysis[]
): ProjectGroupAnalysis[] {
  return [...groups].sort((a, b) => {
    const diff = b.quarterHours - a.quarterHours
    if (diff !== 0) return diff
    return a.mainItemNo.localeCompare(b.mainItemNo, 'zh-TW', { numeric: true })
  })
}
