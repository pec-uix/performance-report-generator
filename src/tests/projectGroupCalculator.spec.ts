/**
 * projectGroupCalculator.spec.ts
 * 測試專案群組工時計算。
 *
 * 關鍵規則：群組工時 = 主項 + 所有子項（不重複加總）。
 * 例：主項=10, 子項1-1=5, 子項1-2=3 → 群組=18（非36）。
 *
 * 新 API：calculateProjectGroups 第 5 個參數為 moduleToItemNo Map，
 * 取代舊的 master.itemNo 作為工時與項次的對應鍵。
 */

import { describe, it, expect } from 'vitest'
import { calculateProjectGroups } from '@/services/projectGroupCalculator'
import type { NormalizedWorkRecord, ProjectMasterRecord } from '@/types/analysis'
import type { ProjectItem } from '@/types/project'

function makeRecord(
  projectKey: string,
  hours: number,
  employeeKey = 'EMP001',
  workDate = '2026-04-01'
): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate,
    employeeKey,
    workCategory: 'project',
    projectKey,
    hours,
  }
}

function makeMaintenanceRecord(
  maintenanceKey: string,
  hours: number,
  employeeKey = 'EMP001',
  workDate = '2026-04-01'
): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate,
    employeeKey,
    workCategory: 'maintenance',
    maintenanceKey,
    hours,
  }
}

function makeItem(
  normalizedItemNo: string,
  itemType: 'main' | 'child',
  parentItemNo?: string
): ProjectItem {
  return {
    rowIndex: 0,
    rawItemNo: normalizedItemNo,
    normalizedItemNo,
    itemType,
    parentItemNo,
    data: {},
    imageRefs: [],
  }
}

function makeMaster(projectKey: string, projectName: string): ProjectMasterRecord {
  return { projectKey, projectName }
}

describe('calculateProjectGroups', () => {
  const projectItems = [
    makeItem('1', 'main'),
    makeItem('1-1', 'child', '1'),
    makeItem('1-2', 'child', '1'),
    makeItem('2', 'main'),
  ]
  const masters = [
    makeMaster('PRJ-MAIN1', '専案1'),
    makeMaster('PRJ-CHILD1-1', '子項1-1'),
    makeMaster('PRJ-CHILD1-2', '子項1-2'),
    makeMaster('PRJ-MAIN2', '専案2'),
  ]
  // moduleToItemNo 是 calculateProjectGroups 的第 5 個參數
  const moduleToItemNo = new Map([
    ['PRJ-MAIN1',   '1'],
    ['PRJ-CHILD1-1', '1-1'],
    ['PRJ-CHILD1-2', '1-2'],
    ['PRJ-MAIN2',   '2'],
  ])

  it('群組工時 = 主項 + 所有子項（核心規則）', () => {
    const records = [
      makeRecord('PRJ-MAIN1', 10),
      makeRecord('PRJ-CHILD1-1', 5),
      makeRecord('PRJ-CHILD1-2', 3),
    ]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    const group1 = groups.find((g) => g.mainItemNo === '1')
    expect(group1).toBeDefined()
    expect(group1!.cumulativeHours).toBe(18)
    // 確認不是 36（沒有雙重計算）
    expect(group1!.cumulativeHours).not.toBe(36)
  })

  it('沒有子項的主項群組工時等於主項工時', () => {
    const records = [makeRecord('PRJ-MAIN2', 20)]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    const group2 = groups.find((g) => g.mainItemNo === '2')
    expect(group2).toBeDefined()
    expect(group2!.cumulativeHours).toBe(20)
    expect(group2!.children).toHaveLength(0)
  })

  it('累計與單季工時各自獨立計算', () => {
    const cumulativeRecords = [
      makeRecord('PRJ-MAIN1', 10, 'EMP001', '2025-12-01'),
      makeRecord('PRJ-CHILD1-1', 5, 'EMP001', '2025-12-15'),
    ]
    const quarterRecords = [makeRecord('PRJ-MAIN1', 3, 'EMP001', '2026-04-01')]
    const groups = calculateProjectGroups(
      cumulativeRecords,
      quarterRecords,
      masters,
      projectItems,
      moduleToItemNo
    )
    const g1 = groups.find((g) => g.mainItemNo === '1')
    expect(g1!.cumulativeHours).toBe(15)
    expect(g1!.quarterHours).toBe(3)
  })

  it('群組人數去重（同一人在主項和子項各有工時，只算一次）', () => {
    const records = [
      makeRecord('PRJ-MAIN1', 10, 'EMP001'),
      makeRecord('PRJ-CHILD1-1', 5, 'EMP001'), // 同一人
    ]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    const g1 = groups.find((g) => g.mainItemNo === '1')
    expect(g1!.cumulativePeopleCount).toBe(1)
  })

  it('不同員工的人數計算正確', () => {
    const records = [
      makeRecord('PRJ-MAIN1', 10, 'EMP001'),
      makeRecord('PRJ-CHILD1-1', 5, 'EMP002'),
    ]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    const g1 = groups.find((g) => g.mainItemNo === '1')
    expect(g1!.cumulativePeopleCount).toBe(2)
  })

  it('legacy moduleKey 可讓 maintenance 工時精確帶入主項', () => {
    const legacyItems = [makeItem('202304119', 'main')]
    const legacyMap = new Map([['202304119(UNI團購網系統維運)', '202304119']])
    const records = [makeMaintenanceRecord('202304119(UNI團購網系統維運)', 12, 'EMP001')]

    const groups = calculateProjectGroups(records, records, [], legacyItems, legacyMap)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.mainItemNo).toBe('202304119')
    expect(groups[0]?.cumulativeHours).toBe(12)
    expect(groups[0]?.quarterHours).toBe(12)
    expect(groups[0]?.cumulativePeopleCount).toBe(1)
  })

  it('code fallback 專案可用 record.moduleKey 對應，不要求 projectKey 已分類', () => {
    const items = [makeItem('13', 'main')]
    const map = new Map([['202606001(AI視覺風險管理平台專案)', '13']])
    const record: NormalizedWorkRecord = {
      sourceRow: 2,
      workDate: '2026-04-01',
      employeeKey: 'EMP001',
      moduleKey: '202606001(AI視覺風險管理平台專案)',
      moduleName: '202606001(AI視覺風險管理平台專案)',
      workCategory: 'project',
      hours: 38.5,
    }
    const groups = calculateProjectGroups([record], [record], [], items, map)
    expect(groups[0]?.cumulativeHours).toBe(38.5)
    expect(groups[0]?.quarterHours).toBe(38.5)
  })

  it('孤立子項（找不到父項）不被合併至任何群組', () => {
    const orphanItems = [makeItem('3-1', 'child', '3')] // 父項 3 不存在
    const orphanMasters = [makeMaster('PRJ-ORPHAN', '孤立子項')]
    const orphanMap = new Map([['PRJ-ORPHAN', '3-1']])
    const records = [makeRecord('PRJ-ORPHAN', 10)]
    const groups = calculateProjectGroups(records, records, orphanMasters, orphanItems, orphanMap)
    // 沒有主項，所以不會出現在任何群組中
    const orphanGroup = groups.find((g) => g.mainItemNo === '3')
    expect(orphanGroup).toBeUndefined()
  })

  it('主項無直接工時時，群組工時 = 子項工時之和', () => {
    const records = [makeRecord('PRJ-CHILD1-1', 5), makeRecord('PRJ-CHILD1-2', 3)]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    const g1 = groups.find((g) => g.mainItemNo === '1')
    expect(g1!.cumulativeHours).toBe(8)
    expect(g1!.mainProject.cumulativeHours).toBe(0)
  })

  it('revenue 預設為 null', () => {
    const records = [makeRecord('PRJ-MAIN1', 10)]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    expect(groups[0].revenue).toBeNull()
    expect(groups[0].mainProject.revenue).toBeNull()
  })

  it('多個群組各自獨立計算，不互相干擾', () => {
    const records = [makeRecord('PRJ-MAIN1', 10), makeRecord('PRJ-MAIN2', 20)]
    const groups = calculateProjectGroups(records, records, masters, projectItems, moduleToItemNo)
    expect(groups).toHaveLength(2)
    const g1 = groups.find((g) => g.mainItemNo === '1')
    const g2 = groups.find((g) => g.mainItemNo === '2')
    expect(g1!.cumulativeHours).toBe(10)
    expect(g2!.cumulativeHours).toBe(20)
  })

  it('moduleToItemNo 為空 Map 時所有群組工時均為 0', () => {
    const records = [makeRecord('PRJ-MAIN1', 10), makeRecord('PRJ-MAIN2', 20)]
    const emptyMap = new Map<string, string>()
    const groups = calculateProjectGroups(records, records, masters, projectItems, emptyMap)
    for (const g of groups) {
      expect(g.cumulativeHours).toBe(0)
    }
  })
})
