/**
 * cleanupService.ts
 * 負責清除所有使用者上傳的檔案狀態、解析結果與錯誤訊息。
 * 不使用任何持久化儲存。
 */

import type { FileUploadState } from '@/types/report'
import { ref, type Ref } from 'vue'

export interface CleanupTarget {
  workExcel: Ref<FileUploadState>
  contentExcel: Ref<FileUploadState>
  imageZip: Ref<FileUploadState>
  globalMessage: Ref<string>
  workExcelInputEl?: HTMLInputElement | null
  contentExcelInputEl?: HTMLInputElement | null
  imageZipInputEl?: HTMLInputElement | null
}

export function createEmptyFileState(): FileUploadState {
  return {
    file: null,
    error: '',
    validated: false,
  }
}

/**
 * 清除所有使用者檔案狀態。
 * - 不重新整理頁面
 * - 不使用 localStorage/sessionStorage/IndexedDB
 * - 清除 file input 的 value，防止瀏覽器快取
 */
export function clearAllData(target: CleanupTarget): void {
  target.workExcel.value = createEmptyFileState()
  target.contentExcel.value = createEmptyFileState()
  target.imageZip.value = createEmptyFileState()
  target.globalMessage.value = ''

  // 清除 input[type=file] 的 DOM value
  if (target.workExcelInputEl) target.workExcelInputEl.value = ''
  if (target.contentExcelInputEl) target.contentExcelInputEl.value = ''
  if (target.imageZipInputEl) target.imageZipInputEl.value = ''
}

/**
 * 建立可用於外部呼叫的 reactive 狀態組合。
 * 集中管理，供 ReportGeneratorView 使用。
 */
export function useReportState() {
  const workExcel = ref<FileUploadState>(createEmptyFileState())
  const contentExcel = ref<FileUploadState>(createEmptyFileState())
  const imageZip = ref<FileUploadState>(createEmptyFileState())
  const globalMessage = ref<string>('')

  return { workExcel, contentExcel, imageZip, globalMessage }
}

// ── Phase 2 ─────────────────────────────────────────────────────────

/**
 * Phase 2 清除目標。使用 Ref<unknown> 避免與 validationService 產生循環依賴。
 */
export interface Phase2CleanupTarget {
  validationState?: Ref<unknown>
  processingStep?: Ref<unknown>
  objectUrls?: Ref<string[]>
}

/**
 * 清除 Phase 2 解析結果與記憶體參照。
 * - 清除 ValidationState（workbook/project/zip/imageMatch 資料）
 * - 釋放所有 Object URL
 * - 清除進度狀態
 */
export function clearPhase2Data(target: Phase2CleanupTarget): void {
  if (target.validationState !== undefined) {
    target.validationState.value = null
  }
  if (target.processingStep !== undefined) {
    target.processingStep.value = null
  }
  if (target.objectUrls !== undefined) {
    for (const url of target.objectUrls.value) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // 忽略已失效的 URL
      }
    }
    target.objectUrls.value = []
  }
}

// ── Phase 3 ─────────────────────────────────────────────────────────

/**
 * Phase 3 清除目標。
 */
export interface Phase3CleanupTarget {
  analysisResult?: Ref<unknown>
  analysisError?: Ref<string>
}

/**
 * 清除 Phase 3 分析結果。
 */
export function clearPhase3Data(target: Phase3CleanupTarget): void {
  if (target.analysisResult !== undefined) {
    target.analysisResult.value = null
  }
  if (target.analysisError !== undefined) {
    target.analysisError.value = ''
  }
}

// ── Phase 4 ─────────────────────────────────────────────────────────

/**
 * Phase 4 清除目標。
 * - pptBlobUrl：上次下載建立的 Object URL（若尚未撤銷則在此撤銷）
 * - pptBlob：PPT Blob（設為 null 以釋放記憶體）
 * - isGenerating：產生狀態旗標
 * - generateError：錯誤訊息
 */
export interface Phase4CleanupTarget {
  pptBlobUrl?: Ref<string>
  pptBlob?: Ref<Blob | null>
  isGenerating?: Ref<boolean>
  generateError?: Ref<string>
}

/**
 * 清除 Phase 4 產生狀態、Blob 與 Object URL。
 * 若 Object URL 尚未撤銷，在此呼叫 URL.revokeObjectURL。
 */
export function clearPhase4Data(target: Phase4CleanupTarget): void {
  if (target.pptBlobUrl !== undefined && target.pptBlobUrl.value) {
    try {
      URL.revokeObjectURL(target.pptBlobUrl.value)
    } catch {
      // 忽略已失效的 URL
    }
    target.pptBlobUrl.value = ''
  }
  if (target.pptBlob !== undefined) {
    target.pptBlob.value = null
  }
  if (target.isGenerating !== undefined) {
    target.isGenerating.value = false
  }
  if (target.generateError !== undefined) {
    target.generateError.value = ''
  }
}

// ── Phase 5 ─────────────────────────────────────────────────────────

import type { Phase5Warning, Phase5ProgressStep, FullPresentationResult } from '@/types/ppt'

/**
 * Phase 5 清除目標。
 * 包含完整版 PPT Blob、圖片 Data URL、進度狀態、警告等。
 * 不宣稱可強制垃圾回收，只移除參照。
 */
export interface Phase5CleanupTarget {
  /** 完整版 PPT Blob（設為 null 以移除參照） */
  fullPptBlob?: Ref<Blob | null>
  /** 完整版 PPT 下載 Object URL（若尚未撤銷則在此撤銷） */
  fullPptBlobUrl?: Ref<string>
  /** 圖片 Data URL 清單（清除陣列移除參照，data: URL 不需 revoke） */
  imageDataUrls?: Ref<string[]>
  /** 是否正在產生完整版 */
  isGeneratingFull?: Ref<boolean>
  /** 完整版產生錯誤訊息 */
  generateFullError?: Ref<string>
  /** Phase 5 警告清單 */
  phase5Warnings?: Ref<Phase5Warning[]>
  /** 目前進度步驟 */
  currentProgressStep?: Ref<Phase5ProgressStep | null>
  /** 產生完成統計（設為 null 以移除參照） */
  presentationStats?: Ref<FullPresentationResult | null>
}

/**
 * 清除 Phase 5 產生狀態、Blob、Data URL 與 Object URL。
 * - 撤銷 fullPptBlobUrl（Object URL）
 * - 清除 imageDataUrls（data: URL 只需清空陣列）
 * - 移除所有 Blob/Map 參照
 * - 重設進度與錯誤狀態
 * 不宣稱可強制垃圾回收。
 */
export function clearPhase5Data(target: Phase5CleanupTarget): void {
  if (target.fullPptBlobUrl !== undefined && target.fullPptBlobUrl.value) {
    try {
      URL.revokeObjectURL(target.fullPptBlobUrl.value)
    } catch {
      // 忽略已失效的 URL
    }
    target.fullPptBlobUrl.value = ''
  }
  if (target.fullPptBlob !== undefined) {
    target.fullPptBlob.value = null
  }
  if (target.imageDataUrls !== undefined) {
    target.imageDataUrls.value = []
  }
  if (target.isGeneratingFull !== undefined) {
    target.isGeneratingFull.value = false
  }
  if (target.generateFullError !== undefined) {
    target.generateFullError.value = ''
  }
  if (target.phase5Warnings !== undefined) {
    target.phase5Warnings.value = []
  }
  if (target.currentProgressStep !== undefined) {
    target.currentProgressStep.value = null
  }
  if (target.presentationStats !== undefined) {
    target.presentationStats.value = null
  }
}
