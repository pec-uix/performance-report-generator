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

const CHART_W = 600
const CHART_H = 400

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
