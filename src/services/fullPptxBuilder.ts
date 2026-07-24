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
  PresentationChartImage,
} from '@/types/ppt'
import {
  PRES_FONT,
  PRES_FONT_SIZE,
  PRES_COLOR,
  PRES_LAYOUT,
  PRES_TABLE_BORDER,
} from '@/config/presentationTheme'
import { PPT_THEME } from './pptTheme'
import {
  addContentCard,
  addImageFrame,
  addKpiCard,
  addLinkRow,
  addProjectHeader,
  addSlideFooter,
  addSlideHeader,
  addWarningBlock,
} from './pptComponents'
import { PPT_MIME_TYPE, assemblePptBlob, preparePptSlideData } from './pptxBuilder'
import {
  buildExecutiveProjectSlides,
  type ExecutiveImagePlacement,
  type ExecutiveProjectSlide,
} from './executiveProjectPaginationService'
import { getImageDataUrl } from './imagePresentationService'
import { QUARTER_CONFIG } from '@/config/quarterConfig'
import { assertPptText } from './pptTextSafety'

// ── 常數 ──────────────────────────────────────────────────────────────────

const REVENUE_SECTION_TITLE = '專案收入'

// ── 格式化輔助 ────────────────────────────────────────────────────────────

function fmtH(hours: number): string {
  return `${hours.toFixed(1)} H`
}

function fmtPct2(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

function fmtMoney(rev: number | null | undefined): string {
  if (rev === null || rev === undefined) return '—'
  const sign = rev < 0 ? '-' : ''
  return `NT$${sign}${Math.abs(rev).toLocaleString('zh-TW', {
    minimumFractionDigits: Number.isInteger(rev) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtRate(rate: number | undefined): string {
  return rate === undefined ? '—' : `${fmtMoney(rate)} / H`
}

function costStatusCaption(status: string): string {
  if (status === 'calculated') return '年度收入－截至本期累積費用'
  if (status === 'missing-revenue') return '年度收入尚未提供'
  if (status === 'unmatched-work-hours') return '工時未匹配'
  return '尚未設定平均時薪'
}

// PM 顯示：只取第一位（PPT 顯示層，不修改原始資料）
function getPrimaryPmDisplayName(pm: string | undefined): string | undefined {
  if (!pm?.trim()) return undefined
  const first = pm.split(/[/／,，、]/)[0]?.trim()
  return first || undefined
}

function getPresentationProjectCount(analysis: ReportAnalysisResult): number {
  return analysis.presentationScope?.mainItems.length ?? analysis.projectGroups.length
}

function getCoverYear(analysis: ReportAnalysisResult): string {
  const year = analysis.dateRanges.quarter.end.slice(0, 4)
  if (/^\d{4}$/.test(year)) return year
  return QUARTER_CONFIG[analysis.quarter].label.split(' ')[0] ?? ''
}

function getCoverMonth(quarter: ReportAnalysisResult['quarter']): string {
  return { S1: '03', S2: '07', S3: '11' }[quarter]
}

// ── 表格儲存格輔助 ────────────────────────────────────────────────────────

function hCell(text: string): PptxGenJS.TableCell {
  return {
    text: assertPptText(text, 'PPT table header'),
    options: {
      bold: true,
      fill: { color: PPT_THEME.color.navy },
      color: PPT_THEME.color.white,
      fontSize: 9.5,
      fontFace: PPT_THEME.font.family,
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
    text: assertPptText(text, 'PPT table cell'),
    options: {
      fill: { color: rowIdx % 2 === 0 ? PPT_THEME.color.surface2 : PPT_THEME.color.white },
      fontSize: 9.2,
      fontFace: PPT_THEME.font.family,
      bold,
      align,
      color: PPT_THEME.color.text,
    },
  }
}

// 專案名稱欄：較大字體（最低 11pt），table cell 預設允許換行
function nameCell(text: string, rowIdx: number, bold = false): PptxGenJS.TableCell {
  return {
    text: assertPptText(text, 'PPT project name cell'),
    options: {
      fill: { color: rowIdx % 2 === 0 ? PPT_THEME.color.surface2 : PPT_THEME.color.white },
      fontSize: 11,
      fontFace: PPT_THEME.font.family,
      bold,
      align: 'left',
      color: PPT_THEME.color.text,
    },
  }
}

// 從 "CODE(名稱)" 格式提取純展示名稱；不影響內部 itemNo / projectCode
function getDisplayProjectName(rawName: string): string {
  const m = rawName.match(/^\d+\((.+)\)$/)
  return m?.[1] ?? rawName
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
  void quarterLabel
  void period
  addSlideFooter(slide, { pageNum, totalPages })
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

function getInlineImageSlots(count: number): ImageSlot[] {
  const safeCount = Math.min(Math.max(count, 1), 2)
  const imgX = 5.76
  const imgW = 3.88  // 9.64 right margin - imgX
  const imgY = 1.9
  const totalH = 3.0  // up to PROJECT_SAFE_BOTTOM_Y (4.9)
  if (safeCount === 1) return [{ x: imgX, y: imgY, w: imgW, h: totalH }]
  const gap = 0.08
  const halfH = Math.round(((totalH - gap) / 2) * 100) / 100
  return [
    { x: imgX, y: imgY, w: imgW, h: halfH },
    { x: imgX, y: Math.round((imgY + halfH + gap) * 100) / 100, w: imgW, h: halfH },
  ]
}

// ── 封面 ──────────────────────────────────────────────────────────────────

function addCoverSlide(pptx: PptxGenJS, analysis: ReportAnalysisResult): void {
  const slide = pptx.addSlide()
  const T = PPT_THEME
  slide.background = { color: T.color.white }
  const year = getCoverYear(analysis)
  const semester = analysis.quarter
  const month = getCoverMonth(semester)
  const projectCount = getPresentationProjectCount(analysis)
  const badgeText = `PERFORMANCE REPORT ${year}.${month}`

  slide.addText(badgeText, {
    x: 3.35, y: 0.68, w: 3.3, h: 0.34,
    fontFace: T.font.family, fontSize: 8.8,
    bold: true, color: '5F758A',
    align: 'center', valign: 'middle',
    breakLine: false,
    margin: 0.02,
    fill: { color: 'EAF1F7' },
  })
  slide.addText(`${year} ${semester} 專案績效報告`, {
    x: 0.85, y: 1.72, w: 8.3, h: 0.78,
    fontFace: T.font.family, fontSize: 36,
    bold: true, color: T.color.navy,
    align: 'center',
    fit: 'shrink',
  })
  slide.addText('行動前端開發課', {
    x: 3.0, y: 2.68, w: 4.0, h: 0.3,
    fontFace: T.font.family, fontSize: 14,
    color: '6F8295',
    align: 'center',
  })

  slide.addText(String(projectCount), {
    x: 3.0, y: 3.75, w: 1.55, h: 0.48,
    fontFace: T.font.family, fontSize: 28,
    bold: true, color: T.color.navy,
    align: 'center',
  })
  slide.addText('PROJECTS', {
    x: 2.75, y: 4.28, w: 2.05, h: 0.18,
    fontFace: T.font.family, fontSize: 8.5,
    bold: true, color: '8DA0B1',
    align: 'center',
  })

  slide.addText('', {
    x: 4.99, y: 3.74, w: 0.01, h: 0.76,
    margin: 0,
    fill: { color: 'D9E2EA' },
  })

  slide.addText(semester, {
    x: 5.45, y: 3.75, w: 1.55, h: 0.48,
    fontFace: T.font.family, fontSize: 28,
    bold: true, color: T.color.navy,
    align: 'center',
  })
  slide.addText('SEMESTER', {
    x: 5.2, y: 4.28, w: 2.05, h: 0.18,
    fontFace: T.font.family, fontSize: 8.5,
    bold: true, color: '8DA0B1',
    align: 'center',
  })
  // 封面無頁碼、無頁尾
}

// ── 本期摘要 ──────────────────────────────────────────────────────────────

// ── Phase 6A-2 核心分析圖 ────────────────────────────────────────────────

function addModuleWorkHoursChartSlide(
  pptx: PptxGenJS,
  chartImage: PresentationChartImage,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT
  const chart = chartImage.chart
  const title =
    chart.periodType === 'cumulative'
      ? '工作成果說明－工時（累計）'
      : '工作成果說明－工時（當季）'

  addSlideHeader(slide, {
    title,
    subtitle: `前端開發課工時分布；期間：${chart.startDate} ～ ${chart.endDate}；總工時：${fmtH(chart.totalHours)}`,
  })

  if (chartImage.imageBase64) {
    slide.addImage({ data: chartImage.imageBase64, x: L.padX, y: 1.05, w: L.contentW, h: 4.15 })
  } else if (chart.totalHours <= 0 || chart.items.length === 0) {
    addWarningBlock(slide, { x: L.padX, y: L.contentY, w: L.contentW, h: 0.7 }, '此期間無模組工時資料，未建立圖表。')
  } else {
    const rows: PptxGenJS.TableRow[] = [
      [hCell('模組'), hCell('工時'), hCell('占比')],
      ...chart.items.map((item, i) => [
        dCell(item.displayName, i),
        dCell(fmtH(item.hours), i, true, 'center'),
        dCell(fmtPct2(item.ratio), i, false, 'center'),
      ]),
    ]
    slide.addTable(rows, {
      x: L.padX, y: L.contentY, w: L.contentW, h: 3.8,
      colW: [5.2, 2.1, 2.1],
      border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
      fontSize: PRES_FONT_SIZE.tableBody,
      fontFace: PRES_FONT,
    })
  }

  addFooter(slide, quarterLabel, period, pn, total)
}

function addModuleWorkforcePlaceholderSlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  chartBase64: string | null,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  addSlideHeader(slide, {
    title: '工作成果說明－白名單專案人力',
    subtitle: '前端開發課白名單專案人力投入',
  })
  if (chartBase64) {
    slide.addImage({ data: chartBase64, x: L.padX, y: 1.05, w: L.contentW, h: 4.05 })
  } else if (analysis.presentationAnalysis.workforceConfigured) {
    const modules = analysis.presentationAnalysis.presentationScopeAnalysis?.moduleWorkforce ??
      analysis.presentationAnalysis.moduleWorkforce
    const rows: PptxGenJS.TableRow[] = [
      [hCell('模組'), hCell('人力')],
      ...modules.map((item, i) => [
        dCell(item.displayName, i),
        dCell(item.workforce === null ? '—' : item.workforce.toFixed(4), i, true, 'center'),
      ]),
    ]
    slide.addTable(rows, {
      x: L.padX, y: L.contentY, w: L.contentW, h: 4.05,
      colW: [6.6, 2.8],
      border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
      fontSize: 8.3,
      fontFace: PRES_FONT,
    })
  } else {
    addWarningBlock(
      slide,
      { x: L.padX, y: 1.05, w: L.contentW, h: 0.75 },
      '人力公式尚未確認。本階段不使用 activePeopleCount、人均工時或假設人月公式產生數值。',
    )
  }

  addFooter(slide, quarterLabel, period, pn, total)
}

function addMonthlyWorkTypeSlide(
  pptx: PptxGenJS,
  analysis: ReportAnalysisResult,
  chartBase64: string | null,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string
): void {
  const slide = pptx.addSlide()
  const L = PRES_LAYOUT

  addSlideHeader(slide, {
    title: '工作成果說明－專案／維運占比',
    subtitle: analysis.presentationAnalysis.monthlyRatioBasis === 'project-and-maintenance-only'
      ? '前端開發課每月專案／維運占比與人力'
      : '每月 project / maintenance / other 工時；比例口徑待確認',
  })

  if (chartBase64) {
    slide.addImage({ data: chartBase64, x: L.padX, y: 1.02, w: L.contentW, h: 4.02 })
  } else {
    addWarningBlock(slide, { x: L.padX, y: 2.25, w: L.contentW, h: 0.6 }, '此期間無專案／維運占比圖資料。')
  }

  addFooter(slide, quarterLabel, period, pn, total)
}

function addImageToSlot(
  slide: PptxGenJS.Slide,
  image: ExecutiveImagePlacement,
  slot: ImageSlot,
  mainItemNo: string,
  imageRepo: ImageRepository
): Phase5Warning[] {
  const warnings: Phase5Warning[] = []
  const dataUrl = getImageDataUrl(imageRepo, image.basenameKey, image.filename)

  if (dataUrl) {
    try {
      slide.addImage({
        data: dataUrl,
        x: slot.x, y: slot.y, w: slot.w, h: slot.h,
        sizing: { type: 'contain', w: slot.w, h: slot.h },
      })
      return warnings
    } catch {
      warnings.push({
        code: 'PROJECT_IMAGE_RENDER_FAILED',
        message: `圖片未成功載入：${image.filename}`,
        itemNo: mainItemNo,
        mainItemNo,
        sourceItemNo: image.sourceItemNo,
        fieldName: image.fieldName,
        category: image.category,
        filename: image.filename,
        reason: 'pptx addImage failed',
      })
    }
  } else {
    warnings.push({
      code: imageRepo.has(image.basenameKey) ? 'PROJECT_IMAGE_DATA_INVALID' : 'PROJECT_IMAGE_NOT_FOUND',
      message: `圖片未成功載入：${image.filename}`,
      itemNo: mainItemNo,
      mainItemNo,
      sourceItemNo: image.sourceItemNo,
      fieldName: image.fieldName,
      category: image.category,
      filename: image.filename,
      reason: imageRepo.has(image.basenameKey) ? 'data url conversion failed' : 'image bytes not found',
    })
  }

  slide.addText(`圖片未成功載入：${image.filename}`, {
    x: slot.x, y: slot.y, w: slot.w, h: slot.h,
    fontSize: PRES_FONT_SIZE.caption,
    color: PRES_COLOR.placeholderText,
    fontFace: PRES_FONT,
    fill: { color: PRES_COLOR.placeholderBg },
    align: 'center',
    valign: 'middle',
  })
  return warnings
}

const PROJECT_SAFE_BOTTOM_Y = 4.9
const PROJECT_BLOCK_GAP = 0.12
const MIN_INLINE_IMAGE_HEIGHT = 2.6  // minimum available height to render images on same slide
const INLINE_IMAGE_GAP = 0.1        // gap between 2 side-by-side images

function estimateTextHeight(text: string, fontSize: number, boxWidth: number, lineHeight = 1.25): number {
  const safeText = text.trim()
  if (!safeText) return 0.18
  const charsPerLine = Math.max(16, Math.floor((boxWidth * 96) / fontSize))
  const lines = safeText.split(/\r?\n/).reduce((sum, line) => {
    const visualChars = Math.max(line.trim().length, 1)
    return sum + Math.max(1, Math.ceil(visualChars / charsPerLine))
  }, 0)
  return Math.max(0.18, (fontSize / 72) * lineHeight * lines)
}

function estimateContentCardHeight(section: ExecutiveProjectSlide['sections'][number], width: number): number {
  const titleHeight = 0.28
  const titleBodyGap = 0.08
  const verticalPadding = 0.2
  return Math.min(
    2.55,
    Math.max(
      0.68,
      verticalPadding + titleHeight + titleBodyGap +
        estimateTextHeight(section.text, PPT_THEME.font.bodySmall, width - 0.24)
    )
  )
}

function estimateCurYAfterText(content: ExecutiveProjectSlide): number {
  const T = PPT_THEME
  const textW = T.layout.contentW
  // 成員在 KPI 上方（y=0.85）；KPI 在 y=1.05，h=0.9，之後 gap=0.12 → curY=2.07
  let curY = content.overview ? 2.07 : 1.02
  if (content.overview) {
    const costH = 1.56
    if (curY + costH <= PROJECT_SAFE_BOTTOM_Y + 0.01) {
      curY += costH + PROJECT_BLOCK_GAP
    }
  }
  const displaySections = content.sections.filter(
    (s) => s.title !== REVENUE_SECTION_TITLE && s.text.trim() !== ''
  )
  for (const section of displaySections) {
    const estimatedH = estimateContentCardHeight(section, textW)
    const cardH = Math.min(estimatedH, Math.max(0.58, PROJECT_SAFE_BOTTOM_Y - curY))
    if (curY + cardH > PROJECT_SAFE_BOTTOM_Y + 0.01) break
    curY += cardH + PROJECT_BLOCK_GAP
  }
  if (content.links.length > 0) {
    const linkH = Math.min(0.6, Math.max(0.22, content.links.length * 0.16))
    const linkY = Math.min(curY, PROJECT_SAFE_BOTTOM_Y - linkH)
    curY = Math.max(curY, linkY + linkH + PROJECT_BLOCK_GAP)
  }
  return curY
}

function slideNeedsOverflow(content: ExecutiveProjectSlide): boolean {
  if (content.slideType === 'project-gallery') return false
  const displayImages = content.images.filter((img) => img.category !== REVENUE_SECTION_TITLE)
  if (displayImages.length === 0) return false
  return (PROJECT_SAFE_BOTTOM_Y - estimateCurYAfterText(content)) < MIN_INLINE_IMAGE_HEIGHT
}

function addCostTable(
  slide: PptxGenJS.Slide,
  summary: NonNullable<ExecutiveProjectSlide['overview']>['summary'],
  box: { x: number; y: number; w: number; h: number }
): void {
  const T = PPT_THEME
  const cost = summary.costBreakdown
  const detailRows = summary.financialDetails ?? []
  const hasGroupedDetails = detailRows.length > 1
  slide.addText('', {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: T.color.surface },
    line: { color: T.color.border, width: T.layout.lineWidth },
    radius: T.layout.cardRadius,
  } as PptxGenJS.TextPropsOptions)
  slide.addText(assertPptText('成本分析', 'cost section title'), {
    x: box.x + 0.12,
    y: box.y + 0.08,
    w: box.w - 0.24,
    h: 0.18,
    fontFace: T.font.family,
    fontSize: 12.5,
    bold: true,
    color: T.color.navy2,
    fit: 'shrink',
  })
  if (hasGroupedDetails) {
    // 欄位：專案名稱 | 工時 | 年度收入 | 資訊成本 | 前端成本 | 後端成本 | 總費用 | 累積績效
    const tableW = box.w - 0.2
    const nameColW = Math.max(1.0, Math.min(2.0, tableW * 0.22))
    const fixedColsW = 0.65 + 0.9 + 0.78 + 0.78 + 0.78 + 0.78  // 工時+年度收入+3成本+總費用
    const perfColW = Math.max(0.75, tableW - nameColW - fixedColsW)
    const rows: PptxGenJS.TableRow[] = [
      [
        hCell('專案名稱'),
        hCell('工時'),
        hCell('年度收入'),
        hCell('資訊成本'),
        hCell('前端成本'),
        hCell('後端成本'),
        hCell('總費用'),
        hCell('累積績效'),
      ],
      ...detailRows.map((row, idx) => {
        const rowCost = row.costBreakdown
        const cumulativeCost = row.cumulativeCostBreakdown
        const isTotal = row.itemType === 'groupTotal'
        return [
          nameCell(getDisplayProjectName(row.projectName), idx, isTotal),
          dCell(fmtH(
            rowCost.informationServiceHours +
              rowCost.frontendDevelopmentHours +
              rowCost.backendDevelopmentHours
          ), idx, isTotal, 'center'),
          dCell(fmtMoney(row.annualRevenue), idx, isTotal, 'center'),
          dCell(fmtMoney(rowCost.informationServiceCost), idx, isTotal, 'center'),
          dCell(fmtMoney(rowCost.frontendDevelopmentCost), idx, isTotal, 'center'),
          dCell(fmtMoney(rowCost.backendDevelopmentCost), idx, isTotal, 'center'),
          dCell(fmtMoney(rowCost.totalCost), idx, isTotal, 'center'),
          dCell(
            cumulativeCost.calculationStatus === 'calculated' ? fmtMoney(cumulativeCost.performance) : '—',
            idx,
            isTotal,
            'center'
          ),
        ]
      }),
    ]
    const tableH = Math.min(box.h - 0.42, 0.28 + rows.length * 0.22)
    slide.addTable(rows, {
      x: box.x + 0.1,
      y: box.y + 0.34,
      w: tableW,
      h: tableH,
      colW: [nameColW, 0.65, 0.9, 0.78, 0.78, 0.78, 0.78, perfColW],
      border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
      fontSize: 9.2,
      fontFace: PRES_FONT,
    })
    // 若有剩餘空間則顯示公式說明
    const noteY = box.y + 0.34 + tableH + 0.03
    const noteH = 0.13
    if (noteY + noteH <= box.y + box.h - 0.01) {
      slide.addText(
        assertPptText('累積績效 = 年度收入 - 截至本期累積費用', 'cost formula note'),
        {
          x: box.x + 0.12,
          y: noteY,
          w: box.w - 0.24,
          h: noteH,
          fontFace: T.font.family,
          fontSize: 8,
          color: T.color.muted,
          fit: 'shrink',
        }
      )
    }
    return
  }
  if (cost.calculationStatus === 'missing-hourly-rates') {
    slide.addText(assertPptText('成本與績效尚未計算\n原因：平均時薪未完整設定', 'cost missing rate text'), {
      x: box.x + 0.12,
      y: box.y + 0.36,
      w: box.w - 0.24,
      h: 0.42,
      fontFace: T.font.family,
      fontSize: 10,
      color: T.color.muted,
      fit: 'shrink',
    })
    return
  }
  if (cost.calculationStatus === 'unmatched-work-hours') {
    slide.addText(assertPptText('成本與績效尚未計算\n原因：本期工時資料尚未匹配', 'cost unmatched text'), {
      x: box.x + 0.12,
      y: box.y + 0.36,
      w: box.w - 0.24,
      h: 0.42,
      fontFace: T.font.family,
      fontSize: 10,
      color: T.color.muted,
      fit: 'shrink',
    })
    return
  }

  const rows: PptxGenJS.TableRow[] = [
    [hCell('組別'), hCell('本期工時'), hCell('平均時薪'), hCell('本期成本')],
    [
      dCell('資訊服務組', 0),
      dCell(fmtH(cost.informationServiceHours), 0, false, 'center'),
      dCell(fmtRate(cost.informationServiceRate), 0, false, 'center'),
      dCell(fmtMoney(cost.informationServiceCost), 0, false, 'center'),
    ],
    [
      dCell('前端開發課', 1),
      dCell(fmtH(cost.frontendDevelopmentHours), 1, false, 'center'),
      dCell(fmtRate(cost.frontendDevelopmentRate), 1, false, 'center'),
      dCell(fmtMoney(cost.frontendDevelopmentCost), 1, false, 'center'),
    ],
    [
      dCell('後端開發課', 2),
      dCell(fmtH(cost.backendDevelopmentHours), 2, false, 'center'),
      dCell(fmtRate(cost.backendDevelopmentRate), 2, false, 'center'),
      dCell(fmtMoney(cost.backendDevelopmentCost), 2, false, 'center'),
    ],
    [
      dCell('總計', 3, true),
      dCell(fmtH(
        cost.informationServiceHours + cost.frontendDevelopmentHours + cost.backendDevelopmentHours
      ), 3, true, 'center'),
      dCell('—', 3, true, 'center'),
      dCell(fmtMoney(cost.totalCost), 3, true, 'center'),
    ],
  ]
  slide.addTable(rows, {
    x: box.x + 0.12,
    y: box.y + 0.34,
    w: box.w - 0.24,
    h: 0.84,
    colW: [1.4, 1.05, 1.45, Math.max(1.25, box.w - 4.14)],
    border: PRES_TABLE_BORDER as PptxGenJS.BorderProps,
    fontSize: 8.2,
    fontFace: PRES_FONT,
  })
  const cumulativeCost = summary.cumulativeCostBreakdown
  const cumulativePerformance = cumulativeCost.calculationStatus === 'calculated'
    ? (cumulativeCost.performance ?? 0)
    : null
  const summaryLines = [
    `本期費用：${fmtMoney(cost.totalCost)}`,
    `截至本期累積費用：${fmtMoney(cumulativeCost.totalCost)}`,
    `截至本期累積績效：${cumulativeCost.calculationStatus === 'calculated' ? fmtMoney(cumulativeCost.performance) : '—'}`,
  ]
  slide.addText(assertPptText(summaryLines.join('\n'), 'cost cumulative summary text'), {
    x: box.x + 0.12,
    y: box.y + 1.3,
    w: box.w - 0.24,
    h: 0.58,
    fontFace: T.font.family,
    fontSize: 10.2,
    bold: true,
    color: cumulativePerformance === null
      ? T.color.muted
      : cumulativePerformance > 0
        ? T.color.positive
        : cumulativePerformance < 0
          ? T.color.danger
          : T.color.navy,
    fit: 'shrink',
  })
}

function addImageOverflowSlide(
  pptx: PptxGenJS,
  content: ExecutiveProjectSlide,
  images: ExecutiveImagePlacement[],
  pn: number,
  total: number,
  quarterLabel: string,
  period: string,
  imageRepo: ImageRepository
): Phase5Warning[] {
  const warnings: Phase5Warning[] = []
  const slide = pptx.addSlide()
  const T = PPT_THEME
  addProjectHeader(slide, {
    itemNo: content.itemNo,
    projectCode: content.projectCode,
    pm: getPrimaryPmDisplayName(content.pm),
    projectName: content.projectName,
    pageIndex: content.pageIndex,
    pageCount: content.pageCount,
    slideKind: '成果補充',
  })
  const imgY = 1.02
  const imgH = PROJECT_SAFE_BOTTOM_Y - imgY
  const imageW = T.layout.contentW
  const gap = INLINE_IMAGE_GAP
  if (images.length === 1) {
    const slot = { x: T.layout.marginX, y: imgY, w: imageW, h: imgH }
    addImageFrame(slide, { ...slot, title: images[0]!.category })
    warnings.push(...addImageToSlot(
      slide, images[0]!, { x: slot.x + 0.07, y: slot.y + 0.26, w: slot.w - 0.14, h: slot.h - 0.34 },
      content.itemNo, imageRepo
    ))
  } else {
    const eachW = (imageW - gap) / 2
    images.slice(0, 2).forEach((image, idx) => {
      const slot = { x: T.layout.marginX + idx * (eachW + gap), y: imgY, w: eachW, h: imgH }
      addImageFrame(slide, { ...slot, title: image.category })
      warnings.push(...addImageToSlot(
        slide, image, { x: slot.x + 0.07, y: slot.y + 0.26, w: slot.w - 0.14, h: slot.h - 0.34 },
        content.itemNo, imageRepo
      ))
    })
  }
  addFooter(slide, quarterLabel, period, pn, total)
  return warnings
}

function addExecutiveProjectSlide(
  pptx: PptxGenJS,
  content: ExecutiveProjectSlide,
  analysis: ReportAnalysisResult,
  pn: number,
  total: number,
  quarterLabel: string,
  period: string,
  imageRepo: ImageRepository
): { warnings: Phase5Warning[]; overflowImages: ExecutiveImagePlacement[] } {
  const warnings: Phase5Warning[] = []
  const slide = pptx.addSlide()
  const T = PPT_THEME
  const slideKind =
    content.slideType === 'project-overview'
      ? '主管整合摘要'
      : content.slideType === 'project-detail'
        ? '成果補充'
        : '圖片展示'

  addProjectHeader(slide, {
    itemNo: content.itemNo,
    projectCode: content.projectCode,
    pm: getPrimaryPmDisplayName(content.pm),
    projectName: content.projectName,
    pageIndex: content.pageIndex,
    pageCount: content.pageCount,
    slideKind,
  })

  // ── 成員（在 KPI 上方，專案標題之後）────────────────────────────────────
  if (content.overview?.members && content.overview.members.length > 0) {
    slide.addText(`成員：${content.overview.members.join('、')}`, {
      x: T.layout.marginX,
      y: 0.85,
      w: T.layout.contentW,
      h: 0.16,
      fontFace: T.font.family,
      fontSize: 8.5,
      color: T.color.muted,
      fit: 'shrink',
    })
  }

  // ── KPI 區（三張卡，成員之後）────────────────────────────────────────────
  const kpiY = 1.05
  const kpiH = 0.9
  const kpiCardW = 3.0
  const kpiGap = (T.layout.contentW - 3 * kpiCardW) / 2  // = 0.14
  if (content.overview) {
    const s = content.overview.summary
    const hoursUnmatched = s.workHoursStatus === 'unmatched'
    const ratio = s.quarterScopeRatio
    const ratioStr = ratio === null ? '—' : fmtPct2(ratio)
    // 卡 1：工時分析（含人數與占比）
    addKpiCard(slide, {
      x: T.layout.marginX, y: kpiY, w: kpiCardW, h: kpiH,
      label: '工時分析',
      value: hoursUnmatched ? '—' : fmtH(s.quarterHours),
      caption: hoursUnmatched ? '工時資料尚未匹配' : `${s.peopleQuarter} 人｜占比 ${ratioStr}`,
      tone: s.workHoursStatus === 'unmatched' ? 'warning' : 'normal',
    })
    // 卡 2：年度收入
    addKpiCard(slide, {
      x: T.layout.marginX + kpiCardW + kpiGap, y: kpiY, w: kpiCardW, h: kpiH,
      label: '年度收入',
      value: fmtMoney(s.annualRevenue),
      caption: '依專案內容年度收入欄位',
      tone: 'normal',
    })
    // 卡 3：截至本期累積績效
    addKpiCard(slide, {
      x: T.layout.marginX + 2 * (kpiCardW + kpiGap), y: kpiY, w: kpiCardW, h: kpiH,
      label: '截至本期累積績效',
      value: s.cumulativeCostBreakdown.calculationStatus === 'calculated'
        ? fmtMoney(s.cumulativeCostBreakdown.performance)
        : '—',
      caption: costStatusCaption(s.cumulativeCostBreakdown.calculationStatus),
      tone: s.cumulativeCostBreakdown.calculationStatus !== 'calculated'
        ? 'muted'
        : (s.cumulativeCostBreakdown.performance ?? 0) < 0
          ? 'danger'
          : 'positive',
    })
  }

  // ── 內容區（KPI 之後：成本→文字區塊→連結→圖片）────────────────────────
  const textW = T.layout.contentW  // 文字永遠全寬
  // KPI 在 y=1.05，h=0.9，gap=0.12 → curY=2.07
  const contentStartY = content.overview ? 2.07 : 1.02
  let curY = contentStartY

  // 成本分析（在文字區塊之前）
  if (content.overview) {
    const costH = 1.56
    if (curY + costH <= PROJECT_SAFE_BOTTOM_Y + 0.01) {
      addCostTable(slide, content.overview.summary, {
        x: T.layout.marginX,
        y: curY,
        w: textW,
        h: costH,
      })
      curY += costH + PROJECT_BLOCK_GAP
    }
  }

  // 文字區塊（過濾空內容與專案收入）
  const displaySections = content.sections.filter(
    (s) => s.title !== REVENUE_SECTION_TITLE && s.text.trim() !== ''
  )
  for (const section of displaySections) {
    const estimatedH = estimateContentCardHeight(section, textW)
    const cardH = Math.min(estimatedH, Math.max(0.58, PROJECT_SAFE_BOTTOM_Y - curY))
    if (curY + cardH > PROJECT_SAFE_BOTTOM_Y + 0.01) break
    addContentCard(slide, {
      x: T.layout.marginX,
      y: curY,
      w: textW,
      h: cardH,
      title: section.title,
      body: section.text,
      compact: displaySections.length > 4,
    })
    curY += cardH + PROJECT_BLOCK_GAP
  }

  // 連結
  if (content.links.length > 0) {
    const linkH = Math.min(0.6, Math.max(0.22, content.links.length * 0.16))
    const linkY = Math.min(curY, PROJECT_SAFE_BOTTOM_Y - linkH)
    addLinkRow(slide, {
      x: T.layout.marginX,
      y: linkY,
      w: textW,
      h: linkH,
      links: content.links,
    })
    curY = Math.max(curY, linkY + linkH + PROJECT_BLOCK_GAP)
  }

  // 圖片
  const displayImages = content.slideType !== 'project-gallery'
    ? content.images.filter((img) => img.category !== REVENUE_SECTION_TITLE)
    : content.images

  if (content.slideType === 'project-gallery') {
    const slots = getImageSlots(Math.min(displayImages.length, 4))
    displayImages.slice(0, 4).forEach((image, index) => {
      const slot = slots[index]
      if (slot) {
        addImageFrame(slide, { x: slot.x, y: slot.y, w: slot.w, h: slot.h, title: image.category })
        warnings.push(...addImageToSlot(
          slide, image,
          { x: slot.x + 0.07, y: slot.y + 0.26, w: slot.w - 0.14, h: slot.h - 0.34 },
          content.itemNo, imageRepo
        ))
      }
    })
    addFooter(slide, quarterLabel, period, pn, total)
    return { warnings, overflowImages: [] }
  }

  // 非 gallery：圖片放在文字下方，空間不足則回傳 overflow
  const availableH = PROJECT_SAFE_BOTTOM_Y - curY
  if (displayImages.length > 0 && availableH >= MIN_INLINE_IMAGE_HEIGHT) {
    const imgH = availableH
    const imageW = T.layout.contentW
    const gap = INLINE_IMAGE_GAP
    if (displayImages.length === 1) {
      const slot = { x: T.layout.marginX, y: curY, w: imageW, h: imgH }
      addImageFrame(slide, { ...slot, title: displayImages[0]!.category })
      warnings.push(...addImageToSlot(
        slide, displayImages[0]!,
        { x: slot.x + 0.07, y: slot.y + 0.26, w: slot.w - 0.14, h: slot.h - 0.34 },
        content.itemNo, imageRepo
      ))
    } else {
      const eachW = (imageW - gap) / 2
      displayImages.slice(0, 2).forEach((image, idx) => {
        const slot = { x: T.layout.marginX + idx * (eachW + gap), y: curY, w: eachW, h: imgH }
        addImageFrame(slide, { ...slot, title: image.category })
        warnings.push(...addImageToSlot(
          slide, image,
          { x: slot.x + 0.07, y: slot.y + 0.26, w: slot.w - 0.14, h: slot.h - 0.34 },
          content.itemNo, imageRepo
        ))
      })
    }
    addFooter(slide, quarterLabel, period, pn, total)
    return { warnings, overflowImages: [] }
  }

  addFooter(slide, quarterLabel, period, pn, total)
  return { warnings, overflowImages: displayImages.length > 0 ? [...displayImages] : [] }
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
    `本簡報共 ${total + 1} 張投影片，內頁 ${total} 頁；涵蓋 ${getPresentationProjectCount(analysis)} 個主專案（${projectSlideCount} 頁專案成果）。`,
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
 * 產生完整版 PPT（主管版完整輸出）。
 *
 * 頁面架構：
 * 1. 封面（無頁碼/頁尾）
 * 2~. 工作成果說明核心分析頁（模組工時、人力占位、每月工時）
 * 接續：各主專案成果頁、結尾
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
  void cumulativeChartBase64
  void quarterChartBase64

  // 阻擋規則：専案工時有數值但対応表對應後全為 0
  if (input.analysis.dataQuality.projectMappingBlocked) {
    throw new Error(
      '專案工時尚未成功對應至專案內容，請確認專案對應表。無法產生完整版 PPT。'
    )
  }

  const warnings: Phase5Warning[] = []

  onProgress?.('preparing-content')
  const pagination = buildExecutiveProjectSlides(
    input.analysis,
    input.projectContent,
    input.hourlyRateSettings
  )
  warnings.push(...pagination.warnings)
  if (pagination.audit.lostContentCount > 0) {
    throw new Error('Executive pagination 偵測到內容遺失，已停止產生完整版 PPT。')
  }

  onProgress?.('processing-images')
  // Images are already in input.images (built before calling this function)

  const presentationCharts = input.presentationCharts
  const moduleChartImages = presentationCharts?.moduleWorkHours
    ?? (input.analysis.presentationAnalysis.presentationWorkHoursCharts
      ?? input.analysis.presentationAnalysis.moduleWorkHoursCharts).map((chart) => ({
      chart,
      imageBase64: null,
    }))
  const fixedSlideCount = 1 + moduleChartImages.length + 2 + 1
  const overflowSlideCount = pagination.slides.filter(slideNeedsOverflow).length
  const totalSlides = fixedSlideCount + pagination.totalProjectSlides + overflowSlideCount
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

  let pageNum = 1
  for (const chartImage of moduleChartImages) {
    addModuleWorkHoursChartSlide(
      pptx, chartImage, pageNum, totalSlides - 1, quarterLabel, period
    )
    pageNum++
  }

  addModuleWorkforcePlaceholderSlide(
    pptx, input.analysis, presentationCharts?.moduleWorkforce ?? null,
    pageNum, totalSlides - 1, quarterLabel, period
  )
  pageNum++

  addMonthlyWorkTypeSlide(
    pptx, input.analysis, presentationCharts?.monthlyWorkType ?? null,
    pageNum, totalSlides - 1, quarterLabel, period
  )
  pageNum++

  onProgress?.('building-project-slides')

  // 各主專案成果頁
  let currentPage = pageNum
  for (const slideContent of pagination.slides) {
    const { warnings: slideWarnings, overflowImages } = addExecutiveProjectSlide(
      pptx, slideContent, input.analysis, currentPage, totalSlides - 1, quarterLabel, period, input.images
    )
    warnings.push(...slideWarnings)
    currentPage++
    if (overflowImages.length > 0) {
      const overflowWarnings = addImageOverflowSlide(
        pptx, slideContent, overflowImages, currentPage, totalSlides - 1, quarterLabel, period, input.images
      )
      warnings.push(...overflowWarnings)
      currentPage++
    }
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
    paginationAudit: pagination.audit,
    projectPageCounts: pagination.perProjectPageCounts,
    generatedAt: new Date().toISOString(),
  }
}
