/**
 * presentationTheme.ts
 * Phase 5 統一簡報視覺設定。
 * 所有顏色、字型、尺寸、邊距在此集中定義。
 * 不導入外部字型，不使用 CDN，不呼叫網路。
 */

// ── 字型 ──────────────────────────────────────────────────────────────────

export const PRES_FONT = 'Microsoft JhengHei' as const

// ── 字級 (pt) ─────────────────────────────────────────────────────────────

export const PRES_FONT_SIZE = {
  coverTitle: 32,
  coverSubtitle: 22,
  slideTitle: 22,
  sectionTitle: 18,
  tableHeader: 12,
  tableBody: 11,
  bodyText: 14,
  caption: 11,
  footer: 9,
  /** 最小字級：禁止任何文字小於此值 */
  min: 12,
  /** 標題最小字級 */
  titleMin: 20,
} as const

// ── 色票 (6-char hex, 不含 #) ─────────────────────────────────────────────

export const PRES_COLOR = {
  // 封面
  coverBg: '1E3A5F',
  coverText: 'FFFFFF',
  coverSubtext: 'B0C4DE',
  coverCaption: '708090',
  // 標題
  titleText: '1E3A5F',
  subtitleText: '2C5F8A',
  // 表格
  headerBg: '1E3A5F',
  headerFg: 'FFFFFF',
  rowAlt: 'F4F7FB',
  rowNorm: 'FFFFFF',
  tableBorder: 'CCCCCC',
  // 文字
  bodyText: '333333',
  subtle: '666666',
  footer: '888888',
  // 強調
  accent: 'E8791A',
  warning: 'D97706',
  // 占位圖
  placeholderBg: 'F0F4F8',
  placeholderText: '9AA5B4',
} as const

// ── 版面 (inches, LAYOUT_16x9) ────────────────────────────────────────────

export const PRES_LAYOUT = {
  /** 投影片寬度 */
  slideW: 10,
  /** 投影片高度 */
  slideH: 5.625,
  /** 左右內距 */
  padX: 0.3,
  /** 上方內距 */
  padY: 0.2,
  /** 頁尾 Y 座標 */
  footerY: 5.25,
  /** 頁尾高度 */
  footerH: 0.28,
  /** 標題 Y */
  titleY: 0.12,
  /** 標題高度 */
  titleH: 0.45,
  /** 副標題 Y */
  subtitleY: 0.62,
  /** 副標題高度 */
  subtitleH: 0.28,
  /** 內容起始 Y */
  contentY: 1.0,
  /** 可用內容寬度 */
  contentW: 9.4,
  /** 可用內容高度（不含頁尾） */
  contentH: 4.1,
} as const

// ── 表格外框 ──────────────────────────────────────────────────────────────

export const PRES_TABLE_BORDER = {
  type: 'solid',
  pt: 0.5,
  color: PRES_COLOR.tableBorder,
} as const

// ── 文字版型估算 ──────────────────────────────────────────────────────────

export const PRES_TEXT_LAYOUT = {
  /** 每行約幾個字元（中文估算） */
  charsPerLineZh: 36,
  /** 文字頁最大行數（含換行估算） */
  maxLinesPerTextSlide: 18,
  /** 截斷標記 */
  truncateSuffix: '…（內容節錄）',
} as const

// ── 圖片 ──────────────────────────────────────────────────────────────────

/** 每張圖片投影片最多顯示的圖片數 */
export const PRES_IMAGE_PER_PAGE = 4 as const
