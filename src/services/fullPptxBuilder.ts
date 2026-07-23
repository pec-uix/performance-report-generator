/**
 * fullPptxBuilder.ts
 * Phase 5 完整版 PPT 產生服務。
 *
 * 職責：
 * - buildTestPresentation  : 包裝 Phase 4 的 5 頁測試版（不改動 Phase 4）
 * - buildFullPresentation  : 產生包含所有主專案成果頁的完整簡報
 *
 * 規則：
 * - 不重新解析 Excel 或 ZIP
 * - 不重新計算工時/人力/比例/收入
 * - 數字只取自 ReportAnalysisResult
 * - 不呼叫網路 API，不寫持久化儲存，不寫 console
 * - 單張圖片失敗或專案無內容時產生 Warning 而非阻擋
 */

import PptxGenJS from 'pptxgenjs'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type {
  PresentationInput,
  Phase5Warning,
  Phase5ProgressStep,
  FullPresentationResult,
  ImageRepository,
} from '@/types/ppt'
import {
  PRES_FONT,
  PRES_FONT_SIZE,
  PRES_COLOR,
  PRES_LAYOUT,
  PRES_TABLE_BORDER,
} from '@/config/presentationTheme'
import { PPT_MIME_TYPE, assemblePptBlob, preparePptSlideData } from './pptxBuilder'
import {
  buildProjectSlideContents,
  type ProjectTextSlide,
  type ProjectImageSlide,
} from './slidePaginationService'
import { getImageDataUrl } from './imagePresentationService'
import { truncateTextSafely } from './textPaginationService'
import { QUARTER_CONFIG } from '@/config/quarterConfig'

// ── 常數 ──────────────────────────────────────────────────────────────────

/** 封面前固定頁數（封面本身不算頁碼） */
const FIXED_SLIDES_BEFORE_PROJECTS = 7
/** 結尾固定頁數 */
const FIXED_SLIDES_AFTER_PROJECTS = 1
/** 固定頁總數（封面 + 6 摘要 + 結尾） */
const TOTAL_FIXED_SLIDES = FIXED_SLIDES_BEFORE_PROJECTS + FIXED_SLIDES_AFTER_PROJECTS

/** 最大文字截斷行數（避免溢出） */
const MAX_TEXT_LINES_PER_BLOCK = 8
/** 每行估算字元數 */
const CHARS_PER_LINE = 36

// ── 格式化輔助 ────────────────────────────────────────────────────────────

function fmtH(hours: number): string {
  return `${hours.toFixed(1)} H`
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`
}

function fmtRev(rev: number | null): string {
  if (rev === null) return '—'
  return rev.toLocaleString()
}

// ── 表格儲存格輔助 ────────────────────────────────────────────────────────

function hCell(text: string): PptxGenJS.TableCell {
  return {
    text,
    options: {
      bold: true,
      fill: { color: PRES_COLOR.headerBg },
      color: PRES_COLOR.headerFg,
      fontSize: PRES_FONT_SIZE.tableHeader,
      fontFace: PRES_FONT,
    },
  }
}

function dCell(
  text: string,
  rowIdx: number,
  bold = false,
  align: PptxGenJS.HAlign = 'left'
): PptxGenJS.TableCell {
  return {
    text,
    options: {
      fill: { color: rowIdx % 2 === 0 ? PRES_COLOR.rowAlt : PRES_COLOR.rowNorm },
      fontSize: PRES_FONT_SIZE.tableBody,
      fontFace: PRES_FONT,
      bold,
      align,
    },
  }
}

// ── 頁尾 ──────────────────────────────────────────────────────────────────

/** 加入頁尾（封面以外的每頁）。不包含敏感路徑或個資。 */
function addFooter(
  slide: PptxGenJS.Slide,
  quarterLabel: string,
  period: string,
  pageNum: number,
  totalPages: number
): void {
  const L = PRES_LAYOUT
  slide.addText(
    `${quarterLabel}  |  ${period}  |  第 ${pageNum} / ${totalPages} 頁  |  本文件由系統依上傳資料產生`,
    {
      x: L.padX,
      y: L.footerY,
      w: L.contentW,
      h: L.footerH,
      fontSize: PRES_FONT_SIZE.footer,
      fontFace: PRES_FONT,
      color: PRES_COLOR.footer,
      align: 'center',
    }
  )
}

// ── 圖片位置版型 ──────────────────────────────────────────────────────────

interface ImageSlot {
  x: number
  y: number
  w: number
  h: number
}

/** 依圖片數量回傳各圖片的位置/尺寸（1-4 張） */
function getImageSlots(count: number): ImageSlot[] {
  const L = PRES_LAYOUT
  const left = L.padX
  const top = L.contentY
  const totalW = L.contentW
  const totalH = 4.0
  const gap = 0.1
  const halfW = (totalW - gap) / 2
  const halfH = (totalH - gap) / 2

  if (count === 1) {
    return [{ x: left, y: top, w: totalW, h: totalH }]
  }
  if (count === 2) {
    return [
      { x: left, y: top, w: halfW, h: totalH },
      { x: left + halfW + gap, y: top, w: halfW, h: totalH },
    ]
  }
  if (count === 3) {
    return [
      { x: left, y: top, w: halfW, h: totalH },
      { x: left + halfW + gap, y: top, w: halfW, h: halfH },
      { x: left + halfW + gap, y: top + halfH + gap, w: halfW, h: halfH },
    ]
  }
  // 4 張（預設 2×2）
  return [
    { x: left, y: top, w: halfW, h: halfH },
    { x: left + halfW + gap, y: top, w: halfW, h: halfH },
    { x: left, y: top + halfH + gap, w: halfW, h: halfH },
    { x: left + halfW + gap, y: top + halfH + gap, w: halfW, h: halfH },
  ]
}

// ── 封面 ──────────────────────────────────────────────────────────────────

function addCoverSlide(pptx: PptxGenJS, analysis: ReportAnalysisResult): void {
  const slide = pptx.addSlide()
  slide.background = { color: PRES_COLOR.coverBg }
  const qConfig = QUARTER_CONFIG[analysis.quarter]

  slide.addText('2026 年度績效報告', {
    x: 1, y: 1.3, w: 8, h: 0.8,
    align: 'center', fontSize: PRES_FONT_SIZE.coverTitle,
    bold: true, color: PRES_COLOR.coverText, fontFace: PRES_FONT,
  })
  slide.addText(qConfig.label, {
    x: 1, y: 2.25, w: 8, h: 0.55,
    align: 'center', fontSize: PRES_FONT_SIZE.coverSubtitle,
    color: PRES_COLOR.coverSubtext, fontFace: PRES_FONT,
  })
  slide.addText(`報告期間：${analysis.dateRanges.quarter.start} ～ ${analysis.dateRanges.quarter.end}`, {
    x: 1, y: 2.95, w: 8, h: 0.32,
    align: 'center', fontSize: 13,
    color: PRES_COLOR.coverSubtext, fontFace: PRES_FONT,
  })
  slide.addText(`累計期間：${analysis.dateRanges.cumulative.start} ～ ${analysis.dateRanges.cumulative.end}`, {
    x: 1, y: 3.3, w: 8, h: 0.32,
    align: 'center', fontSize: 13,
    color: PRES_COLOR.coverSubtext, fontFace: PRES_FONT,
  })
  slide.addText(`製表時間：${new Date(analysis.metadata.calculatedAt).toLocaleString('zh-TW')}`, {
    x: 1, y: 5.1, w: 8, h: 0.28,
    align: 'center', fontSize: 10,
    color: PRES_COLOR.coverCaption, fontFace: PRES_FONT,
  })
  // 封面無頁碼、無頁尾
}

// ── 本期摘要 ──────────────────────────────────────────────────────────────

function addExecutiveSummarySlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  slide.addText('本期摘要', {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.slideTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })

  const rows: PptxGenJS.TableRow[] = [
    [hCell('項目'), hCell('累計'), hCell('單季')],
    [
      dCell('總工時 (H)', 0),
      dCell(fmtH(analysis.cumulative.workHours.totalHours), 0, true),
      dCell(fmtH(analysis.quarterSummary.workHours.totalHours), 0, true),
    ],
    [
      dCell('專案工時', 1),
      dCell(`${fmtH(analysis.cumulative.workHours.projectHours)}  (${fmtPct(analysis.cumulative.workHours.projectRatio)})`, 1),
      dCell(`${fmtH(analysis.quarterSummary.workHours.projectHours)}  (${fmtPct(analysis.quarterSummary.workHours.projectRatio)})`, 1),
    ],
    [
      dCell('維運工時', 0),
      dCell(`${fmtH(analysis.cumulative.workHours.maintenanceHours)}  (${fmtPct(analysis.cumulative.workHours.maintenanceRatio)})`, 0),
      dCell(`${fmtH(analysis.quarterSummary.workHours.maintenanceHours)}  (${fmtPct(analysis.quarterSummary.workHours.maintenanceRatio)})`, 0),
    ],
    [
      dCell('出勤人數', 1),
      dCell(`${analysis.cumulative.workforce.activePeopleCount} 人`, 1, true),
      dCell(`${analysis.quarterSummary.workforce.activePeopleCount} 人`, 1, true),
    ],
    [
      dCell('主專案數', 0),
      dCell(String(analysis.projectGroups.length), 0, true, 'center'),
      dCell(String(analysis.projectGroups.length), 0, true, 'center'),
    ],
  ]

  slide.addTable(rows, {
    x: L.padX, y: L.contentY, w: L.contentW, h: 3.8,
    colW: [3.0, 3.2, 3.2],
    border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
    fontSize: PRES_FONT_SIZE.tableBody, fontFace: PRES_FONT,
  })

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 工時摘要 ──────────────────────────────────────────────────────────────

function addWorkHoursSummarySlide(
  pptx: PptxGenJS,
  title: string,
  analysis: ReportAnalysisResult,
  isCumulative: boolean,
  chartBase64: string | null,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT
  const wh = isCumulative ? analysis.cumulative.workHours : analysis.quarterSummary.workHours
  const wf = isCumulative ? analysis.cumulative.workforce : analysis.quarterSummary.workforce
  const periodLabel = isCumulative
    ? `累計期間：${analysis.dateRanges.cumulative.start} ～ ${analysis.dateRanges.cumulative.end}`
    : `單季期間：${analysis.dateRanges.quarter.start} ～ ${analysis.dateRanges.quarter.end}`
  const hasChart = chartBase64 !== null

  slide.addText(title, {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.slideTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })
  slide.addText(periodLabel, {
    x: L.padX, y: L.subtitleY, w: L.contentW, h: L.subtitleH,
    fontSize: PRES_FONT_SIZE.caption, color: PRES_COLOR.subtle, fontFace: PRES_FONT,
  })

  const tableW = hasChart ? 5.0 : L.contentW
  const colW: [number, number] = hasChart ? [2.5, 2.5] : [4.7, 4.7]
  const statRows: PptxGenJS.TableRow[] = [
    [hCell('項目'), hCell('數值')],
    [dCell('總工時', 0), dCell(fmtH(wh.totalHours), 0, true)],
    [dCell('專案工時', 1), dCell(`${fmtH(wh.projectHours)}  (${fmtPct(wh.projectRatio)})`, 1)],
    [dCell('維運工時', 0), dCell(`${fmtH(wh.maintenanceHours)}  (${fmtPct(wh.maintenanceRatio)})`, 0)],
    [dCell('其他工時', 1), dCell(`${fmtH(wh.otherHours)}  (${fmtPct(wh.otherRatio)})`, 1)],
    [dCell('出勤人數', 0), dCell(`${wf.activePeopleCount} 人`, 0, true)],
    [dCell('人均工時', 1), dCell(
      wf.averageHoursPerPerson !== null ? `${wf.averageHoursPerPerson.toFixed(1)} H/人` : '—', 1
    )],
  ]

  slide.addTable(statRows, {
    x: L.padX, y: L.contentY, w: tableW, h: 3.8,
    colW, border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
    fontSize: PRES_FONT_SIZE.tableBody, fontFace: PRES_FONT,
  })

  if (hasChart && chartBase64) {
    slide.addImage({ data: chartBase64, x: 5.5, y: L.contentY, w: 4.2, h: 3.8 })
  }

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 主專案工時排行 ────────────────────────────────────────────────────────

function addRankingSlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  slide.addText('單季主專案工時排行（Top 5）', {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.slideTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })
  slide.addText(`單季期間：${analysis.dateRanges.quarter.start} ～ ${analysis.dateRanges.quarter.end}`, {
    x: L.padX, y: L.subtitleY, w: L.contentW, h: L.subtitleH,
    fontSize: PRES_FONT_SIZE.caption, color: PRES_COLOR.subtle, fontFace: PRES_FONT,
  })

  const top5 = analysis.quarterProjectRanking.slice(0, 5)
  const headerRow: PptxGenJS.TableRow = [
    hCell('排名'), hCell('主項次'), hCell('專案名稱'),
    hCell('單季工時 (H)'), hCell('累計工時 (H)'),
  ]
  const dataRows: PptxGenJS.TableRow[] = top5.map((g, i) => [
    dCell(String(i + 1), i, false, 'center'),
    dCell(g.mainItemNo, i),
    dCell(g.mainProject.projectName ?? '（未命名）', i),
    dCell(g.quarterHours.toFixed(1), i, true, 'center'),
    dCell(g.cumulativeHours.toFixed(1), i, false, 'center'),
  ])

  slide.addTable([headerRow, ...dataRows], {
    x: L.padX, y: L.contentY, w: L.contentW, h: 3.5,
    colW: [0.6, 1.4, 4.1, 1.65, 1.65],
    border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
    fontSize: PRES_FONT_SIZE.tableBody, fontFace: PRES_FONT,
  })

  slide.addText('排行單位：主專案群組，已包含所屬子項工時。', {
    x: L.padX, y: 4.75, w: L.contentW, h: 0.28,
    fontSize: 9, color: PRES_COLOR.footer, italic: true, fontFace: PRES_FONT,
  })

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 收入與績效 ────────────────────────────────────────────────────────────

function addRevenueSlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  slide.addText('收入與績效摘要', {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.slideTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })

  const rev = analysis.revenue
  if (!rev.configured) {
    slide.addText('收入口徑尚未設定，無法顯示收入績效資料。', {
      x: L.padX, y: L.contentY, w: L.contentW, h: 1.0,
      fontSize: PRES_FONT_SIZE.bodyText, color: PRES_COLOR.warning,
      fontFace: PRES_FONT,
    })
  } else {
    const rows: PptxGenJS.TableRow[] = [
      [hCell('項目'), hCell('累計'), hCell('單季')],
      [
        dCell('收入', 0),
        dCell(fmtRev(rev.cumulativeRevenue), 0, true),
        dCell(fmtRev(rev.quarterRevenue), 0, true),
      ],
      [
        dCell('每工時收入', 1),
        dCell(rev.revenuePerHour !== null ? `${rev.revenuePerHour.toFixed(1)}` : '—', 1),
        dCell('—', 1),
      ],
      [
        dCell('投入產出比', 0),
        dCell(rev.inputOutputRatio !== null ? `${rev.inputOutputRatio.toFixed(2)}` : '—', 0),
        dCell('—', 0),
      ],
    ]

    slide.addTable(rows, {
      x: L.padX, y: L.contentY, w: L.contentW, h: 2.5,
      colW: [3.2, 3.1, 3.1],
      border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
      fontSize: PRES_FONT_SIZE.tableBody, fontFace: PRES_FONT,
    })
  }

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 資料品質摘要 ──────────────────────────────────────────────────────────

function addDataQualitySlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  slide.addText('資料品質摘要', {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.slideTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })

  const dq = analysis.dataQuality
  const errorCount = analysis.issues.filter((i) => i.severity === 'error').length
  const warnCount = analysis.issues.filter((i) => i.severity === 'warning').length

  const rows: PptxGenJS.TableRow[] = [
    [hCell('資料品質項目'), hCell('數量')],
    [dCell('無效日期列', 0), dCell(String(dq.invalidDateRows), 0, false, 'center')],
    [dCell('無效工時列', 1), dCell(String(dq.invalidHourRows), 1, false, 'center')],
    [dCell('未比對人員列', 0), dCell(String(dq.unmatchedPeopleRows), 0, false, 'center')],
    [dCell('未比對專案列', 1), dCell(String(dq.unmatchedProjectRows), 1, false, 'center')],
    [dCell('未分類工時列', 0), dCell(String(dq.unclassifiedRows), 0, false, 'center')],
    [dCell('驗證錯誤', 1), dCell(String(errorCount), 1, errorCount > 0, 'center')],
    [dCell('驗證警告', 0), dCell(String(warnCount), 0, false, 'center')],
  ]

  slide.addTable(rows, {
    x: L.padX, y: L.contentY, w: 6.0, h: 3.6,
    colW: [4.5, 1.5],
    border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
    fontSize: PRES_FONT_SIZE.tableBody, fontFace: PRES_FONT,
  })

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 專案文字投影片 ────────────────────────────────────────────────────────

function addProjectTextSlide(
  pptx: PptxGenJS,
  content: ProjectTextSlide,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  const titleLabel =
    content.projectTotalPages > 1
      ? `[${content.mainItemNo}] ${content.projectName}  (${content.projectPageIndex}/${content.projectTotalPages})`
      : `[${content.mainItemNo}] ${content.projectName}`

  slide.addText(titleLabel, {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.sectionTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })

  // 摘要列
  const s = content.summary
  const summaryText = [
    `累計工時：${fmtH(s.cumulativeHours)}`,
    `單季工時：${fmtH(s.quarterHours)}`,
    `投入人數：${s.peopleCumulative} 人`,
    `子項數：${s.childCount}`,
    s.revenue !== null ? `收入：${fmtRev(s.revenue)}` : null,
  ]
    .filter(Boolean)
    .join('    ')

  slide.addText(summaryText, {
    x: L.padX, y: L.subtitleY, w: L.contentW, h: 0.3,
    fontSize: PRES_FONT_SIZE.caption, color: PRES_COLOR.subtle, fontFace: PRES_FONT,
  })

  // 文字區塊
  if (content.isEmpty) {
    slide.addText('本期無可呈現內容', {
      x: L.padX, y: L.contentY, w: L.contentW, h: 0.5,
      fontSize: PRES_FONT_SIZE.bodyText, color: PRES_COLOR.warning,
      fontFace: PRES_FONT, italic: true,
    })
  } else {
    let curY = L.contentY
    for (const block of content.textBlocks) {
      if (curY > 4.8) break
      slide.addText(block.label, {
        x: L.padX, y: curY, w: L.contentW, h: 0.25,
        fontSize: PRES_FONT_SIZE.caption, bold: true,
        color: PRES_COLOR.subtitleText, fontFace: PRES_FONT,
      })
      curY += 0.28
      const safeText = truncateTextSafely(block.text, MAX_TEXT_LINES_PER_BLOCK, CHARS_PER_LINE)
      const textH = Math.min(Math.ceil(safeText.length / CHARS_PER_LINE) * 0.22 + 0.1, 1.6)
      slide.addText(safeText, {
        x: L.padX + 0.1, y: curY, w: L.contentW - 0.1, h: textH,
        fontSize: PRES_FONT_SIZE.tableBody, color: PRES_COLOR.bodyText,
        fontFace: PRES_FONT, wrap: true,
      })
      curY += textH + 0.1
    }
  }

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 專案圖片投影片 ────────────────────────────────────────────────────────

function addProjectImageSlide(
  pptx: PptxGenJS,
  content: ProjectImageSlide,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string,
  imageRepo: ImageRepository
): Phase5Warning[] {
  const slideWarnings: Phase5Warning[] = []
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  const titleLabel = `[${content.mainItemNo}] ${content.projectName} ─ ${content.category}  (${content.projectPageIndex}/${content.projectTotalPages})`

  slide.addText(titleLabel, {
    x: L.padX, y: L.titleY, w: L.contentW, h: L.titleH,
    fontSize: PRES_FONT_SIZE.sectionTitle, bold: true,
    color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })

  const imgCount = content.filenames.length
  const slots = getImageSlots(Math.min(imgCount, 4))

  for (let i = 0; i < Math.min(imgCount, 4); i++) {
    const slot = slots[i]
    const filename = content.filenames[i] ?? ''
    const bKey = content.basenameKeys[i] ?? ''

    const dataUrl = getImageDataUrl(imageRepo, bKey, filename)

    if (dataUrl) {
      slide.addImage({
        data: dataUrl,
        x: slot.x, y: slot.y, w: slot.w, h: slot.h,
        sizing: { type: 'contain', w: slot.w, h: slot.h },
      })
    } else {
      slideWarnings.push({
        code: 'P5_IMAGE_NOT_FOUND',
        message: `圖片 ${bKey || filename} 在資料庫中找不到，使用占位。`,
        itemNo: content.mainItemNo,
        filename: filename || bKey,
      })
      slide.addText(`（圖片未載入：${bKey || filename}）`, {
        x: slot.x, y: slot.y, w: slot.w, h: slot.h,
        fontSize: PRES_FONT_SIZE.caption,
        color: PRES_COLOR.placeholderText,
        fontFace: PRES_FONT,
        fill: { color: PRES_COLOR.placeholderBg },
        align: 'center',
        valign: 'middle',
      })
    }
  }

  addFooter(slide, quarterLabel, period, pn, total)
  return slideWarnings
}

// ── 結尾摘要 ──────────────────────────────────────────────────────────────

function addClosingSlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  projectSlideCount: number,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  slide.addText('簡報結束', {
    x: 1, y: 1.8, w: 8, h: 0.7,
    align: 'center', fontSize: PRES_FONT_SIZE.slideTitle,
    bold: true, color: PRES_COLOR.titleText, fontFace: PRES_FONT,
  })
  slide.addText(
    `本份簡報共 ${total} 頁，涵蓋 ${analysis.projectGroups.length} 個主專案（${projectSlideCount} 頁專案成果）。`,
    {
      x: L.padX, y: 2.7, w: L.contentW, h: 0.4,
      align: 'center', fontSize: PRES_FONT_SIZE.bodyText,
      color: PRES_COLOR.subtle, fontFace: PRES_FONT,
    }
  )

  addFooter(slide, quarterLabel, period, pn, total)
}

// ── 公開 API ──────────────────────────────────────────────────────────────

/**
 * 產生測試版 PPT（5 頁，Phase 4 相容版）。
 * 包裝 Phase 4 的 assemblePptBlob，不修改既有邏輯。
 */
export async function buildTestPresentation(
  result: ReportAnalysisResult,
  cumulativeChartBase64: string | null,
  quarterChartBase64: string | null
): Promise<Blob> {
  const slideData = preparePptSlideData(result, cumulativeChartBase64, quarterChartBase64)
  return assemblePptBlob(slideData)
}

/**
 * 產生完整版 PPT（9 + N 頁）。
 *
 * 頁面架構：
 * 1. 封面（無頁碼/頁尾）
 * 2. 本期摘要
 * 3. 累計工時摘要
 * 4. 單季工時與人力
 * 5. 主專案工時排行
 * 6. 收入與績效
 * 7. 資料品質摘要
 * 8~N+7. 各主專案成果頁
 * N+8. 結尾摘要
 *
 * @param input              PresentationInput（analysis + projectContent + images）
 * @param cumulativeChartBase64  累計圓餅圖 base64（null = 無資料）
 * @param quarterChartBase64     單季圓餅圖 base64
 * @param onProgress         進度回呼
 */
export async function buildFullPresentation(
  input: PresentationInput,
  cumulativeChartBase64: string | null,
  quarterChartBase64: string | null,
  onProgress?: (step: Phase5ProgressStep) => void
): Promise<FullPresentationResult> {
  const warnings: Phase5Warning[] = []

  onProgress?.('preparing-content')
  const pagination = buildProjectSlideContents(input.analysis, input.projectContent)
  warnings.push(...pagination.warnings)

  onProgress?.('processing-images')
  // Images are already in input.images (built before calling this function)

  const totalSlides = TOTAL_FIXED_SLIDES + pagination.totalProjectSlides
  const qConfig = QUARTER_CONFIG[input.analysis.quarter]
  const quarterLabel = qConfig.label
  const period = `${input.analysis.dateRanges.quarter.start} ～ ${input.analysis.dateRanges.quarter.end}`

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = `${quarterLabel} 績效報告`
  pptx.author = '績效報告產生器'

  onProgress?.('building-summary-slides')

  // 1. 封面（無頁碼）
  addCoverSlide(pptx, input.analysis)

  // 2. 本期摘要 → 頁碼 1
  addExecutiveSummarySlide(pptx, input.analysis, 1, totalSlides - 1, quarterLabel, period)

  // 3. 累計工時 → 頁碼 2
  addWorkHoursSummarySlide(
    pptx, '累計工時摘要', input.analysis, true,
    cumulativeChartBase64, 2, totalSlides - 1, quarterLabel, period
  )

  // 4. 單季工時 → 頁碼 3
  addWorkHoursSummarySlide(
    pptx, '單季人力與工時占比', input.analysis, false,
    quarterChartBase64, 3, totalSlides - 1, quarterLabel, period
  )

  // 5. 排行 → 頁碼 4
  addRankingSlide(pptx, input.analysis, 4, totalSlides - 1, quarterLabel, period)

  // 6. 收入 → 頁碼 5
  addRevenueSlide(pptx, input.analysis, 5, totalSlides - 1, quarterLabel, period)

  // 7. 資料品質 → 頁碼 6
  addDataQualitySlide(pptx, input.analysis, 6, totalSlides - 1, quarterLabel, period)

  onProgress?.('building-project-slides')

  // 8~. 各主專案成果頁
  let currentPage = 7
  for (const slideContent of pagination.slides) {
    if (slideContent.type === 'text') {
      addProjectTextSlide(
        pptx, slideContent, currentPage, totalSlides - 1, quarterLabel, period
      )
    } else {
      const imgWarnings = addProjectImageSlide(
        pptx, slideContent, currentPage, totalSlides - 1, quarterLabel, period, input.images
      )
      warnings.push(...imgWarnings)
    }
    currentPage++
  }

  // 結尾 → 最後頁
  addClosingSlide(
    pptx, input.analysis, pagination.totalProjectSlides,
    totalSlides - 1, totalSlides - 1, quarterLabel, period
  )

  onProgress?.('assembling-pptx')

  const result = await pptx.write({ outputType: 'arraybuffer' })
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('完整版 PPT 產生失敗：write() 未回傳 ArrayBuffer')
  }
  const blob = new Blob([result], { type: PPT_MIME_TYPE })

  onProgress?.('preparing-download')

  return {
    blob,
    totalSlides,
    projectGroupCount: pagination.totalProjectGroups,
    imageCount: pagination.totalImagesReferenced,
    warnings,
    generatedAt: new Date().toISOString(),
  }
}
