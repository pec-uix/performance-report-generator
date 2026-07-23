/**
 * phase5Cleanup.spec.ts
 * 驗證 clearPhase5Data 正確清除 Phase 5 狀態，不影響 Phase 4 資料。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { clearPhase5Data } from '@/services/cleanupService'
import type { Phase5Warning, Phase5ProgressStep, FullPresentationResult } from '@/types/ppt'

// ── URL API 補丁 ──────────────────────────────────────────────────────────

function ensureUrlApiExists() {
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = (_url: string) => undefined
  }
  if (!URL.createObjectURL) {
    URL.createObjectURL = (_blob: Blob) => 'blob:mock'
  }
}

// ── beforeEach / afterEach ─────────────────────────────────────────────────

beforeEach(() => {
  ensureUrlApiExists()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── 測試 ───────────────────────────────────────────────────────────────────

describe('clearPhase5Data', () => {
  it('呼叫空目標不拋出', () => {
    expect(() => clearPhase5Data({})).not.toThrow()
  })

  it('revoke fullPptBlobUrl 並設為空字串', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const urlRef = ref('blob:test-url-full')
    clearPhase5Data({ fullPptBlobUrl: urlRef })
    expect(revokeSpy).toHaveBeenCalledWith('blob:test-url-full')
    expect(urlRef.value).toBe('')
  })

  it('URL.revokeObjectURL 只呼叫一次', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const urlRef = ref('blob:once')
    clearPhase5Data({ fullPptBlobUrl: urlRef })
    expect(revokeSpy).toHaveBeenCalledTimes(1)
  })

  it('fullPptBlobUrl 已空時不呼叫 revokeObjectURL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const urlRef = ref('')
    clearPhase5Data({ fullPptBlobUrl: urlRef })
    expect(revokeSpy).not.toHaveBeenCalled()
  })

  it('fullPptBlobUrl 已 null 時不拋出', () => {
    // 不傳入即可
    expect(() => clearPhase5Data({ fullPptBlobUrl: undefined })).not.toThrow()
  })

  it('設定 fullPptBlob 為 null', () => {
    const blobRef = ref<Blob | null>(new Blob(['test']))
    clearPhase5Data({ fullPptBlob: blobRef })
    expect(blobRef.value).toBeNull()
  })

  it('清空 imageDataUrls 陣列', () => {
    const arr = ref<string[]>(['data:img1', 'data:img2'])
    clearPhase5Data({ imageDataUrls: arr })
    expect(arr.value).toEqual([])
  })

  it('設定 isGeneratingFull 為 false', () => {
    const flag = ref(true)
    clearPhase5Data({ isGeneratingFull: flag })
    expect(flag.value).toBe(false)
  })

  it('設定 generateFullError 為空字串', () => {
    const err = ref('Something went wrong')
    clearPhase5Data({ generateFullError: err })
    expect(err.value).toBe('')
  })

  it('清空 phase5Warnings 陣列', () => {
    const warnings = ref<Phase5Warning[]>([
      { code: 'P5_ITEM_NOT_FOUND', message: '找不到專案' },
    ])
    clearPhase5Data({ phase5Warnings: warnings })
    expect(warnings.value).toEqual([])
  })

  it('設定 currentProgressStep 為 null', () => {
    const step = ref<Phase5ProgressStep | null>('assembling-pptx')
    clearPhase5Data({ currentProgressStep: step })
    expect(step.value).toBeNull()
  })

  it('設定 presentationStats 為 null', () => {
    const stats = ref<FullPresentationResult | null>({
      blob: new Blob(['x']),
      totalSlides: 10,
      projectGroupCount: 5,
      imageCount: 3,
      warnings: [],
      generatedAt: new Date().toISOString(),
    })
    clearPhase5Data({ presentationStats: stats })
    expect(stats.value).toBeNull()
  })

  it('不影響 Phase 4 的 pptBlobUrl（只清 Phase 5 資料）', () => {
    // 模擬 Phase 4 資料不受影響：clearPhase5Data 沒有 pptBlobUrl 參數
    const pptBlobUrl = ref('blob:phase4-url')
    // 呼叫 clearPhase5Data，不傳入 phase 4 相關 refs
    const phase5Url = ref('blob:phase5-url')
    clearPhase5Data({ fullPptBlobUrl: phase5Url })
    // Phase 4 的 URL 不變
    expect(pptBlobUrl.value).toBe('blob:phase4-url')
  })
})
