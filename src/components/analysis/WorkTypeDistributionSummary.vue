<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      工時分類占比 — {{ periodLabel }}
    </v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" sm="4">
          <div class="d-flex align-center mb-1">
            <div class="text-caption font-weight-medium mr-2" style="min-width:40px">專案</div>
            <v-progress-linear
              :model-value="toPercent(summary.projectRatio)"
              color="primary"
              height="12"
              rounded
              bg-color="surface-variant"
            />
            <div class="text-caption ml-2" style="min-width:42px">
              {{ toPercent(summary.projectRatio).toFixed(1) }}%
            </div>
          </div>
        </v-col>
        <v-col cols="12" sm="4">
          <div class="d-flex align-center mb-1">
            <div class="text-caption font-weight-medium mr-2" style="min-width:40px">維運</div>
            <v-progress-linear
              :model-value="toPercent(summary.maintenanceRatio)"
              color="secondary"
              height="12"
              rounded
              bg-color="surface-variant"
            />
            <div class="text-caption ml-2" style="min-width:42px">
              {{ toPercent(summary.maintenanceRatio).toFixed(1) }}%
            </div>
          </div>
        </v-col>
        <v-col cols="12" sm="4">
          <div class="d-flex align-center mb-1">
            <div class="text-caption font-weight-medium mr-2" style="min-width:40px">其他</div>
            <v-progress-linear
              :model-value="toPercent(summary.otherRatio)"
              color="grey"
              height="12"
              rounded
              bg-color="surface-variant"
            />
            <div class="text-caption ml-2" style="min-width:42px">
              {{ toPercent(summary.otherRatio).toFixed(1) }}%
            </div>
          </div>
        </v-col>
      </v-row>
      <div class="text-caption text-medium-emphasis mt-2">
        總工時 {{ formatHours(summary.totalHours) }}；totalHours=0 時占比均顯示為 0%
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { WorkHoursSummary } from '@/types/analysis'

const props = defineProps<{
  summary: WorkHoursSummary
  periodLabel: string
}>()

function toPercent(ratio: number): number {
  return ratio * 100
}

function formatHours(h: number): string {
  return `${h.toFixed(1)} H`
}

void props
</script>
