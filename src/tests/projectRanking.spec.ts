/**
 * projectRanking.spec.ts
 * 測試專案排行排序。
 */

import { describe, it, expect } from 'vitest'
import { rankByCumulativeHours, rankByQuarterHours } from '@/services/projectRanking'
import type { ProjectGroupAnalysis, ProjectAnalysis } from '@/types/analysis'

function makeGroup(
  mainItemNo: string,
  cumulativeHours: number,
  quarterHours: number
): ProjectGroupAnalysis {
  const mainProject: ProjectAnalysis = {
    itemNo: mainItemNo,
    itemType: 'main',
    cumulativeHours,
    quarterHours,
    cumulativePeopleCount: 0,
    quarterPeopleCount: 0,
    revenue: null,
  }
  return {
    mainItemNo,
    mainProject,
    children: [],
    cumulativeHours,
    quarterHours,
    cumulativePeopleCount: 0,
    quarterPeopleCount: 0,
    revenue: null,
  }
}

const GROUPS = [
  makeGroup('2', 50, 20),
  makeGroup('1', 100, 10),
  makeGroup('3', 75, 30),
  makeGroup('4', 100, 5),  // 與 '1' 同 cumulative hours
]

describe('rankByCumulativeHours', () => {
  it('依累計工時由高到低排序', () => {
    const ranked = rankByCumulativeHours(GROUPS)
    expect(ranked[0].cumulativeHours).toBeGreaterThanOrEqual(ranked[1].cumulativeHours)
    expect(ranked[1].cumulativeHours).toBeGreaterThanOrEqual(ranked[2].cumulativeHours)
  })

  it('第一名工時最高', () => {
    const ranked = rankByCumulativeHours(GROUPS)
    expect(ranked[0].cumulativeHours).toBe(100)
  })

  it('相同工時時以項次字典序為穩定次排序', () => {
    const ranked = rankByCumulativeHours(GROUPS)
    // '1' 和 '4' 都是 100 hours，'1' 字典序排在前
    const tie1 = ranked.findIndex((g) => g.mainItemNo === '1')
    const tie4 = ranked.findIndex((g) => g.mainItemNo === '4')
    expect(tie1).toBeLessThan(tie4)
  })

  it('不修改原始陣列', () => {
    const original = [...GROUPS]
    rankByCumulativeHours(GROUPS)
    expect(GROUPS[0].mainItemNo).toBe('2')  // 原始第一個未改變
    expect(GROUPS).toHaveLength(original.length)
  })

  it('回傳完整列表（不截斷）', () => {
    const ranked = rankByCumulativeHours(GROUPS)
    expect(ranked).toHaveLength(GROUPS.length)
  })

  it('空陣列輸入回傳空陣列', () => {
    expect(rankByCumulativeHours([])).toHaveLength(0)
  })

  it('全部工時為 0 時順序以項次字典序決定', () => {
    const zeroGroups = [makeGroup('3', 0, 0), makeGroup('1', 0, 0), makeGroup('2', 0, 0)]
    const ranked = rankByCumulativeHours(zeroGroups)
    expect(ranked[0].mainItemNo).toBe('1')
    expect(ranked[1].mainItemNo).toBe('2')
    expect(ranked[2].mainItemNo).toBe('3')
  })
})

describe('rankByQuarterHours', () => {
  it('依單季工時由高到低排序', () => {
    const ranked = rankByQuarterHours(GROUPS)
    expect(ranked[0].quarterHours).toBeGreaterThanOrEqual(ranked[1].quarterHours)
  })

  it('第一名為單季工時最高的群組', () => {
    const ranked = rankByQuarterHours(GROUPS)
    expect(ranked[0].mainItemNo).toBe('3')  // quarterHours=30 最高
  })

  it('不修改原始陣列', () => {
    const beforeFirst = GROUPS[0].mainItemNo
    rankByQuarterHours(GROUPS)
    expect(GROUPS[0].mainItemNo).toBe(beforeFirst)
  })
})
