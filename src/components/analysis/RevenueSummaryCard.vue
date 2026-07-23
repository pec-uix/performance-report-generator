<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      收入績效
    </v-card-title>
    <v-card-text>
      <v-alert
        v-if="!revenue.configured"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        收入口徑尚未設定，無法計算收入績效。請確認「收入工時彙總」工作表的欄位映射設定。
      </v-alert>

      <template v-if="revenue.configured">
        <v-row dense>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">累計收入</div>
            <div class="text-body-1 font-weight-medium">
              {{ revenue.cumulativeRevenue !== null ? formatAmount(revenue.cumulativeRevenue) : '尚未設定' }}
            </div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">單季收入</div>
            <div class="text-body-1">
              {{ revenue.quarterRevenue !== null ? formatAmount(revenue.quarterRevenue) : '尚未設定' }}
            </div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">每工時收入</div>
            <div class="text-body-1">
              {{ revenue.revenuePerHour !== null ? formatAmount(revenue.revenuePerHour) + ' /H' : '尚未設定' }}
            </div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">投入產出比</div>
            <div class="text-body-1">
              {{ revenue.inputOutputRatio !== null ? revenue.inputOutputRatio.toFixed(2) : '尚未設定' }}
            </div>
          </v-col>
        </v-row>
      </template>

      <div
        v-if="revenue.issues.length > 0"
        class="mt-3"
      >
        <div class="text-caption text-medium-emphasis mb-1">收入資料說明</div>
        <div
          v-for="(issue, i) in revenue.issues"
          :key="i"
          class="text-caption text-medium-emphasis"
        >
          · {{ issue.message }}
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { RevenueSummary } from '@/types/analysis'

const props = defineProps<{
  revenue: RevenueSummary
}>()

function formatAmount(n: number): string {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

void props
</script>
