/**
 * pptxBuilder.ts
 * Phase 4 PPT 產生服務。
 *
 * 職責：
 * 1. preparePptSlideData  ─ 從 ReportAnalysisResult 提取並轉換純資料（純函式）。
 * 2. assemblePptBlob      ─ 使用 PptxGenJS 組裝 5 頁 PPT，回傳 Blob。
 *
 * 規則：
 * - 不重新解析 Excel，不重新計算工時/人力/比例/排行。
 * - 不使用 Node.js fs；瀏覽器本機產生 ArrayBuffer → Blob。
 * - 所有數字只取自 ReportAnalysisResult，格式化可在此層處理。
 */

import PptxGenJS from 'pptxgenjs'
import { QUARTER_CONFIG } from '@/config/quarterConfig'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type {
  PptSlideData,
  PptCoverData,
  PptWorkHoursSlideData,
  PptRankingSlideData,
  PptDetailSlideData,
} from '@/types/ppt'

// ── 常數 ─────────────────────────────────────────────────────────────────

export const PPT_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const FONT_FACE = 'Microsoft JhengHei'
const COLOR_HEADER_BG = '1E3A5F'
const COLOR_HEADER_FG = 'FFFFFF'
const COLOR_ROW_ALT = 'F4F7FB'
const COLOR_TITLE = '1E3A5F'
const COLOR_SUBTLE = '666666'

const TABLE_BORDER: PptxGenJS.BorderProps = { type: 'solid', pt: 0.5, color: 'CCCCCC' }

const SLIDE_PADDING = 0.3
const CONTENT_START_Y = 1.0
const STATS_H = 4.0

const MAX_DETAIL_ROWS = 10
const RANKING_TOP_N = 5

// ── 輔助函式 ─────────────────────────────────────────────────────────────

function fmtH(hours: number): string {
  return `${hours.toFixed(1)} H`
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`
}

function fmtDateTime(isoString: string): string {
  const dt = new Date(isoString)
  const y = dt.getFullYear()
  const M = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const h = String(dt.getHours()).padStart(2, '0')
  const m = String(dt.getMinutes()).padStart(2, '0')
  return `${y}-${M}-${d} ${h}:${m}`
}

function headerCell(text: string): PptxGenJS.TableCell {
  return {
    text,
    options: {
      bold: true,
      fill: { color: COLOR_HEADER_BG },
      color: COLOR_HEADER_FG,
      fontSize: 11,
      fontFace: FONT_FACE,
    },
  }
}

function dataCell(
  text: string,
  rowIdx: number,
  extra?: Partial<PptxGenJS.TableCellProps>
): PptxGenJS.TableCell {
  return {
    text,
    options: {
      fill: { color: rowIdx % 2 === 0 ? COLOR_ROW_ALT : COLOR_HEADER_FG },
      fontSize: 11,
      fontFace: FONT_FACE,
      ...extra,
    },
  }
}

// ── preparePptSlideData ───────────────────────────────────────────────────

/**
 * 從 ReportAnalysisResult 提取 5 頁 PPT 所需的純資料。
 * 純函式，不操作 DOM，不使用 PptxGenJS。
 *
 * @param result   Phase 3 分析結果
 * @param cumulativeChartBase64  累計圓餅圖 PNG base64（null = totalHours 為 0）
 * @param quarterChartBase64     單季圓餅圖 PNG base64（null = totalHours 為 0）
 */
export function preparePptSlideData(
  result: ReportAnalysisResult,
  cumulativeChartBase64: string | null,
  quarterChartBase64: string | null
): PptSlideData {
  const qConfig = QUARTER_CONFIG[result.quarter]

  // ── 第 1 頁：封面 ──────────────────────────────────────────────────
  const slide1Cover: PptCoverData = {
    quarterLabel: qConfig.label,
    quarterPeriod: `${result.dateRanges.quarter.start} ～ ${result.dateRanges.quarter.end}`,
    cumulativePeriod: `${result.dateRanges.cumulative.start} ～ ${result.dateRanges.cumulative.end}`,
    calculatedAt: fmtDateTime(result.metadata.calculatedAt),
  }

  // ── 第 2 頁：累計工時摘要 ──────────────────────────────────────────
  const slide2Cumulative: PptWorkHoursSlideData = {
    periodLabel: `累計期間：${result.dateRanges.cumulative.start} ～ ${result.dateRanges.cumulative.end}`,
    totalHours: result.cumulative.workHours.totalHours,
    projectHours: result.cumulative.workHours.projectHours,
    maintenanceHours: result.cumulative.workHours.maintenanceHours,
    otherHours: result.cumulative.workHours.otherHours,
    projectRatio: result.cumulative.workHours.projectRatio,
    maintenanceRatio: result.cumulative.workHours.maintenanceRatio,
    otherRatio: result.cumulative.workHours.otherRatio,
    activePeopleCount: result.cumulative.workforce.activePeopleCount,
    averageHoursPerPerson: result.cumulative.workforce.averageHoursPerPerson,
    chartBase64: cumulativeChartBase64,
  }

  // ── 第 3 頁：單季工時摘要 ──────────────────────────────────────────
  const slide3Quarter: PptWorkHoursSlideData = {
    periodLabel: `單季期間：${result.dateRanges.quarter.start} ～ ${result.dateRanges.quarter.end}`,
    totalHours: result.quarterSummary.workHours.totalHours,
    projectHours: result.quarterSummary.workHours.projectHours,
    maintenanceHours: result.quarterSummary.workHours.maintenanceHours,
    otherHours: result.quarterSummary.workHours.otherHours,
    projectRatio: result.quarterSummary.workHours.projectRatio,
    maintenanceRatio: result.quarterSummary.workHours.maintenanceRatio,
    otherRatio: result.quarterSummary.workHours.otherRatio,
    activePeopleCount: result.quarterSummary.workforce.activePeopleCount,
    averageHoursPerPerson: result.quarterSummary.workforce.averageHoursPerPerson,
    chartBase64: quarterChartBase64,
  }

  // ── 第 4 頁：單季專案工時排行 Top 5 ───────────────────────────────
  const top5 = result.quarterProjectRanking.slice(0, RANKING_TOP_N).map((g, i) => ({
    rank: i + 1,
    mainItemNo: g.mainItemNo,
    projectName: g.mainProject.projectName ?? '（未命名）',
    quarterHours: g.quarterHours,
    cumulativeHours: g.cumulativeHours,
  }))

  const slide4Ranking: PptRankingSlideData = {
    periodLabel: `單季期間：${result.dateRanges.quarter.start} ～ ${result.dateRanges.quarter.end}`,
    top5,
  }

  // ── 第 5 頁：專案群組明細（最多 10 筆，依原始項次順序） ────────────
  const totalGroups = result.projectGroups.length
  const displayGroups = result.projectGroups.slice(0, MAX_DETAIL_ROWS)

  const slide5Detail: PptDetailSlideData = {
    totalGroups,
    displayCount: displayGroups.length,
    groups: displayGroups.map(g => ({
      mainItemNo: g.mainItemNo,
      projectName: g.mainProject.projectName ?? '（未命名）',
      cumulativeHours: g.cumulativeHours,
      quarterHours: g.quarterHours,
      childCount: g.children.length,
      revenue: g.revenue,
    })),
    hasMore: totalGroups > MAX_DETAIL_ROWS,
    remainingCount: Math.max(0, totalGroups - MAX_DETAIL_ROWS),
  }

  return { slide1Cover, slide2Cumulative, slide3Quarter, slide4Ranking, slide5Detail }
}

// ── 投影片組裝輔助 ────────────────────────────────────────────────────────

function buildSlide1Cover(pptx: PptxGenJS, data: PptCoverData): void {
  const slide = pptx.addSlide()
  slide.background = { color: '1E3A5F' }

  slide.addText('2026 年度績效報告', {
    x: 1, y: 1.4, w: 8, h: 0.8,
    align: 'center', fontSize: 32, bold: true, color: 'FFFFFF', fontFace: FONT_FACE,
  })
  slide.addText(data.quarterLabel, {
    x: 1, y: 2.3, w: 8, h: 0.55,
    align: 'center', fontSize: 22, color: 'B0C4DE', fontFace: FONT_FACE,
  })
  slide.addText(`報告期間：${data.quarterPeriod}`, {
    x: 1, y: 3.0, w: 8, h: 0.35,
    align: 'center', fontSize: 13, color: 'B0C4DE', fontFace: FONT_FACE,
  })
  slide.addText(`累計期間：${data.cumulativePeriod}`, {
    x: 1, y: 3.35, w: 8, h: 0.35,
    align: 'center', fontSize: 13, color: 'B0C4DE', fontFace: FONT_FACE,
  })
  slide.addText(`製表時間：${data.calculatedAt}`, {
    x: 1, y: 5.05, w: 8, h: 0.3,
    align: 'center', fontSize: 10, color: '708090', fontFace: FONT_FACE,
  })
}

function buildWorkHoursSlide(pptx: PptxGenJS, title: string, data: PptWorkHoursSlideData): void {
  const slide = pptx.addSlide()
  const hasChart = data.chartBase64 !== null

  // 標題與期間
  slide.addText(title, {
    x: SLIDE_PADDING, y: 0.15, w: 9.4, h: 0.45,
    fontSize: 18, bold: true, color: COLOR_TITLE, fontFace: FONT_FACE,
  })
  slide.addText(data.periodLabel, {
    x: SLIDE_PADDING, y: 0.62, w: 9.4, h: 0.28,
    fontSize: 11, color: COLOR_SUBTLE, fontFace: FONT_FACE,
  })

  // 統計表格
  const statsW = hasChart ? 5.0 : 9.4
  const colW: [number, number] = hasChart ? [2.5, 2.5] : [4.7, 4.7]

  const statRows: PptxGenJS.TableRow[] = [
    [headerCell('項目'), headerCell('數值')],
    [dataCell('總工時', 0), dataCell(fmtH(data.totalHours), 0, { bold: true })],
    [dataCell('專案工時', 1), dataCell(`${fmtH(data.projectHours)}  (${fmtPct(data.projectRatio)})`, 1)],
    [dataCell('維運工時', 0), dataCell(`${fmtH(data.maintenanceHours)}  (${fmtPct(data.maintenanceRatio)})`, 0)],
    [dataCell('其他工時', 1), dataCell(`${fmtH(data.otherHours)}  (${fmtPct(data.otherRatio)})`, 1)],
    [dataCell('出勤人數', 0), dataCell(`${data.activePeopleCount} 人`, 0, { bold: true })],
    [
      dataCell('人均工時', 1),
      dataCell(
        data.averageHoursPerPerson !== null ? `${data.averageHoursPerPerson.toFixed(1)} H/人` : '—',
        1
      ),
    ],
  ]

  slide.addTable(statRows, {
    x: SLIDE_PADDING,
    y: CONTENT_START_Y,
    w: statsW,
    h: STATS_H,
    colW,
    border: TABLE_BORDER,
    fontSize: 11,
    fontFace: FONT_FACE,
  })

  // 圓餅圖（或無資料提示）
  if (hasChart && data.chartBase64) {
    slide.addImage({ data: data.chartBase64, x: 5.5, y: CONTENT_START_Y, w: 4.2, h: STATS_H })
  }
}

function buildSlide4Ranking(pptx: PptxGenJS, data: PptRankingSlideData): void {
  const slide = pptx.addSlide()

  slide.addText('單季專案工時排行（Top 5）', {
    x: SLIDE_PADDING, y: 0.15, w: 9.4, h: 0.45,
    fontSize: 18, bold: true, color: COLOR_TITLE, fontFace: FONT_FACE,
  })
  slide.addText(data.periodLabel, {
    x: SLIDE_PADDING, y: 0.62, w: 9.4, h: 0.28,
    fontSize: 11, color: COLOR_SUBTLE, fontFace: FONT_FACE,
  })

  const headerRow: PptxGenJS.TableRow = [
    headerCell('排名'),
    headerCell('主項次'),
    headerCell('專案名稱'),
    headerCell('單季工時 (H)'),
    headerCell('累計工時 (H)'),
  ]

  const dataRows: PptxGenJS.TableRow[] = data.top5.map((row, i) => [
    dataCell(String(row.rank), i, { align: 'center' }),
    dataCell(row.mainItemNo, i),
    dataCell(row.projectName, i),
    dataCell(row.quarterHours.toFixed(1), i, { align: 'center', bold: true }),
    dataCell(row.cumulativeHours.toFixed(1), i, { align: 'center' }),
  ])

  slide.addTable([headerRow, ...dataRows], {
    x: SLIDE_PADDING,
    y: CONTENT_START_Y,
    w: 9.4,
    h: 3.8,
    colW: [0.6, 1.4, 4.1, 1.65, 1.65],
    border: TABLE_BORDER,
    fontSize: 11,
    fontFace: FONT_FACE,
  })

  slide.addText('排行單位：主專案群組，已包含所屬子項工時。', {
    x: SLIDE_PADDING, y: 5.1, w: 9.4, h: 0.3,
    fontSize: 9, color: '888888', italic: true, fontFace: FONT_FACE,
  })
}

function buildSlide5Detail(pptx: PptxGenJS, data: PptDetailSlideData): void {
  const slide = pptx.addSlide()

  slide.addText('專案群組明細', {
    x: SLIDE_PADDING, y: 0.15, w: 9.4, h: 0.45,
    fontSize: 18, bold: true, color: COLOR_TITLE, fontFace: FONT_FACE,
  })

  const tableH = data.hasMore ? 3.6 : 4.5

  const headerRow: PptxGenJS.TableRow = [
    headerCell('主項次'),
    headerCell('專案名稱'),
    headerCell('累計工時 (H)'),
    headerCell('單季工時 (H)'),
    headerCell('子項數'),
    headerCell('收入'),
  ]

  const dataRows: PptxGenJS.TableRow[] = data.groups.map((g, i) => [
    dataCell(g.mainItemNo, i),
    dataCell(g.projectName, i),
    dataCell(g.cumulativeHours.toFixed(1), i, { align: 'center' }),
    dataCell(g.quarterHours.toFixed(1), i, { align: 'center' }),
    dataCell(String(g.childCount), i, { align: 'center' }),
    dataCell(g.revenue !== null ? g.revenue.toLocaleString() : '—', i, { align: 'center' }),
  ])

  slide.addTable([headerRow, ...dataRows], {
    x: SLIDE_PADDING,
    y: 0.7,
    w: 9.4,
    h: tableH,
    colW: [1.3, 3.5, 1.4, 1.4, 0.8, 1.0],
    border: TABLE_BORDER,
    fontSize: 10,
    fontFace: FONT_FACE,
  })

  if (data.hasMore) {
    slide.addText(
      `共 ${data.totalGroups} 個主專案群組，本測試版顯示前 ${data.displayCount} 個，另有 ${data.remainingCount} 個未列出。`,
      {
        x: SLIDE_PADDING,
        y: 0.7 + tableH + 0.1,
        w: 9.4,
        h: 0.35,
        fontSize: 9,
        color: '888888',
        italic: true,
        fontFace: FONT_FACE,
      }
    )
  }
}

// ── assemblePptBlob ───────────────────────────────────────────────────────

/**
 * 組裝 5 頁 PPT，回傳 Blob。
 * 不重新解析 Excel，不重新計算任何數據。
 * 使用 PptxGenJS write() 輸出 ArrayBuffer，再包裝為 Blob。
 */
export async function assemblePptBlob(data: PptSlideData): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = `${data.slide1Cover.quarterLabel} 績效報告`
  pptx.author = '績效報告產生器'

  buildSlide1Cover(pptx, data.slide1Cover)
  buildWorkHoursSlide(pptx, '累計工時摘要', data.slide2Cumulative)
  buildWorkHoursSlide(pptx, '單季人力與工時占比', data.slide3Quarter)
  buildSlide4Ranking(pptx, data.slide4Ranking)
  buildSlide5Detail(pptx, data.slide5Detail)

  const result = await pptx.write({ outputType: 'arraybuffer' })
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('PPT 產生失敗：write() 未回傳 ArrayBuffer')
  }
  return new Blob([result], { type: PPT_MIME_TYPE })
}
