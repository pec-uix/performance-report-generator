<template>
  <v-card class="mb-4" color="surface">
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon icon="mdi-image-multiple" color="primary" />
      <span class="text-subtitle-1 font-weight-bold">圖片配對結果</span>
    </v-card-title>
    <v-card-text>
      <!-- ZIP 統計 -->
      <div class="text-body-2 font-weight-medium mb-1">圖片 ZIP：</div>
      <v-row dense class="mb-2">
        <v-col cols="6" sm="3">
          <div class="text-body-2">ZIP 圖片數：<strong>{{ zipResult.totalImages }}</strong></div>
        </v-col>
        <v-col v-if="zipResult.duplicateBasenames.length > 0" cols="6" sm="3">
          <div class="text-body-2">
            重複基本檔名：
            <strong class="text-error">{{ zipResult.duplicateBasenames.length }}</strong>
          </div>
        </v-col>
      </v-row>

      <!-- 配對統計 -->
      <template v-if="matchResult">
        <div class="text-body-2 font-weight-medium mb-1">圖片配對：</div>
        <v-row dense class="mb-2">
          <v-col cols="6" sm="3">
            <div class="text-body-2">
              Excel 引用數：<strong>{{ matchResult.summary.referencedCount }}</strong>
            </div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-body-2">
              成功配對：
              <strong :class="matchResult.summary.matchedCount === matchResult.summary.referencedCount ? 'text-success' : ''">
                {{ matchResult.summary.matchedCount }}
              </strong>
            </div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-body-2">
              缺少圖片：
              <strong :class="matchResult.summary.missingCount > 0 ? 'text-warning' : ''">
                {{ matchResult.summary.missingCount }}
              </strong>
            </div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-body-2">
              未使用圖片：
              <strong :class="matchResult.summary.unusedCount > 0 ? 'text-medium-emphasis' : ''">
                {{ matchResult.summary.unusedCount }}
              </strong>
            </div>
          </v-col>
        </v-row>
      </template>

      <v-alert
        v-if="zipResult.duplicateBasenames.length > 0"
        type="error"
        variant="tonal"
        class="mt-2"
        density="compact"
      >
        ZIP 中有重複的基本檔名，Excel 引用時無法確定對應哪一張圖片。
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import type { ParsedZipResult, ImageMatchResult } from '@/types/image'

  defineProps<{
    zipResult: ParsedZipResult
    matchResult: ImageMatchResult | null
  }>()
</script>
