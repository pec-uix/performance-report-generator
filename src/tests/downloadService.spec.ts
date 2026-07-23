/**
 * downloadService.spec.ts
 * 下載服務與 Phase 4 cleanup 測試。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// ── jsdom 環境 URL mock ─────────────────────────────────────────────────
// jsdom 不實作 URL.createObjectURL / revokeObjectURL，需先定義再 spy。

function ensureUrlApiExists(): void {
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => '',
    })
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    })
  }
}

beforeEach(() => {
  ensureUrlApiExists()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url-12345')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { /* noop */ })
})

afterEach(() => {
  vi.restoreAllMocks()
})

import { triggerPptDownload, revokeAfterTick } from '@/services/downloadService'
import { clearPhase4Data } from '@/services/cleanupService'

// ── triggerPptDownload 測試 ───────────────────────────────────────────────

describe('triggerPptDownload', () => {
  it('呼叫 URL.createObjectURL(blob)', () => {
    const blob = new Blob(['test'], { type: 'application/octet-stream' })
    triggerPptDownload(blob, 'test.pptx')
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
  })

  it('建立並移除 <a> 元素（觸發後不殘留）', () => {
    const blob = new Blob(['test'])
    const countBefore = document.body.querySelectorAll('a').length
    triggerPptDownload(blob, 'test.pptx')
    const countAfter = document.body.querySelectorAll('a').length
    expect(countAfter).toBe(countBefore)
  })

  it('<a> 的 download 屬性等於傳入的 filename', () => {
    const blob = new Blob(['test'])
    let capturedDownload = ''
    const origAppend = document.body.appendChild.bind(document.body)
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        capturedDownload = node.download
      }
      return origAppend(node)
    })
    triggerPptDownload(blob, '績效報告_S2_測試版.pptx')
    expect(capturedDownload).toBe('績效報告_S2_測試版.pptx')
    appendSpy.mockRestore()
  })

  it('回傳 URL.createObjectURL 產生的字串', () => {
    const blob = new Blob(['test'])
    const result = triggerPptDownload(blob, 'file.pptx')
    expect(result).toBe('blob:test-url-12345')
  })
})

// ── revokeAfterTick 測試 ─────────────────────────────────────────────────

describe('revokeAfterTick', () => {
  it('在 setTimeout 後呼叫 URL.revokeObjectURL', async () => {
    vi.useFakeTimers()
    revokeAfterTick('blob:test-url-abc')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url-abc')
    vi.useRealTimers()
  })
})

// ── clearPhase4Data 測試 ─────────────────────────────────────────────────

describe('clearPhase4Data', () => {
  it('若 pptBlobUrl 有值，呼叫 URL.revokeObjectURL 並設為空字串', () => {
    const pptBlobUrl = ref('blob:test-url-xyz')
    clearPhase4Data({ pptBlobUrl })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url-xyz')
    expect(pptBlobUrl.value).toBe('')
  })

  it('clearPhase4Data 清空 pptBlob、isGenerating、generateError', () => {
    const pptBlobUrl = ref('')
    const pptBlob = ref<Blob | null>(new Blob(['test']))
    const isGenerating = ref(true)
    const generateError = ref('發生錯誤')

    clearPhase4Data({ pptBlobUrl, pptBlob, isGenerating, generateError })

    expect(pptBlob.value).toBeNull()
    expect(isGenerating.value).toBe(false)
    expect(generateError.value).toBe('')
  })
})
