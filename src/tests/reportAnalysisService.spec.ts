/**
 * reportAnalysisService.spec.ts
 * 端對端測試分析服務完整流程（使用記憶體資料）。
 */

import { describe, it, expect } from 'vitest'
import { runAnalysis } from '@/services/reportAnalysisService'
import type { ValidationState } from '@/services/validationService'
import type { WorkbookValidationResult } from '@/types/excel'
import type { ProjectContentResult } from '@/types/project'

/** 建立最小可用的 ValidationState（Phase 2 通過） */
function makePassedValidationState(overrides?: Partial<ValidationState>): ValidationState {
  const workbookResult: WorkbookValidationResult = {
    valid: true,
    fileType: 'work-hours',
    detectedSheets: ['工時分析(自助)', '專案清單', '維運清單', '人員清單', '收入工時彙總'],
    missingSheets: [],
    parsedSheets: {
      '工時分析(自助)': {
        originalName: '工時分析(自助)',
        normalizedName: '工時分析(自助)',
        headers: ['日期', '員工編號', '員工姓名', '工時', '專案代碼'],
        rowCount: 2,
        rows: [
          ['2026-04-01', 'EMP001', '張三', '8', 'PRJ-001'],
          ['2026-05-01', 'EMP002', '李四', '4', 'PRJ-002'],
        ],
      },
      '專案清單': {
        originalName: '專案清單',
        normalizedName: '專案清單',
        headers: ['項次', '專案代碼', '專案名稱'],
        rowCount: 2,
        rows: [
          ['1', 'PRJ-001', '測試專案一'],
          ['2', 'PRJ-002', '測試專案二'],
        ],
      },
      '維運清單': {
        originalName: '維運清單',
        normalizedName: '維運清單',
        headers: ['維運代碼', '維運名稱'],
        rowCount: 0,
        rows: [],
      },
      '人員清單': {
        originalName: '人員清單',
        normalizedName: '人員清單',
        headers: ['員工編號', '員工姓名'],
        rowCount: 2,
        rows: [
          ['EMP001', '張三'],
          ['EMP002', '李四'],
        ],
      },
      '收入工時彙總': {
        originalName: '收入工時彙總',
        normalizedName: '收入工時彙總',
        headers: ['項次', '收入'],
        rowCount: 0,
        rows: [],
      },
    },
    errors: [],
    warnings: [],
    info: [],
  }

  const projectContentResult: ProjectContentResult = {
    sheetFound: true,
    alternativeSheetFound: false,
    totalRows: 2,
    mainCount: 2,
    childCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    orphanChildCount: 0,
    items: [
      {
        rowIndex: 0,
        rawItemNo: '1',
        normalizedItemNo: '1',
        itemType: 'main',
        data: {},
        imageRefs: [],
      },
      {
        rowIndex: 1,
        rawItemNo: '2',
        normalizedItemNo: '2',
        itemType: 'main',
        data: {},
        imageRefs: [],
      },
    ],
    detectedHeaders: [],
    issues: [],
  }

  return {
    step: 'complete',
    workbookResult,
    projectContentResult,
    zipResult: null,
    imageMatchResult: null,
    allIssues: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    ...overrides,
  }
}

describe('runAnalysis', () => {
  it('Phase 2 有錯誤時拋出 Error', () => {
    const state = makePassedValidationState({ errorCount: 1 })
    expect(() => runAnalysis(state, 'S2')).toThrow()
  })

  it('workbookResult 為 null 時拋出 Error', () => {
    const state = makePassedValidationState({ workbookResult: null })
    expect(() => runAnalysis(state, 'S2')).toThrow()
  })

  it('成功回傳 ReportAnalysisResult', () => {
    const state = makePassedValidationState()
    const result = runAnalysis(state, 'S2')
    expect(result).toBeDefined()
    expect(result.quarter).toBe('S2')
  })

  it('dateRanges 對應 S2 設定', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    expect(result.dateRanges.cumulative.start).toBe('2025-12-01')
    expect(result.dateRanges.cumulative.end).toBe('2026-07-31')
    expect(result.dateRanges.quarter.start).toBe('2026-04-01')
    expect(result.dateRanges.quarter.end).toBe('2026-07-31')
  })

  it('累計工時包含 2026-04-01 和 2026-05-01 的記錄（S2 累計）', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    // 兩筆記錄都在 S2 累計範圍內
    expect(result.cumulative.workHours.totalHours).toBe(12)
    expect(result.cumulative.workHours.recordCount).toBe(2)
  })

  it('單季工時只包含 2026-04-01 的記錄（S2 單季 2026-04-01 ～ 2026-07-31）', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    // 2026-04-01 在 S2 單季範圍，2026-05-01 也在範圍內
    // 兩筆都在 S2 單季內
    expect(result.quarterSummary.workHours.recordCount).toBe(2)
  })

  it('S1 單季只計算到 2026-03-31', () => {
    const result = runAnalysis(makePassedValidationState(), 'S1')
    // 2026-04-01 超出 S1 單季（2025-12-01 ～ 2026-03-31）
    // 2026-05-01 也超出
    expect(result.quarterSummary.workHours.recordCount).toBe(0)
    expect(result.quarterSummary.workHours.totalHours).toBe(0)
  })

  it('revenue.configured=false（收入欄位找不到）', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    expect(result.revenue.configured).toBe(false)
  })

  it('收入工時彙總存在時，整體收入摘要維持使用收入工時彙總來源', () => {
    const state = makePassedValidationState()
    const workbookResult = state.workbookResult
    if (!workbookResult) throw new Error('missing workbook')
    workbookResult.parsedSheets['收入工時彙總'] = {
      originalName: '收入工時彙總',
      normalizedName: '收入工時彙總',
      headers: ['模組', '收入'],
      rowCount: 2,
      rows: [
        ['A', 1044000],
        ['B', 21452000],
      ],
    }
    workbookResult.parsedSheets['專案清單'] = {
      originalName: '專案清單',
      normalizedName: '專案清單',
      headers: ['項次', '專案代碼', '專案名稱', '收入'],
      rowCount: 1,
      rows: [['1', 'PRJ-001', '測試專案一', 999]],
    }

    const result = runAnalysis(state, 'S2')
    expect(result.revenue.configured).toBe(true)
    expect(result.revenue.cumulativeRevenue).toBe(22496000)
    expect(result.revenue.sourceLabel).toBe('收入工時彙總')
  })

  it('缺少收入工時彙總時，有年度收入欄才 configured=true', () => {
    const state = makePassedValidationState()
    const workbookResult = state.workbookResult
    if (!workbookResult) throw new Error('missing workbook')
    delete workbookResult.parsedSheets['收入工時彙總']
    workbookResult.detectedSheets = workbookResult.detectedSheets.filter(
      (sheet) => sheet !== '收入工時彙總'
    )
    workbookResult.parsedSheets['專案清單'] = {
      originalName: '專案清單',
      normalizedName: '專案清單',
      headers: ['項次', '專案代碼', '專案名稱', '收入', '年度收入'],
      rowCount: 2,
      rows: [
        ['1', 'PRJ-001', '測試專案一', 5000, 1000],
        ['2', 'PRJ-002', '測試專案二', 2000, 0],
      ],
    }

    const result = runAnalysis(state, 'S2')
    expect(result.revenue.configured).toBe(true)
    expect(result.revenue.cumulativeRevenue).toBe(1000)
    expect(result.issues.some((issue) => issue.code === 'REVENUE_PROJECT_MASTER_FALLBACK')).toBe(true)
  })

  it('缺少收入工時彙總且無年度收入欄時 configured=false', () => {
    const state = makePassedValidationState()
    const workbookResult = state.workbookResult
    if (!workbookResult) throw new Error('missing workbook')
    delete workbookResult.parsedSheets['收入工時彙總']
    workbookResult.detectedSheets = workbookResult.detectedSheets.filter(
      (sheet) => sheet !== '收入工時彙總'
    )
    workbookResult.parsedSheets['專案清單'] = {
      originalName: '專案清單',
      normalizedName: '專案清單',
      headers: ['項次', '專案代碼', '專案名稱', '收入'],
      rowCount: 2,
      rows: [
        ['1', 'PRJ-001', '測試專案一', 1000],
        ['2', 'PRJ-002', '測試專案二', 0],
      ],
    }

    const result = runAnalysis(state, 'S2')
    expect(result.revenue.configured).toBe(false)
  })

  it('dataQuality 包含 invalidDateRows 等欄位', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    const dq = result.dataQuality
    expect(typeof dq.invalidDateRows).toBe('number')
    expect(typeof dq.unclassifiedRows).toBe('number')
  })

  it('metadata 包含 calculatedAt 和 sourceRowCounts', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    expect(result.metadata.calculatedAt).toBeTruthy()
    expect(typeof result.metadata.sourceRowCounts).toBe('object')
  })

  it('projectGroups 對應 Phase 2 項目結構', () => {
    const result = runAnalysis(makePassedValidationState(), 'S2')
    // Phase 2 有兩個主項
    expect(result.projectGroups).toHaveLength(2)
  })
})
