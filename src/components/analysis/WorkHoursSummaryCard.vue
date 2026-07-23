<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      工時統計 — {{ periodLabel }}
    </v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">總工時</div>
          <div class="text-h6">{{ formatHours(summary.totalHours) }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">專案工時</div>
          <div class="text-body-1">{{ formatHours(summary.projectHours) }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">維運工時</div>
          <div class="text-body-1">{{ formatHours(summary.maintenanceHours) }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">其他工時</div>
          <div class="text-body-1">{{ formatHours(summary.otherHours) }}</div>
        </v-col>
        <v-col cols="12">
          <div class="text-caption text-medium-emphasis mb-1">紀錄數</div>
          <div class="text-body-2">{{ summary.recordCount.toLocaleString() }} 筆</div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { WorkHoursSummary } from '@/types/analysis'

const props = defineProps<{
  summary: WorkHoursSummary
  periodLabel: string
}>()

function formatHours(h: number): string {
  return `${h.toFixed(1)} H`
}

// suppress unused warning for props
void props
</script>
