<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      人力統計 — {{ periodLabel }}
    </v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">有效人數</div>
          <div class="text-h6">{{ summary.activePeopleCount }} 人</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">總工時</div>
          <div class="text-body-1">{{ formatHours(summary.totalHours) }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">人均工時</div>
          <div class="text-body-1">
            {{ summary.averageHoursPerPerson !== null ? formatHours(summary.averageHoursPerPerson) : '—' }}
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">人月（估）</div>
          <div class="text-body-1 text-medium-emphasis">
            <span v-if="summary.personMonthsStatus === 'calculated' && summary.personMonths !== null">
              {{ summary.personMonths.toFixed(2) }} 人月
            </span>
            <span v-else>尚未設定</span>
          </div>
        </v-col>
      </v-row>
      <v-divider class="my-3" />
      <v-row dense>
        <v-col cols="4">
          <div class="text-caption text-medium-emphasis">專案人數</div>
          <div class="text-body-2">{{ summary.projectPeopleCount }} 人</div>
        </v-col>
        <v-col cols="4">
          <div class="text-caption text-medium-emphasis">維運人數</div>
          <div class="text-body-2">{{ summary.maintenancePeopleCount }} 人</div>
        </v-col>
        <v-col cols="4">
          <div class="text-caption text-medium-emphasis">其他人數</div>
          <div class="text-body-2">{{ summary.otherPeopleCount }} 人</div>
        </v-col>
        <v-col cols="12">
          <div class="text-caption text-medium-emphasis">
            ※ 專案／維運／其他人數以有效期間內有工時者計算，同一人可跨分類，不應直接加總為總人數。
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { WorkforceSummary } from '@/types/analysis'

const props = defineProps<{
  summary: WorkforceSummary
  periodLabel: string
}>()

function formatHours(h: number): string {
  return `${h.toFixed(1)} H`
}

void props
</script>
