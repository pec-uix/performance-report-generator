/**
 * chartRenderer.ts
 * 使用 ECharts 在瀏覽器本機將工時分類資料渲染為 PNG base64 圖片。
 *
 * 安全原則：
 * 1. 離屏容器設定固定寬高後才掛入 DOM，掛入後才 echarts.init。
 * 2. 使用 try/finally 確保無論成功或失敗都 dispose 並移除 DOM。
 * 3. 不輸出圖表資料或 base64 至 console。
 * 4. totalHours === 0 時不建立圓餅圖，直接回傳 null。
 */

import * as echarts from 'echarts'
import type { WorkHoursSummary } from '@/types/analysis'
import type {
  ModuleWorkforceResult,
  ModuleWorkHoursChartResult,
  MonthlyWorkTypeResult,
} from '@/types/presentationAnalysis'

const CHART_W = 600
const CHART_H = 400
const MODULE_CHART_W = 760
const MODULE_CHART_H = 460
const MODULE_WORK_HOURS_CHART_W = 1000
const MODULE_WORK_HOURS_CHART_H = 448
const MODULE_COLORS = [
  '#5470C6',
  '#91CC75',
  '#FAC858',
  '#EE6666',
  '#73C0DE',
  '#3BA272',
  '#FC8452',
  '#9A60B4',
  '#EA7CCC',
  '#6E9FCE',
  '#B6A2DE',
  '#D48265',
]

export interface ChartBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface ModuleWorkHoursListRow {
  color: string
  name: string
  hours: number
  ratio: number
  text: string
  bounds: ChartBounds
}

export interface ModuleWorkHoursLabelGraphic {
  color: string
  name: string
  text: string
  side: 'left' | 'right'
  bounds: ChartBounds
  points: number[][]
}

export interface ModuleWorkHoursLayout {
  chartWidth: number
  chartHeight: number
  pieBounds: ChartBounds
  pieLabelBounds: ChartBounds
  labelLineBounds: ChartBounds
  listBounds: ChartBounds
  safeGap: number
  listMode: 'single-column' | 'two-column'
  listFontSize: number
  rows: ModuleWorkHoursListRow[]
  totalListHours: number
  totalListRatio: number
  visiblePieLabelCount: number
  labelPlacements: Map<string, { x: number; y: number; side: 'left' | 'right' }>
  labelGraphics: ModuleWorkHoursLabelGraphic[]
}

function formatCompactNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)
}

function truncateChartLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label
  return `${label.slice(0, Math.max(0, maxLength - 1))}…`
}

export function getChartDisplayName(rawLabel: string): string {
  const normalized = rawLabel
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wrappedCode = normalized.match(/^\d+\((.*)\)$/)
  if (wrappedCode) return wrappedCode[1].trim()

  const prefixedName = normalized.match(/^\d+[-_./\s]+(.+)$/)
  if (prefixedName) return prefixedName[1].trim()

  return normalized
}

function getShortChartDisplayName(rawLabel: string, maxLength: number): string {
  return truncateChartLabel(getChartDisplayName(rawLabel), maxLength)
}

/** 工時分類圓餅圖的 ECharts option（純函式，不操作 DOM） */
export function buildWorkTypePieOption(summary: WorkHoursSummary): Record<string, unknown> {
  return {
    animation: false,
    color: ['#1976D2', '#43A047', '#FB8C00'],
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { fontSize: 14 },
    },
    series: [
      {
        type: 'pie',
        radius: ['0%', '65%'],
        center: ['42%', '50%'],
        data: [
          { value: summary.projectHours, name: '專案' },
          { value: summary.maintenanceHours, name: '維運' },
          { value: summary.otherHours, name: '其他' },
        ],
        label: {
          formatter: '{b}: {d}%',
          fontSize: 13,
        },
        emphasis: { disabled: true },
      },
    ],
  }
}

/**
 * 將 WorkHoursSummary 渲染為 PNG base64 data URL。
 * 當 totalHours === 0 時回傳 null（不建立無效圓餅圖）。
 *
 * @returns base64 PNG data URL，或 null（無工時資料時）
 */
export function renderWorkTypePieChart(summary: WorkHoursSummary): string | null {
  if (summary.totalHours === 0) return null

  const container = document.createElement('div')
  container.style.width = `${CHART_W}px`
  container.style.height = `${CHART_H}px`
  container.style.position = 'absolute'
  container.style.left = '-10000px'
  container.style.top = '-10000px'
  container.style.visibility = 'hidden'
  document.body.appendChild(container)

  let chart: ReturnType<typeof echarts.init> | null = null
  try {
    chart = echarts.init(container)
    chart.setOption(buildWorkTypePieOption(summary) as Parameters<typeof chart.setOption>[0])
    return chart.getDataURL({ type: 'png', pixelRatio: 2 })
  } finally {
    if (chart) {
      chart.dispose()
      chart = null
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}

function renderChartOption(
  option: Record<string, unknown>,
  width = MODULE_CHART_W,
  height = MODULE_CHART_H
): string | null {
  const container = document.createElement('div')
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.position = 'absolute'
  container.style.left = '-10000px'
  container.style.top = '-10000px'
  container.style.visibility = 'hidden'
  document.body.appendChild(container)

  let chart: ReturnType<typeof echarts.init> | null = null
  try {
    chart = echarts.init(container)
    chart.setOption(option as Parameters<typeof chart.setOption>[0])
    return chart.getDataURL({ type: 'png', pixelRatio: 2 })
  } catch {
    return null
  } finally {
    if (chart) {
      try {
        chart.dispose()
      } catch {
        // CLI/jsdom without canvas can fail during dispose; browser rendering is unaffected.
      }
      chart = null
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}

function formatRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

function makeBounds(x: number, y: number, w: number, h: number): ChartBounds {
  return { x, y, w, h }
}

function boundsOverlap(a: ChartBounds, b: ChartBounds): boolean {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y
}

function distributeLabelY<T extends { y: number }>(items: T[], minY: number, maxY: number, preferredGap: number): T[] {
  if (items.length === 0) return items
  const gap = items.length > 1
    ? Math.min(preferredGap, Math.max(14, (maxY - minY) / (items.length - 1)))
    : preferredGap
  items.sort((a, b) => a.y - b.y)
  for (let i = 0; i < items.length; i++) {
    if (i === 0) {
      items[i].y = Math.max(items[i].y, minY)
    } else {
      items[i].y = Math.max(items[i].y, items[i - 1].y + gap)
    }
  }
  const overflow = items[items.length - 1].y - maxY
  if (overflow > 0) {
    items[items.length - 1].y = maxY
    for (let i = items.length - 2; i >= 0; i--) {
      items[i].y = Math.min(items[i].y, items[i + 1].y - gap)
    }
  }
  const underflow = minY - items[0].y
  if (underflow > 0) {
    for (const item of items) item.y += underflow
  }
  return items
}

export function buildModuleWorkHoursLayout(result: ModuleWorkHoursChartResult): ModuleWorkHoursLayout {
  const safeGap = 42
  const pieBounds = makeBounds(152, 46, 356, 356)
  const pieLabelBounds = makeBounds(12, 12, 666, 410)
  const labelLineBounds = makeBounds(12, 45, 666, 340)
  const listBounds = makeBounds(720, 24, 268, 392)
  const listMode: ModuleWorkHoursLayout['listMode'] = result.items.length > 24 ? 'two-column' : 'single-column'
  const columns = listMode === 'two-column' ? 2 : 1
  const colGap = 14
  const colW = (listBounds.w - colGap * (columns - 1)) / columns
  const rowH = listMode === 'two-column' ? 15 : 15
  const fontSize = listMode === 'two-column' ? 9.5 : 9.8
  const rowsPerCol = Math.max(1, Math.floor((listBounds.h - 30) / rowH))
  const sortedItems = [...result.items].sort((a, b) => b.hours - a.hours)
  const centerX = 330
  const centerY = 224
  const outerRadius = 178
  const labelRadius = 218
  const labelWidth = 134
  const leftLabelX = 14
  const rightLabelX = 544
  const leftLabels: Array<{ name: string; x: number; y: number; side: 'left' }> = []
  const rightLabels: Array<{ name: string; x: number; y: number; side: 'right' }> = []
  let cursorAngle = -90
  for (let index = 0; index < result.items.length; index++) {
    const item = result.items[index]
    const angle = cursorAngle + item.ratio * 180
    cursorAngle += item.ratio * 360
    const rad = (angle * Math.PI) / 180
    const y = centerY + Math.sin(rad) * labelRadius - 6
    const name = getChartDisplayName(item.displayName)
    if (Math.cos(rad) >= 0) {
      rightLabels.push({ name, x: rightLabelX, y, side: 'right' })
    } else {
      leftLabels.push({ name, x: leftLabelX, y, side: 'left' })
    }
  }
  const labelPlacements = new Map<string, { x: number; y: number; side: 'left' | 'right' }>()
  for (const item of distributeLabelY(leftLabels, 32, 354, 18)) {
    labelPlacements.set(item.name, item)
  }
  for (const item of distributeLabelY(rightLabels, 32, 354, 18)) {
    labelPlacements.set(item.name, item)
  }
  const labelGraphics: ModuleWorkHoursLabelGraphic[] = []
  cursorAngle = -90
  for (let index = 0; index < result.items.length; index++) {
    const item = result.items[index]
    const angle = cursorAngle + item.ratio * 180
    cursorAngle += item.ratio * 360
    const rad = (angle * Math.PI) / 180
    const displayName = getChartDisplayName(item.displayName)
    const placement = labelPlacements.get(displayName)
    const edge = [centerX + Math.cos(rad) * outerRadius, centerY + Math.sin(rad) * outerRadius]
    if (!placement) continue
    const anchorX = placement.side === 'right' ? placement.x - 8 : placement.x + labelWidth
    const anchorY = placement.y + 6
    labelGraphics.push({
      color: MODULE_COLORS[index % MODULE_COLORS.length],
      name: displayName,
      text: `${getShortChartDisplayName(item.displayName, 10)} ${formatRatio(item.ratio)}`,
      side: placement.side,
      bounds: makeBounds(placement.x, placement.y, labelWidth, 12),
      points: [edge, [anchorX, anchorY]],
    })
  }
  const rows = sortedItems.map((item, index) => {
    const col = listMode === 'two-column' ? Math.floor(index / rowsPerCol) : 0
    const row = listMode === 'two-column' ? index % rowsPerCol : index
    const displayName = getChartDisplayName(item.displayName)
    return {
      color: MODULE_COLORS[index % MODULE_COLORS.length],
      name: displayName,
      hours: item.hours,
      ratio: item.ratio,
      text: `${displayName} | ${formatRatio(item.ratio)}`,
      bounds: makeBounds(
        listBounds.x + col * (colW + colGap),
        listBounds.y + 26 + row * rowH,
        colW,
        rowH
      ),
    }
  })

  const layout = {
    chartWidth: MODULE_WORK_HOURS_CHART_W,
    chartHeight: MODULE_WORK_HOURS_CHART_H,
    pieBounds,
    pieLabelBounds,
    labelLineBounds,
    listBounds,
    safeGap,
    listMode,
    listFontSize: fontSize,
    rows,
    totalListHours: rows.reduce((sum, row) => sum + row.hours, 0),
    totalListRatio: rows.reduce((sum, row) => sum + row.ratio, 0),
    visiblePieLabelCount: labelGraphics.length,
    labelPlacements,
    labelGraphics,
  }

  if (boundsOverlap(layout.pieBounds, layout.listBounds)) {
    throw new Error('Module work-hours chart layout collision: pieBounds intersects listBounds.')
  }
  if (boundsOverlap(layout.pieLabelBounds, layout.listBounds)) {
    throw new Error('Module work-hours chart layout collision: pieLabelBounds intersects listBounds.')
  }
  if (boundsOverlap(layout.labelLineBounds, layout.listBounds)) {
    throw new Error('Module work-hours chart layout collision: labelLineBounds intersects listBounds.')
  }
  if (layout.listBounds.x + layout.listBounds.w > MODULE_WORK_HOURS_CHART_W || layout.listBounds.y + layout.listBounds.h > MODULE_WORK_HOURS_CHART_H - 24) {
    throw new Error('Module work-hours chart layout collision: listBounds exceeds safe area.')
  }
  if (layout.rows.some((row) => row.bounds.x < layout.listBounds.x || row.bounds.x + row.bounds.w > layout.listBounds.x + layout.listBounds.w || row.bounds.y + row.bounds.h > layout.listBounds.y + layout.listBounds.h)) {
    throw new Error('Module work-hours chart layout collision: list rows exceed listBounds.')
  }
  if (layout.labelGraphics.some((label) => label.bounds.x < layout.pieLabelBounds.x || label.bounds.x + label.bounds.w > layout.pieLabelBounds.x + layout.pieLabelBounds.w || label.bounds.y < layout.pieLabelBounds.y || label.bounds.y + label.bounds.h > layout.pieLabelBounds.y + layout.pieLabelBounds.h)) {
    throw new Error('Module work-hours chart layout collision: pie label rows exceed pieLabelBounds.')
  }
  if (layout.labelGraphics.some((label) => label.points.some((point) => point[0] < layout.labelLineBounds.x || point[0] > layout.labelLineBounds.x + layout.labelLineBounds.w || point[1] < layout.pieLabelBounds.y || point[1] > layout.pieLabelBounds.y + layout.pieLabelBounds.h))) {
    throw new Error('Module work-hours chart layout collision: pie label lines exceed labelLineBounds.')
  }
  return layout
}

export function buildModuleWorkHoursOption(
  result: ModuleWorkHoursChartResult
): Record<string, unknown> | null {
  if (result.totalHours <= 0 || result.items.length === 0) return null

  const layout = buildModuleWorkHoursLayout(result)
  const data = result.items.map((item) => {
    const displayName = getChartDisplayName(item.displayName)
    return {
      value: item.hours,
      name: displayName,
      displayName,
      shortName: getShortChartDisplayName(item.displayName, 14),
      hours: item.hours,
      ratio: item.ratio,
      showLabel: true,
      label: {
        show: false,
        formatter: '',
        fontSize: 8.8,
        color: '#1F2937',
        lineHeight: 11,
      },
      labelLine: {
        show: false,
        length: 12,
        length2: 8,
        lineStyle: { width: 1.2 },
      },
    }
  })

  return {
    animation: false,
    color: MODULE_COLORS,
    tooltip: {
      trigger: 'item',
      formatter: (params: { data?: { displayName?: string; hours?: number; ratio?: number } }) => {
        const data = params.data
        if (!data) return ''
        return `${data.displayName}<br/>${formatCompactNumber(data.hours ?? 0, 1)} H<br/>${formatRatio(data.ratio ?? 0)}`
      },
    },
    legend: {
      show: false,
    },
    graphic: [
      ...layout.labelGraphics.flatMap((label) => [
        {
          type: 'polyline',
          shape: { points: label.points },
          style: { stroke: label.color, lineWidth: 1.2, fill: 'none' },
          silent: true,
        },
        {
          type: 'text',
          left: label.bounds.x,
          top: label.bounds.y,
          style: {
            text: label.text,
            width: label.bounds.w,
            height: label.bounds.h,
            overflow: 'break',
            lineOverflow: 'truncate',
            fill: '#1F2937',
            align: label.side === 'right' ? 'left' : 'right',
            font: '8.8px Microsoft JhengHei, Noto Sans TC, PingFang TC, Arial',
            lineHeight: 11,
          },
          silent: true,
        },
      ]),
      {
        type: 'text',
        left: layout.listBounds.x,
        top: layout.listBounds.y,
        style: {
          text: '完整資料清單',
          fill: '#0F2F56',
          font: '700 13px Microsoft JhengHei, Noto Sans TC, PingFang TC, Arial',
        },
      },
      ...layout.rows.flatMap((row) => [
        {
          type: 'rect',
          left: row.bounds.x,
          top: row.bounds.y + 4,
          shape: { width: 8, height: 8 },
          style: { fill: row.color },
        },
        {
          type: 'text',
          left: row.bounds.x + 13,
          top: row.bounds.y,
          style: {
            text: row.text,
            width: row.bounds.w - 13,
            height: row.bounds.h,
            overflow: 'break',
            lineOverflow: 'truncate',
            fill: '#334155',
            font: `${layout.listFontSize}px Microsoft JhengHei, Noto Sans TC, PingFang TC, Arial`,
          },
        },
      ]),
    ],
    series: [
      {
        type: 'pie',
        radius: [100, 178],
        center: [330, 224],
        avoidLabelOverlap: true,
        minAngle: 2,
        label: {
          show: false,
        },
        labelLine: { show: false },
        emphasis: { disabled: true },
        data,
      },
    ],
  }
}

export function renderModuleWorkHoursChart(result: ModuleWorkHoursChartResult): string | null {
  const option = buildModuleWorkHoursOption(result)
  if (!option) return null
  return renderChartOption(option, MODULE_WORK_HOURS_CHART_W, MODULE_WORK_HOURS_CHART_H)
}

export function buildModuleWorkforceOption(
  items: ModuleWorkforceResult[]
): Record<string, unknown> | null {
  if (items.length === 0) return null

  const configuredItems = items.filter((item) => item.workforce !== null)
  if (configuredItems.length === 0) return null
  const displayNames = configuredItems.map((item) => getShortChartDisplayName(item.displayName, 18))
  return {
    animation: false,
    color: ['#4E73BE'],
    grid: { left: 190, right: 104, top: 16, bottom: 28 },
    xAxis: { type: 'value', name: '人力', axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: displayNames,
      axisLabel: { fontSize: 11, color: '#334155' },
    },
    series: [
      {
        name: '合計',
        type: 'bar',
        data: configuredItems.map((item) => item.workforce),
        label: {
          show: true,
          position: 'right',
          formatter: (params: { value?: number }) =>
            formatCompactNumber(params.value ?? 0, 2),
          color: '#1F2937',
          fontSize: 11,
        },
      },
    ],
  }
}

export function renderModuleWorkforceChart(items: ModuleWorkforceResult[]): string | null {
  const option = buildModuleWorkforceOption(items)
  if (!option) return null
  return renderChartOption(option)
}

export function buildMonthlyWorkTypeOption(
  items: MonthlyWorkTypeResult[]
): Record<string, unknown> | null {
  if (items.length === 0) return null
  const hasHours = items.some((item) => item.totalHours > 0)
  if (!hasHours) return null

  return {
    animation: false,
    tooltip: { trigger: 'axis' },
    legend: { top: 4, data: ['專案工時', '維運工時', '其他工時'] },
    grid: { left: 52, right: 24, top: 48, bottom: 48 },
    xAxis: {
      type: 'category',
      data: items.map((item) => item.month),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value', name: '工時 (H)' },
    series: [
      {
        name: '專案工時',
        type: 'bar',
        data: items.map((item) => item.projectHours),
        itemStyle: { color: '#1976D2' },
      },
      {
        name: '維運工時',
        type: 'bar',
        data: items.map((item) => item.maintenanceHours),
        itemStyle: { color: '#43A047' },
      },
      {
        name: '其他工時',
        type: 'bar',
        data: items.map((item) => item.otherHours),
        itemStyle: { color: '#FB8C00' },
      },
    ],
  }
}

export function renderMonthlyWorkTypeChart(items: MonthlyWorkTypeResult[]): string | null {
  const option = buildMonthlyWorkTypeOption(items)
  if (!option) return null
  return renderChartOption(option)
}

export function buildMonthlyProjectMaintenanceOption(
  items: MonthlyWorkTypeResult[]
): Record<string, unknown> | null {
  const configured = items.filter(
    (item) =>
      item.projectRatio !== null &&
      item.maintenanceRatio !== null &&
      item.projectWorkforce !== null &&
      item.maintenanceWorkforce !== null
  )
  if (configured.length === 0) return null

  return {
    animation: false,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      bottom: 0,
      data: ['佔比-專案', '佔比-維運', '人力-專案', '人力-維運'],
      textStyle: { fontSize: 11 },
    },
    grid: { left: 92, right: 54, top: 22, bottom: 56 },
    xAxis: { type: 'value', min: 0, axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'category',
      data: configured.map((item) => item.month),
      axisLabel: { fontSize: 12 },
    },
    series: [
      {
        name: '佔比-專案',
        type: 'bar',
        stack: 'project-maintenance',
        data: configured.map((item) => item.projectRatio),
        itemStyle: { color: '#9AD45A' },
        label: {
          show: true,
          formatter: (params: { value?: number }) => `${((params.value ?? 0) * 100).toFixed(2)}%`,
          fontSize: 10,
          color: '#1F2937',
        },
      },
      {
        name: '佔比-維運',
        type: 'bar',
        stack: 'project-maintenance',
        data: configured.map((item) => item.maintenanceRatio),
        itemStyle: { color: '#4E73BE' },
        label: {
          show: true,
          formatter: (params: { value?: number }) => `${((params.value ?? 0) * 100).toFixed(2)}%`,
          fontSize: 10,
          color: '#1F2937',
        },
      },
      {
        name: '人力-專案',
        type: 'bar',
        stack: 'project-maintenance',
        data: configured.map((item) => item.projectWorkforce),
        itemStyle: { color: '#F5C242' },
        label: {
          show: true,
          formatter: (params: { value?: number }) => formatCompactNumber(params.value ?? 0, 2),
          fontSize: 10,
          color: '#1F2937',
        },
      },
      {
        name: '人力-維運',
        type: 'bar',
        stack: 'project-maintenance',
        data: configured.map((item) => item.maintenanceWorkforce),
        itemStyle: { color: '#E9342A' },
        label: {
          show: true,
          formatter: (params: { value?: number }) => formatCompactNumber(params.value ?? 0, 2),
          fontSize: 10,
          color: '#1F2937',
        },
      },
    ],
  }
}

export function renderMonthlyProjectMaintenanceChart(
  items: MonthlyWorkTypeResult[]
): string | null {
  const option = buildMonthlyProjectMaintenanceOption(items)
  if (!option) return null
  return renderChartOption(option)
}
