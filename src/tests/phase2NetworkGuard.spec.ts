import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { runValidation } from '@/services/validationService'
import { parseWorkbookFromBuffer, getSheetNames } from '@/services/excelReader'
import { validateWorkHoursWorkbook } from '@/services/workbookValidator'
import { readProjectContent } from '@/services/projectContentReader'
import { parseZipBuffer } from '@/services/zipReader'
import { matchImages } from '@/services/imageMatcher'
import { clearPhase2Data } from '@/services/cleanupService'
import { REQUIRED_WORK_SHEETS, PROJECT_CONTENT_SHEET } from '@/config/requiredSheets'
import { ref } from 'vue'

// ── 測試輔助 ──────────────────────────────────────────────────────
const FAKE_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])

function makeExcelFile(sheets: string[], filename: string): File {
  const wb = XLSX.utils.book_new()
  for (const name of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['欄位']]), name)
  }
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  return new File([arr], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

async function makeZipFile(files: { name: string; content: Uint8Array }[]): Promise<File> {
  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.name, f.content)
  }
  const buf = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([buf], 'images.zip', { type: 'application/zip' })
}

describe('phase2NetworkGuard — Phase 2 解析流程不觸發任何網路請求', () => {
  let fetchSpy!: MockInstance<typeof fetch>
  let xhrOpenSpy!: MockInstance<typeof XMLHttpRequest.prototype.open>
  let sendBeaconSpy!: MockInstance<typeof navigator.sendBeacon>
  let webSocketSpy: ReturnType<typeof vi.fn>
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('[Phase2NetworkGuard] fetch 不應被呼叫')
    )
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
      throw new Error('[Phase2NetworkGuard] XHR.open 不應被呼叫')
    })
    if (typeof navigator.sendBeacon !== 'function') {
      Object.defineProperty(navigator, 'sendBeacon', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })
    }
    sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockImplementation(() => {
      throw new Error('[Phase2NetworkGuard] sendBeacon 不應被呼叫')
    })
    originalWebSocket = globalThis.WebSocket
    webSocketSpy = vi.fn().mockImplementation(() => {
      throw new Error('[Phase2NetworkGuard] WebSocket 不應被呼叫')
    })
    globalThis.WebSocket = webSocketSpy as unknown as typeof WebSocket
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    xhrOpenSpy.mockRestore()
    sendBeaconSpy.mockRestore()
    globalThis.WebSocket = originalWebSocket
    vi.clearAllMocks()
  })

  it('runValidation 完整流程不觸發網路請求', async () => {
    const workFile = makeExcelFile([...REQUIRED_WORK_SHEETS], 'work.xlsx')
    const contentFile = makeExcelFile([PROJECT_CONTENT_SHEET], 'content.xlsx')
    const zipFile = await makeZipFile([{ name: 'photo.png', content: FAKE_PNG }])

    await runValidation(workFile, contentFile, zipFile, () => {})

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('各 Phase 2 服務單獨呼叫不觸發網路請求', async () => {
    // Excel 解析
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), '工時分析(自助)')
    const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
    const workbook = parseWorkbookFromBuffer(arr.buffer)

    getSheetNames(workbook)
    validateWorkHoursWorkbook(workbook)
    readProjectContent(workbook)

    // ZIP 解析
    const zip = new JSZip()
    zip.file('test.png', FAKE_PNG)
    const zipBuf = await zip.generateAsync({ type: 'arraybuffer' })
    const zipResult = await parseZipBuffer(zipBuf)

    // 圖片比對
    matchImages(
      {
        sheetFound: false,
        alternativeSheetFound: false,
        totalRows: 0,
        mainCount: 0,
        childCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        orphanChildCount: 0,
        items: [],
        detectedHeaders: [],
        issues: [],
      },
      zipResult
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('clearPhase2Data 不觸發網路請求', () => {
    const validationState = ref(null)
    const processingStep = ref<string | null>('idle')
    const objectUrls = ref<string[]>([])

    clearPhase2Data({ validationState, processingStep, objectUrls })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('parseZipBuffer 解析無效 ZIP 不觸發網路請求', async () => {
    const badBuf = new Uint8Array([0, 1, 2, 3]).buffer
    await parseZipBuffer(badBuf)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })
})
