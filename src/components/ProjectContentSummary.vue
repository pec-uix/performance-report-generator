<template>
  <v-card class="mb-4" color="surface">
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon icon="mdi-table-account" color="primary" />
      <span class="text-subtitle-1 font-weight-bold">專案內容解析結果</span>
    </v-card-title>
    <v-card-text>
      <!-- 工作表偵測 -->
      <v-row dense class="mb-2">
        <v-col cols="6" sm="4">
          <div class="d-flex align-center gap-1">
            <v-icon
              :icon="result.sheetFound ? 'mdi-check-circle' : 'mdi-close-circle'"
              :color="result.sheetFound ? 'success' : 'error'"
              size="18"
            />
            <span class="text-body-2">「專案內容」</span>
          </div>
        </v-col>
        <v-col cols="6" sm="4">
          <div class="d-flex align-center gap-1">
            <v-icon
              :icon="result.alternativeSheetFound ? 'mdi-information' : 'mdi-circle-outline'"
              :color="result.alternativeSheetFound ? 'info' : 'grey'"
              size="18"
            />
            <span class="text-body-2">「專案內容第一期」</span>
          </div>
        </v-col>
      </v-row>

      <!-- 項次統計 -->
      <v-row dense class="mb-2">
        <v-col cols="6" sm="3">
          <div class="text-body-2">資料列數：<strong>{{ result.totalRows }}</strong></div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-body-2">主專案：<strong>{{ result.mainCount }}</strong></div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-body-2">子專案：<strong>{{ result.childCount }}</strong></div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-body-2">
            無效項次：
            <strong :class="result.invalidCount > 0 ? 'text-error' : ''">
              {{ result.invalidCount }}
            </strong>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-body-2">
            重複項次：
            <strong :class="result.duplicateCount > 0 ? 'text-error' : ''">
              {{ result.duplicateCount }}
            </strong>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-body-2">
            孤兒子專案：
            <strong :class="result.orphanChildCount > 0 ? 'text-error' : ''">
              {{ result.orphanChildCount }}
            </strong>
          </div>
        </v-col>
      </v-row>

      <!-- 偵測欄位 -->
      <div v-if="result.detectedHeaders.length > 0">
        <div class="text-body-2 font-weight-medium mb-1">
          偵測到的兩層表頭欄位（共 {{ result.detectedHeaders.length }} 欄）：
        </div>
        <div class="d-flex flex-wrap gap-1">
          <v-chip
            v-for="header in result.detectedHeaders.slice(0, 20)"
            :key="header"
            size="x-small"
            variant="tonal"
            color="primary"
          >
            {{ header }}
          </v-chip>
          <v-chip
            v-if="result.detectedHeaders.length > 20"
            size="x-small"
            variant="tonal"
            color="grey"
          >
            +{{ result.detectedHeaders.length - 20 }} 更多
          </v-chip>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import type { ProjectContentResult } from '@/types/project'

  defineProps<{
    result: ProjectContentResult
  }>()
</script>
