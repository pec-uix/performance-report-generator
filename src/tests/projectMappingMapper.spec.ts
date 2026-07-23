/**
 * projectMappingMapper.spec.ts
 * 測試「専案對應表」解析器，以及 calculateProjectGroups 中的名稱優先級邏輯。
 *
 * 10 個必要測試：
 *  1. 一個項次對應一個模組（基本功能）
 *  2. 多個模組對應同一項次（一對多）
 *  3. 主項（"1"）與子項（"1-1"）分別對應不同模組
 *  4. 同一模組對應到不同項次 → AMBIGUOUS_MODULE_ITEM_MAPPING Error
 *  5. 重複行（相同 moduleKey + 相同 itemNo）靜默跳過
 *  6. 缺少「項次」欄 → MISSING_REQUIRED_FIELD Error
 *  7. 缺少「模組」欄 → MISSING_REQUIRED_FIELD Error
 *  8. 専案內容 data 名稱優先於主檔名稱（calculateProjectGroups）
 *  9. 専案內容無名稱時 fallback 到主檔名稱（calculateProjectGroups）
 * 10. mapProjectMappingRecords 不呼叫 fetch / XMLHttpRequest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mapProjectMappingRecords } from '@/services/projectMappingMapper'
import { calculateProjectGroups } from '@/services/projectGroupCalculator'
import type { ParsedWorkbookSheet } from '@/types/excel'
import type { NormalizedWorkRecord, ProjectMasterRecord } from '@/types/analysis'
import type { ProjectItem } from '@/types/project'

// ─── 輔助函式 ─────────────────────────────────────────────────────────────────

function makeSheet(headers: string[], rows: unknown[][]): ParsedWorkbookSheet {
  return {
    originalName: '専案對應表',
    normalizedName: '専案對應表',
    headers,
    rowCount: rows.length,
    rows,
  }
}

function makeRecord(projectKey: string, hours: number): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate: '2026-04-01',
    employeeKey: 'EMP001',
    workCategory: 'project',
    projectKey,
    hours,
  }
}

function makeItem(
  normalizedItemNo: string,
  itemType: 'main' | 'child',
  parentItemNo?: string,
  data: Record<string, unknown> = {}
): ProjectItem {
  return {
    rowIndex: 0,
    rawItemNo: normalizedItemNo,
    normalizedItemNo,
    itemType,
    parentItemNo,
    data,
    imageRefs: [],
  }
}

function makeMaster(projectKey: string, projectName: string): ProjectMasterRecord {
  return { projectKey, projectName }
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('mapProjectMappingRecords', () => {
  it('1. 一個項次對應一個模組（基本功能）', () => {
    const sheet = makeSheet(['項次', '模組'], [['1', 'MOD-A']])
    const result = mapProjectMappingRecords(sheet)

    expect(result.hasRequiredColumns).toBe(true)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toEqual({ itemNo: '1', moduleKey: 'MOD-A' })
    expect(result.moduleToItemNo.get('MOD-A')).toBe('1')
    expect(result.issues).toHaveLength(0)
  })

  it('2. 多個模組對應同一項次（一對多）', () => {
    const sheet = makeSheet(
      ['項次', '模組'],
      [
        ['1', 'MOD-A'],
        ['1', 'MOD-B'],
        ['1', 'MOD-C'],
      ]
    )
    const result = mapProjectMappingRecords(sheet)

    expect(result.hasRequiredColumns).toBe(true)
    expect(result.moduleToItemNo.get('MOD-A')).toBe('1')
    expect(result.moduleToItemNo.get('MOD-B')).toBe('1')
    expect(result.moduleToItemNo.get('MOD-C')).toBe('1')
    expect(result.issues).toHaveLength(0)
  })

  it('3. 主項（"1"）與子項（"1-1"）分別對應不同模組', () => {
    const sheet = makeSheet(
      ['項次', '模組'],
      [
        ['1',   'MOD-MAIN'],
        ['1-1', 'MOD-SUB'],
      ]
    )
    const result = mapProjectMappingRecords(sheet)

    expect(result.moduleToItemNo.get('MOD-MAIN')).toBe('1')
    expect(result.moduleToItemNo.get('MOD-SUB')).toBe('1-1')
    expect(result.records).toHaveLength(2)
    expect(result.issues).toHaveLength(0)
  })

  it('4. 同一模組對應到不同項次 → AMBIGUOUS_MODULE_ITEM_MAPPING Error，該模組從映射移除', () => {
    const sheet = makeSheet(
      ['項次', '模組'],
      [
        ['1', 'MOD-SHARED'],
        ['2', 'MOD-SHARED'], // 同一 moduleKey，不同 itemNo
      ]
    )
    const result = mapProjectMappingRecords(sheet)

    // 歧義模組不在 map 中
    expect(result.moduleToItemNo.has('MOD-SHARED')).toBe(false)
    // 只有一個 Error
    const ambiguousIssues = result.issues.filter(
      (i) => i.code === 'AMBIGUOUS_MODULE_ITEM_MAPPING'
    )
    expect(ambiguousIssues).toHaveLength(1)
    expect(ambiguousIssues[0].severity).toBe('error')
  })

  it('5. 重複行（相同 moduleKey + 相同 itemNo）靜默跳過，不報錯', () => {
    const sheet = makeSheet(
      ['項次', '模組'],
      [
        ['1', 'MOD-A'],
        ['1', 'MOD-A'], // 完全重複
        ['1', 'MOD-A'], // 三次
      ]
    )
    const result = mapProjectMappingRecords(sheet)

    // 模組正常對應
    expect(result.moduleToItemNo.get('MOD-A')).toBe('1')
    // 無歧義 error
    expect(result.issues.filter((i) => i.code === 'AMBIGUOUS_MODULE_ITEM_MAPPING')).toHaveLength(0)
  })

  it('6. 缺少「項次」欄 → MISSING_REQUIRED_FIELD Error，hasRequiredColumns = false', () => {
    const sheet = makeSheet(['模組'], [['MOD-A']]) // 無項次欄
    const result = mapProjectMappingRecords(sheet)

    expect(result.hasRequiredColumns).toBe(false)
    expect(result.moduleToItemNo.size).toBe(0)
    expect(result.records).toHaveLength(0)
    const missingIssues = result.issues.filter((i) => i.code === 'MISSING_REQUIRED_FIELD')
    expect(missingIssues).toHaveLength(1)
    expect(missingIssues[0].severity).toBe('error')
  })

  it('7. 缺少「模組」欄 → MISSING_REQUIRED_FIELD Error，hasRequiredColumns = false', () => {
    const sheet = makeSheet(['項次'], [['1']]) // 無模組欄
    const result = mapProjectMappingRecords(sheet)

    expect(result.hasRequiredColumns).toBe(false)
    expect(result.moduleToItemNo.size).toBe(0)
    const missingIssues = result.issues.filter((i) => i.code === 'MISSING_REQUIRED_FIELD')
    expect(missingIssues).toHaveLength(1)
  })
})

// ─── 名稱優先級測試（calculateProjectGroups） ────────────────────────────────

describe('calculateProjectGroups – 専案名稱優先級', () => {
  it('8. 専案內容 data 名稱優先於主檔任務名稱', () => {
    const itemWithName = makeItem('1', 'main', undefined, { 専案名稱: '内容中的名稱' })
    const master = makeMaster('MOD-X', '主檔中的名稱')
    const moduleToItemNo = new Map([['MOD-X', '1']])
    const records = [makeRecord('MOD-X', 100)]

    const groups = calculateProjectGroups(
      records,
      records,
      [master],
      [itemWithName],
      moduleToItemNo
    )

    expect(groups).toHaveLength(1)
    // 専案內容優先
    expect(groups[0].mainProject.projectName).toBe('内容中的名稱')
  })

  it('9. 専案內容無名稱時 fallback 到主檔任務名稱', () => {
    const itemWithoutName = makeItem('1', 'main', undefined, {}) // data 為空
    const master = makeMaster('MOD-X', '主檔中的名稱')
    const moduleToItemNo = new Map([['MOD-X', '1']])
    const records = [makeRecord('MOD-X', 100)]

    const groups = calculateProjectGroups(
      records,
      records,
      [master],
      [itemWithoutName],
      moduleToItemNo
    )

    expect(groups).toHaveLength(1)
    // fallback 到主檔名稱
    expect(groups[0].mainProject.projectName).toBe('主檔中的名稱')
  })
})

// ─── 網路隔離測試 ─────────────────────────────────────────────────────────────

describe('projectMappingMapper – 網路隔離', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let xhrOpenSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockRejectedValue(new Error('fetch not allowed'))
    vi.stubGlobal('fetch', fetchSpy)
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
      throw new Error('XHR not allowed')
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('10. mapProjectMappingRecords 不呼叫 fetch 或 XMLHttpRequest', () => {
    const sheet = makeSheet(['項次', '模組'], [['1', 'MOD-A']])
    mapProjectMappingRecords(sheet)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })
})

// ─── 整合測試：排行與工時正確性 ──────────────────────────────────────────────

describe('mapProjectMappingRecords + calculateProjectGroups 整合', () => {
  it('11. moduleToItemNo 正確對應時排行不再全為 0', () => {
    const sheet = makeSheet(['項次', '模組'], [['1', 'MOD-A'], ['2', 'MOD-B']])
    const { moduleToItemNo } = mapProjectMappingRecords(sheet)

    const items = [makeItem('1', 'main'), makeItem('2', 'main')]
    const masters = [makeMaster('MOD-A', '専案A'), makeMaster('MOD-B', '専案B')]
    const records = [makeRecord('MOD-A', 30), makeRecord('MOD-B', 20)]

    const groups = calculateProjectGroups(records, records, masters, items, moduleToItemNo)

    expect(groups).toHaveLength(2)
    const g1 = groups.find((g) => g.mainItemNo === '1')
    const g2 = groups.find((g) => g.mainItemNo === '2')
    // 工時不全為 0
    expect(g1!.cumulativeHours).toBe(30)
    expect(g2!.cumulativeHours).toBe(20)
  })

  it('12. 専案成果頁工時與人數正確（子項彙整）', () => {
    const sheet = makeSheet(
      ['項次', '模組'],
      [['1', 'MOD-MAIN'], ['1-1', 'MOD-SUB']]
    )
    const { moduleToItemNo } = mapProjectMappingRecords(sheet)

    const items = [makeItem('1', 'main'), makeItem('1-1', 'child', '1')]
    const masters = [makeMaster('MOD-MAIN', '主専案'), makeMaster('MOD-SUB', '子専案')]
    const emp1: NormalizedWorkRecord = { ...makeRecord('MOD-MAIN', 10), employeeKey: 'E1' }
    const emp2: NormalizedWorkRecord = { ...makeRecord('MOD-SUB', 5), employeeKey: 'E2' }

    const groups = calculateProjectGroups([emp1, emp2], [emp1, emp2], masters, items, moduleToItemNo)

    const g = groups.find((g) => g.mainItemNo === '1')!
    // 群組工時 = 主項 + 子項
    expect(g.cumulativeHours).toBe(15)
    // 群組去重人數
    expect(g.cumulativePeopleCount).toBe(2)
    // 子項工時
    expect(g.children[0].cumulativeHours).toBe(5)
  })
})
