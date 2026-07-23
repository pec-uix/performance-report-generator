/**
 * phase3NetworkGuard.spec.ts
 * 確保 Phase 3 分析流程不發出任何網路請求。
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { MockInstance } from 'vitest'
import { runAnalysis } from '@/services/reportAnalysisService'
import type { ValidationState } from '@/services/validationService'
import type { WorkbookValidationResult } from '@/types/excel'

function makeMinimalValidationState(): ValidationState {
  const workbookResult: WorkbookValidationResult = {
    valid: true,
    fileType: 'work-hours',
    detectedSheets: ['工時分析(自助)', '專案清單', '維運清單', '人員清單', '收入工時彙總'],
    missingSheets: [],
    parsedSheets: {
      '工時分析(自助)': {
        originalName: '工時分析(自助)',
        normalizedName: '工時分析(自助)',
        headers: ['日期', '員工編號', '工時'],
        rowCount: 1,
        rows: [['2026-04-01', 'EMP001', '8']],
      },
      '專案清單': {
        originalName: '專案清單',
        normalizedName: '專案清單',
        headers: ['項次', '專案代碼'],
        rowCount: 0,
        rows: [],
      },
      '維運清單': {
        originalName: '維運清單',
        normalizedName: '維運清單',
        headers: ['維運代碼'],
        rowCount: 0,
        rows: [],
      },
      '人員清單': {
        originalName: '人員清單',
        normalizedName: '人員清單',
        headers: ['員工編號'],
        rowCount: 0,
        rows: [],
      },
      '收入工時彙總': {
        originalName: '收入工時彙總',
        normalizedName: '收入工時彙總',
        headers: ['收入'],
        rowCount: 0,
        rows: [],
      },
    },
    errors: [],
    warnings: [],
    info: [],
  }

  return {
    step: 'complete',
    workbookResult,
    projectContentResult: null,
    zipResult: null,
    imageMatchResult: null,
    allIssues: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
  }
}

describe('Phase 3 網路隔離', () => {
  let fetchSpy!: MockInstance<typeof fetch>
  let xhrSpy!: MockInstance<typeof XMLHttpRequest.prototype.open>
  let sendBeaconSpy!: MockInstance<typeof navigator.sendBeacon>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    xhrSpy   = vi.spyOn(XMLHttpRequest.prototype, 'open')
    if (typeof navigator.sendBeacon !== 'function') {
      Object.defineProperty(navigator, 'sendBeacon', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })
    }
    sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('不呼叫 fetch', () => {
    runAnalysis(makeMinimalValidationState(), 'S2')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('不呼叫 XMLHttpRequest.open', () => {
    runAnalysis(makeMinimalValidationState(), 'S2')
    expect(xhrSpy).not.toHaveBeenCalled()
  })

  it('不呼叫 navigator.sendBeacon', () => {
    runAnalysis(makeMinimalValidationState(), 'S2')
    expect(sendBeaconSpy).not.toHaveBeenCalled()
  })

  it('完整 Phase 3 流程不接觸網路（整合驗證）', () => {
    const result = runAnalysis(makeMinimalValidationState(), 'S2')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
