import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { clearAllData, createEmptyFileState, clearPhase2Data } from '@/services/cleanupService'

describe('cleanupService', () => {
  function createMockFile(name: string, size = 1024): File {
    return new File(['x'.repeat(size)], name, { type: 'application/octet-stream' })
  }

  it('清除後三個檔案狀態皆為 null', () => {
    const workExcel = ref({ file: createMockFile('work.xlsx'), error: '', validated: false })
    const contentExcel = ref({ file: createMockFile('content.xlsx'), error: '', validated: false })
    const imageZip = ref({ file: createMockFile('images.zip'), error: '', validated: false })
    const globalMessage = ref('某些訊息')

    clearAllData({ workExcel, contentExcel, imageZip, globalMessage })

    expect(workExcel.value.file).toBeNull()
    expect(contentExcel.value.file).toBeNull()
    expect(imageZip.value.file).toBeNull()
  })

  it('清除後錯誤訊息為空字串', () => {
    const workExcel = ref({ file: null, error: '工時分析 Excel 必須為 .xlsx。', validated: false })
    const contentExcel = ref({ file: null, error: '專案內容 Excel 必須為 .xlsx。', validated: false })
    const imageZip = ref({ file: null, error: '圖片 ZIP 不得超過 200 MB。', validated: false })
    const globalMessage = ref('有錯誤')

    clearAllData({ workExcel, contentExcel, imageZip, globalMessage })

    expect(workExcel.value.error).toBe('')
    expect(contentExcel.value.error).toBe('')
    expect(imageZip.value.error).toBe('')
    expect(globalMessage.value).toBe('')
  })

  it('清除後 validated 為 false', () => {
    const workExcel = ref({ file: null, error: '', validated: true })
    const contentExcel = ref({ file: null, error: '', validated: true })
    const imageZip = ref({ file: null, error: '', validated: true })
    const globalMessage = ref('')

    clearAllData({ workExcel, contentExcel, imageZip, globalMessage })

    expect(workExcel.value.validated).toBe(false)
    expect(contentExcel.value.validated).toBe(false)
    expect(imageZip.value.validated).toBe(false)
  })

  it('清除後不使用 localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')

    const workExcel = ref(createEmptyFileState())
    const contentExcel = ref(createEmptyFileState())
    const imageZip = ref(createEmptyFileState())
    const globalMessage = ref('')

    clearAllData({ workExcel, contentExcel, imageZip, globalMessage })

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalled()

    setItemSpy.mockRestore()
    getItemSpy.mockRestore()
  })

  it('清除後不使用 sessionStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const workExcel = ref(createEmptyFileState())
    const contentExcel = ref(createEmptyFileState())
    const imageZip = ref(createEmptyFileState())
    const globalMessage = ref('')

    clearAllData({ workExcel, contentExcel, imageZip, globalMessage })

    expect(setItemSpy).not.toHaveBeenCalled()

    setItemSpy.mockRestore()
  })

  it('createEmptyFileState 回傳正確預設值', () => {
    const state = createEmptyFileState()
    expect(state.file).toBeNull()
    expect(state.error).toBe('')
    expect(state.validated).toBe(false)
  })
})

describe('cleanupService — Phase 2 clearPhase2Data', () => {
  it('清除 validationState ref → null', () => {
    const validationState = ref<unknown>({ step: 'complete', errorCount: 0 })
    clearPhase2Data({ validationState })
    expect(validationState.value).toBeNull()
  })

  it('清除 processingStep ref → null', () => {
    const processingStep = ref<unknown>('validating-workbook')
    clearPhase2Data({ processingStep })
    expect(processingStep.value).toBeNull()
  })

  it('釋放所有 Object URL 並清空陣列', () => {
    // jsdom 可能未實作 URL.revokeObjectURL，先確保存在再 spy
    if (typeof URL.revokeObjectURL !== 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })
    }
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const objectUrls = ref<string[]>(['blob:http://localhost/1', 'blob:http://localhost/2'])
    clearPhase2Data({ objectUrls })
    expect(revokeSpy).toHaveBeenCalledTimes(2)
    expect(objectUrls.value).toHaveLength(0)
    revokeSpy.mockRestore()
  })

  it('objectUrls 為空陣列時不拋出例外', () => {
    const objectUrls = ref<string[]>([])
    expect(() => clearPhase2Data({ objectUrls })).not.toThrow()
  })

  it('未提供 validationState 時清除其他欄位不出錯', () => {
    const processingStep = ref<unknown>('complete')
    const objectUrls = ref<string[]>([])
    expect(() => clearPhase2Data({ processingStep, objectUrls })).not.toThrow()
    expect(processingStep.value).toBeNull()
  })
})
