/**
 * workHoursCalculator.ts
 * 從 NormalizedWorkRecord[] 計算工時分類統計。
 */

import type { NormalizedWorkRecord, WorkHoursSummary } from '@/types/analysis'

/**
 * 計算工時統計摘要。
 * - totalHours = 0 時，ratio 均為 0（不產生 NaN）。
 * - 不四捨五入，保留完整精度。
 */
export function calculateWorkHours(records: NormalizedWorkRecord[]): WorkHoursSummary {
  let totalHours = 0
  let projectHours = 0
  let maintenanceHours = 0
  let otherHours = 0

  for (const r of records) {
    totalHours += r.hours
    if (r.workCategory === 'project') {
      projectHours += r.hours
    } else if (r.workCategory === 'maintenance') {
      maintenanceHours += r.hours
    } else {
      otherHours += r.hours
    }
  }

  const projectRatio     = totalHours > 0 ? projectHours     / totalHours : 0
  const maintenanceRatio = totalHours > 0 ? maintenanceHours / totalHours : 0
  const otherRatio       = totalHours > 0 ? otherHours       / totalHours : 0

  return {
    totalHours,
    projectHours,
    maintenanceHours,
    otherHours,
    projectRatio,
    maintenanceRatio,
    otherRatio,
    recordCount: records.length,
  }
}
