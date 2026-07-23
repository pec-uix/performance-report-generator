/**
 * projectGroupCalculator.ts
 * 依専案項次階層（主項/子項）彙整工時。
 *
 * 群組工時 = 主項工時 + 所有子項工時之加總（不重複計算）。
 * 例：主項=10, 子項1-1=5, 子項1-2=3 → 群組=18（非36）。
 *
 * ─── 重要設計：moduleKey → itemNo 映射 ─────────────────────────────────────
 * 透過 moduleToItemNo（来自 専案對應表）精確對應，
 * 不再使用 ProjectMasterRecord.itemNo（該欄存的是資料庫流水號，非顯示序號）。
 */

import type { NormalizedWorkRecord, ProjectAnalysis, ProjectGroupAnalysis } from '@/types/analysis'
import type { ProjectMasterRecord } from '@/types/analysis'
import type { ProjectItem } from '@/types/project'
import { PROJECT_CONTENT_NAME_FIELD_ALIASES } from '@/config/requiredSheets'

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
 * 從 専案內容 data 物件中尋找専案名稱欄位值（完整比對別名清單）。
 */
function findProjectContentName(data: Record<string, unknown>): string | undefined {
  for (const alias of PROJECT_CONTENT_NAME_FIELD_ALIASES) {
    // 嘗試精確 key 比對
    const val = data[alias]
    if (typeof val === 'string' && val.trim()) return val.trim()
    // 嘗試含群組前綴的 key（格式：GROUP_FIELDNAME）
    for (const key of Object.keys(data)) {
      if (key.endsWith(`_${alias}`)) {
        const v = data[key]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
    }
  }
  return undefined
}

/**
 * 計算各専案群組的工時與人力。
 *
 * @param cumulativeRecords - 累計期間（含首尾）的工時記錄
 * @param quarterRecords    - 單季期間的工時記錄
 * @param projectMasters    - 專案主檔（供専案名稱備用查詢）
 * @param projectItems      - Phase 2 専案項目（含主/子項層級）
 * @param moduleToItemNo    - 来自「専案對應表」的 moduleKey → itemNo 精確映射
 */
export function calculateProjectGroups(
  cumulativeRecords: NormalizedWorkRecord[],
  quarterRecords: NormalizedWorkRecord[],
  projectMasters: ProjectMasterRecord[],
  projectItems: ProjectItem[],
  moduleToItemNo: ReadonlyMap<string, string>
): ProjectGroupAnalysis[] {
  // 建立 projectKey → ProjectMasterRecord 查找表（供名稱備用）
  const masterByKey = new Map<string, ProjectMasterRecord>()
  for (const m of projectMasters) {
    if (!masterByKey.has(m.projectKey)) {
      masterByKey.set(m.projectKey, m)
    }
  }

  // 建立反向映射：itemNo → Set<moduleKey>（供按項次查找名稱）
  const modulesForItemNo = new Map<string, Set<string>>()
  for (const [moduleKey, itemNo] of moduleToItemNo) {
    const set = modulesForItemNo.get(itemNo) ?? new Set<string>()
    set.add(moduleKey)
    modulesForItemNo.set(itemNo, set)
  }

  // 針對工時記錄取得 itemNo（直接查 moduleToItemNo）
  function getItemNoForRecord(record: NormalizedWorkRecord): string | null {
    const recordModuleKey = record.projectKey ?? record.maintenanceKey ?? record.moduleKey
    if (!recordModuleKey) return null
    return moduleToItemNo.get(recordModuleKey) ?? null
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

  /**
   * 決定某項次的専案名稱：
   * 優先 1 — 専案內容 data 欄（PROJECT_CONTENT_NAME_FIELD_ALIASES）
   * 優先 2 — 専案清單任務名稱（透過 modulesForItemNo → masterByKey）
   * 優先 3 — undefined（呼叫端顯示「未命名」）
   */
  function resolveProjectName(itemNo: string, item: ProjectItem): string | undefined {
    const contentName = findProjectContentName(item.data)
    if (contentName) return contentName
    const modules = modulesForItemNo.get(itemNo) ?? new Set<string>()
    for (const moduleKey of modules) {
      const master = masterByKey.get(moduleKey)
      if (master?.projectName) return master.projectName
    }
    return undefined
  }

  /**
   * 取得某項次的第一個 moduleKey（供 projectKey 欄位回傳）
   */
  function resolveProjectKey(itemNo: string): string | undefined {
    const modules = modulesForItemNo.get(itemNo)
    if (!modules || modules.size === 0) return undefined
    return Array.from(modules)[0]
  }

  // 依主項建立群組
  const groups: ProjectGroupAnalysis[] = []

  const mainItems = projectItems.filter((item) => item.itemType === 'main')

  for (const mainItem of mainItems) {
    const mainItemNo = mainItem.normalizedItemNo
    const mainHours = hoursByItemNo.get(mainItemNo) ?? emptyItemHours()

    const mainAnalysis: ProjectAnalysis = {
      itemNo: mainItemNo,
      itemType: 'main',
      projectKey: resolveProjectKey(mainItemNo),
      projectName: resolveProjectName(mainItemNo, mainItem),
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
      const childHours = hoursByItemNo.get(childItemNo) ?? emptyItemHours()

      return {
        itemNo: childItemNo,
        itemType: 'child' as const,
        projectKey: resolveProjectKey(childItemNo),
        projectName: resolveProjectName(childItemNo, childItem),
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

