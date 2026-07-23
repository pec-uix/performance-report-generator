import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { ref } from 'vue'
import { QUARTER_CONFIG, QUARTER_KEYS } from '@/config/quarterConfig'
import { clearAllData, createEmptyFileState } from '@/services/cleanupService'
import { assertAllowedFileExtension, assertFileSize } from '@/services/securityService'

describe('networkGuard — 應用程式邏輯不觸發任何網路請求', () => {
  // Spy 變數（使用明確型別避免 TypeScript 型別推斷問題）
  let fetchSpy!: MockInstance<typeof fetch>
  let xhrOpenSpy!: MockInstance<typeof XMLHttpRequest.prototype.open>
  let sendBeaconSpy!: MockInstance<typeof navigator.sendBeacon>
  let webSocketSpy: ReturnType<typeof vi.fn>
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    // Mock fetch
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('[NetworkGuard] fetch 不應被呼叫')
    )

    // Mock XMLHttpRequest.open
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
      throw new Error('[NetworkGuard] XHR.open 不應被呼叫')
    })

    // jsdom 不一定實作 navigator.sendBeacon；先確保它存在再 spy
    if (typeof navigator.sendBeacon !== 'function') {
      Object.defineProperty(navigator, 'sendBeacon', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })
    }
    sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon').mockImplementation(() => {
      throw new Error('[NetworkGuard] sendBeacon 不應被呼叫')
    })

    // Mock WebSocket
    originalWebSocket = globalThis.WebSocket
    webSocketSpy = vi.fn().mockImplementation(() => {
      throw new Error('[NetworkGuard] WebSocket 不應被呼叫')
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

  it('讀取所有季度設定不觸發網路請求', () => {
    const keys = QUARTER_KEYS
    keys.forEach((key) => {
      const config = QUARTER_CONFIG[key]
      expect(config.label).toBeTruthy()
      expect(config.cumulativeStart).toBeTruthy()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('切換季度 (S1→S2→S3) 不觸發網路請求', () => {
    const selectedQuarter = ref<'S1' | 'S2' | 'S3'>('S1')

    selectedQuarter.value = 'S2'
    selectedQuarter.value = 'S3'
    selectedQuarter.value = 'S1'

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('建立 File 物件並設定檔案狀態不觸發網路請求', () => {
    const mockFile = new File(['fake content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const workExcel = ref(createEmptyFileState())
    workExcel.value.file = mockFile

    // 僅驗證副檔名與大小，不讀取內容
    const extValid = assertAllowedFileExtension(mockFile, ['.xlsx'])
    const sizeValid = assertFileSize(mockFile, 30 * 1024 * 1024)

    expect(extValid).toBe(true)
    expect(sizeValid).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('清除所有資料不觸發網路請求', () => {
    const mockFile = new File(['x'], 'img.zip', { type: 'application/zip' })
    const workExcel = ref({ file: mockFile, error: '', validated: false })
    const contentExcel = ref({ file: mockFile, error: '', validated: false })
    const imageZip = ref({ file: mockFile, error: '', validated: false })
    const globalMessage = ref('test message')

    clearAllData({ workExcel, contentExcel, imageZip, globalMessage })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('assertAllowedFileExtension 不觸發網路請求', () => {
    const file = new File(['data'], 'report.xlsx', { type: 'application/octet-stream' })

    expect(assertAllowedFileExtension(file, ['.xlsx'])).toBe(true)
    expect(assertAllowedFileExtension(file, ['.zip'])).toBe(false)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('assertFileSize 不觸發網路請求', { timeout: 15000 }, () => {
    const smallFile = new File(['x'.repeat(100)], 'small.xlsx')
    const bigContent = 'x'.repeat(31 * 1024 * 1024)
    const bigFile = new File([bigContent], 'big.xlsx')

    expect(assertFileSize(smallFile, 30 * 1024 * 1024)).toBe(true)
    expect(assertFileSize(bigFile, 30 * 1024 * 1024)).toBe(false)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })
})
