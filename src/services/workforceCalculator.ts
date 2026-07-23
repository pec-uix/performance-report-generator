/**
 * workforceCalculator.ts
 * 從 NormalizedWorkRecord[] 計算人力統計。
 *
 * 注意：
 * - activePeopleCount 為去重後的員工數（同一人同時有專案和維運工時，只算一次）。
 * - hours > 0 才算入 activePeopleCount。
 * - personMonths 需要月標準工時設定，此計算器不直接計算（由 reportAnalysisService 合併）。
 */

import type {
  NormalizedWorkRecord,
  WorkforceSummary,
  PersonWorkSummary,
  WorkCategory,
} from '@/types/analysis'

export function calculateWorkforce(records: NormalizedWorkRecord[]): WorkforceSummary {
  // 彙整每人的工時摘要
  const personMap = new Map<string, PersonWorkSummary>()

  for (const r of records) {
    let person = personMap.get(r.employeeKey)
    if (!person) {
      person = {
        employeeKey: r.employeeKey,
        employeeName: r.employeeName,
        totalHours: 0,
        projectHours: 0,
        maintenanceHours: 0,
        otherHours: 0,
        categories: [],
      }
      personMap.set(r.employeeKey, person)
    }

    person.totalHours += r.hours
    if (r.workCategory === 'project') {
      person.projectHours += r.hours
    } else if (r.workCategory === 'maintenance') {
      person.maintenanceHours += r.hours
    } else {
      person.otherHours += r.hours
    }

    const cat: WorkCategory = r.workCategory
    if (!person.categories.includes(cat)) {
      person.categories.push(cat)
    }
  }

  const people = Array.from(personMap.values())

  // activePeopleCount：hours > 0 的不重複員工數
  const activePeople = people.filter((p) => p.totalHours > 0)
  const activePeopleCount = activePeople.length

  const totalHours = people.reduce((sum, p) => sum + p.totalHours, 0)

  // 各分類員工計數（同一人可同時出現在多個分類中，不應相加為 activePeopleCount）
  const projectPeopleCount     = activePeople.filter((p) => p.projectHours     > 0).length
  const maintenancePeopleCount = activePeople.filter((p) => p.maintenanceHours > 0).length
  const otherPeopleCount       = activePeople.filter((p) => p.otherHours       > 0).length

  const averageHoursPerPerson =
    activePeopleCount > 0 ? totalHours / activePeopleCount : null

  return {
    activePeopleCount,
    totalHours,
    averageHoursPerPerson,
    projectPeopleCount,
    maintenancePeopleCount,
    otherPeopleCount,
    people,
    personMonthsStatus: 'not-configured',
    personMonths: null,
  }
}
