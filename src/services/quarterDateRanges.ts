/**
 * quarterDateRanges.ts
 * 根據季度代碼從 QUARTER_CONFIG 取得累計與單季的日期範圍。
 */

import { QUARTER_CONFIG } from '@/config/quarterConfig'
import type { QuarterKey } from '@/types/report'
import type { QuarterDateRanges } from '@/types/analysis'

/**
 * 取得指定季度的累計與單季日期範圍（均為 YYYY-MM-DD，含首尾）。
 */
export function getQuarterDateRanges(quarter: QuarterKey): QuarterDateRanges {
  const config = QUARTER_CONFIG[quarter]
  return {
    cumulative: {
      start: config.cumulativeStart,
      end: config.cumulativeEnd,
    },
    quarter: {
      start: config.periodStart,
      end: config.periodEnd,
    },
  }
}
