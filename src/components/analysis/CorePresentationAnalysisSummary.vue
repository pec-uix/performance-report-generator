<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      核心分析圖
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col
          v-for="chart in analysis.moduleWorkHoursCharts"
          :key="`${chart.periodType}-${chart.startDate}-${chart.endDate}`"
          cols="12"
          md="6"
        >
          <div class="text-subtitle-2 font-weight-bold mb-2">
            模組工時分布 — {{ periodLabel(chart.periodType) }}
          </div>
          <div class="text-caption text-medium-emphasis mb-2">
            {{ chart.startDate }} ～ {{ chart.endDate }}，總工時 {{ formatHours(chart.totalHours) }}
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>模組</th>
                <th class="text-right">工時</th>
                <th class="text-right">占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in chart.items.slice(0, 8)" :key="item.moduleKey">
                <td>{{ item.displayName }}</td>
                <td class="text-right">{{ formatHours(item.hours) }}</td>
                <td class="text-right">{{ formatPercent(item.ratio) }}</td>
              </tr>
              <tr v-if="chart.items.length === 0">
                <td colspan="3" class="text-medium-emphasis">此期間無模組工時資料。</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>

        <v-col cols="12" md="6">
          <v-alert type="warning" variant="tonal" density="compact">
            人力公式尚未確認。已建立 {{ analysis.moduleWorkforce.length }} 個模組的人力模型，
            但本階段不產生人月或人力投入假數值。
          </v-alert>
        </v-col>

        <v-col cols="12" md="6">
          <v-alert type="info" variant="tonal" density="compact" class="mb-2">
            專案／維運占比分母尚未確認；以下僅呈現每月工時，不顯示百分比。
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>月份</th>
                <th class="text-right">專案</th>
                <th class="text-right">維運</th>
                <th class="text-right">其他</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in analysis.monthlyWorkTypes" :key="item.month">
                <td>{{ item.month }}</td>
                <td class="text-right">{{ formatHours(item.projectHours) }}</td>
                <td class="text-right">{{ formatHours(item.maintenanceHours) }}</td>
                <td class="text-right">{{ formatHours(item.otherHours) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { PresentationAnalysisResult } from '@/types/presentationAnalysis'

const props = defineProps<{
  analysis: PresentationAnalysisResult
}>()

function periodLabel(periodType: 'cumulative' | 'quarter'): string {
  return periodType === 'cumulative' ? '累計' : '當季'
}

function formatHours(hours: number): string {
  return `${hours.toFixed(1)} H`
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

void props
</script>
