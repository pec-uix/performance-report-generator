/**
 * projectGroupCalculator.ts
 * 依專案項次階層（主項/子項）彙整工時。
 *
 * 群組工時 = 主項工時 + 所有子項工時之加總（不重複計算）。
 * 例：主項=10, 子項1-1=5, 子項1-2=3 → 群組=18（非36）。
 */

import type { NormalizedWorkRecord, ProjectAnalysis, ProjectGroupAnalysis } from '@/types/analysis'
import type { ProjectMasterRecord } from '@/types/analysis'
import type { ProjectItem } from '@/types/project'

interface ItemHours {
  cumulativeHours: number
  quarterHours: number
  cumulativePeople: Set<string>
  quarterPeople: Set<string>
}

function emptyItemHours(): ItemHours {
  return {
    cumulativeHours: 0,
    quarterHours: 0,
    cumulativePeople: new Set(),
    quarterPeople: new Set(),
  }
}

/**
 * 計算各專案群組的工時與人力。
 *
 * @param cumulativeRecords - 累計期間（含首尾）的工時記錄
 * @param quarterRecords    - 單季期間的工時記錄
 * @param projectMasters    - 專案主檔（projectKey → itemNo 的映射）
 * @param projectItems      - Phase 2 專案項目（含主/子項層級）
 */
export function calculateProjectGroups(
  cumulativeRecords: NormalizedWorkRecord[],
  quarterRecords: NormalizedWorkRecord[],
  projectMasters: ProjectMasterRecord[],
  projectItems: ProjectItem[]
): ProjectGroupAnalysis[] {
  // 建立 projectKey → ProjectMasterRecord 查找表
  const masterByKey = new Map<string, ProjectMasterRecord>()
  for (const m of projectMasters) {
    if (!masterByKey.has(m.projectKey)) {
      masterByKey.set(m.projectKey, m)
    }
  }

  // 建立 itemNo → ProjectItem 查找表
  const itemByItemNo = new Map<string, ProjectItem>()
  for (const item of projectItems) {
    if (item.itemType !== 'invalid') {
      itemByItemNo.set(item.normalizedItemNo, item)
    }
  }

  // 針對工時記錄取得 itemNo
  function getItemNoForRecord(record: NormalizedWorkRecord): string | null {
    if (!record.projectKey) return null
    const master = masterByKey.get(record.projectKey)
    if (!master || !master.itemNo) return null
    return master.itemNo
  }

  // 彙整各 itemNo 的工時與人力
  const hoursByItemNo = new Map<string, ItemHours>()

  function accumulateRecord(
    record: NormalizedWorkRecord,
    itemNo: string,
    isCumulative: boolean
  ): void {
    if (!hoursByItemNo.has(itemNo)) {
      hoursByItemNo.set(itemNo, emptyItemHours())
    }
    const entry = hoursByItemNo.get(itemNo) as ItemHours
    if (isCumulative) {
      entry.cumulativeHours += record.hours
      entry.cumulativePeople.add(record.employeeKey)
    } else {
      entry.quarterHours += record.hours
      entry.quarterPeople.add(record.employeeKey)
    }
  }

  for (const r of cumulativeRecords) {
    const itemNo = getItemNoForRecord(r)
    if (itemNo) accumulateRecord(r, itemNo, true)
  }

  for (const r of quarterRecords) {
    const itemNo = getItemNoForRecord(r)
    if (itemNo) accumulateRecord(r, itemNo, false)
  }

  // 建立子項分組：parentItemNo → ProjectItem[]
  const childrenByParent = new Map<string, ProjectItem[]>()
  for (const item of projectItems) {
    if (item.itemType === 'child' && item.parentItemNo) {
      const children = childrenByParent.get(item.parentItemNo) ?? []
      children.push(item)
      childrenByParent.set(item.parentItemNo, children)
    }
  }

  // 依主項建立群組
  const groups: ProjectGroupAnalysis[] = []

  const mainItems = projectItems.filter((item) => item.itemType === 'main')

  for (const mainItem of mainItems) {
    const mainItemNo = mainItem.normalizedItemNo
    const mainMaster = Array.from(masterByKey.values()).find((m) => m.itemNo === mainItemNo)
    const mainHours = hoursByItemNo.get(mainItemNo) ?? emptyItemHours()

    const mainAnalysis: ProjectAnalysis = {
      itemNo: mainItemNo,
      itemType: 'main',
      projectKey: mainMaster?.projectKey,
      projectName: mainMaster?.projectName,
      cumulativeHours: mainHours.cumulativeHours,
      quarterHours: mainHours.quarterHours,
      cumulativePeopleCount: mainHours.cumulativePeople.size,
      quarterPeopleCount: mainHours.quarterPeople.size,
      revenue: null,
    }

    // 子項分析
    const childItems = childrenByParent.get(mainItemNo) ?? []
    const childAnalyses: ProjectAnalysis[] = childItems.map((childItem) => {
      const childItemNo = childItem.normalizedItemNo
      const childMaster = Array.from(masterByKey.values()).find((m) => m.itemNo === childItemNo)
      const childHours = hoursByItemNo.get(childItemNo) ?? emptyItemHours()

      return {
        itemNo: childItemNo,
        itemType: 'child' as const,
        projectKey: childMaster?.projectKey,
        projectName: childMaster?.projectName,
        cumulativeHours: childHours.cumulativeHours,
        quarterHours: childHours.quarterHours,
        cumulativePeopleCount: childHours.cumulativePeople.size,
        quarterPeopleCount: childHours.quarterPeople.size,
        revenue: null,
      }
    })

    // 群組工時 = 主項 + 所有子項（不重複加總）
    const groupCumulativeHours =
      mainHours.cumulativeHours + childAnalyses.reduce((s, c) => s + c.cumulativeHours, 0)
    const groupQuarterHours =
      mainHours.quarterHours + childAnalyses.reduce((s, c) => s + c.quarterHours, 0)

    // 群組去重人數（主項 ∪ 所有子項）
    const groupCumulativePeople = new Set(mainHours.cumulativePeople)
    const groupQuarterPeople    = new Set(mainHours.quarterPeople)

    for (const childItem of childItems) {
      const childHours = hoursByItemNo.get(childItem.normalizedItemNo)
      if (childHours) {
        for (const p of childHours.cumulativePeople) groupCumulativePeople.add(p)
        for (const p of childHours.quarterPeople)    groupQuarterPeople.add(p)
      }
    }

    groups.push({
      mainItemNo,
      mainProject: mainAnalysis,
      children: childAnalyses,
      cumulativeHours: groupCumulativeHours,
      quarterHours: groupQuarterHours,
      cumulativePeopleCount: groupCumulativePeople.size,
      quarterPeopleCount: groupQuarterPeople.size,
      revenue: null,
    })
  }

  return groups
}
