<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      分析期間
    </v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">季度</div>
          <div class="text-body-2 font-weight-medium">{{ quarterLabel }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">累計期間</div>
          <div class="text-body-2">{{ cumulativeLabel }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">單季期間</div>
          <div class="text-body-2">{{ quarterPeriodLabel }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">資料產生時間</div>
          <div class="text-body-2">{{ calculatedAt }}</div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import { QUARTER_CONFIG } from '@/config/quarterConfig'

const props = defineProps<{
  result: ReportAnalysisResult
}>()

const quarterLabel = computed(() => QUARTER_CONFIG[props.result.quarter].label)
const cumulativeLabel = computed(() => {
  const { start, end } = props.result.dateRanges.cumulative
  return `${start} ～ ${end}`
})
const quarterPeriodLabel = computed(() => {
  const { start, end } = props.result.dateRanges.quarter
  return `${start} ～ ${end}`
})
const calculatedAt = computed(() => {
  const d = new Date(props.result.metadata.calculatedAt)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})
</script>
