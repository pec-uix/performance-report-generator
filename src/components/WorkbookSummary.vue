<template>
  <v-card class="mb-4" color="surface">
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon
        :icon="result.valid ? 'mdi-check-circle' : 'mdi-alert-circle'"
        :color="result.valid ? 'success' : 'error'"
      />
      <span class="text-subtitle-1 font-weight-bold">工時 Excel 解析結果</span>
    </v-card-title>
    <v-card-text>
      <v-row dense class="mb-2">
        <v-col cols="12" sm="6">
          <div class="text-body-2">
            狀態：
            <v-chip
              :color="result.valid ? 'success' : 'error'"
              size="small"
              variant="tonal"
            >
              {{ result.valid ? '驗證通過' : '驗證失敗' }}
            </v-chip>
          </div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-body-2">偵測工作表數：{{ result.detectedSheets.length }}</div>
        </v-col>
      </v-row>

      <div v-if="result.missingSheets.length > 0" class="mb-2">
        <div class="text-body-2 font-weight-medium mb-1">缺少工作表：</div>
        <v-chip
          v-for="sheet in result.missingSheets"
          :key="sheet"
          color="error"
          size="small"
          variant="tonal"
          class="mr-1 mb-1"
        >
          {{ sheet }}
        </v-chip>
      </div>

      <div v-if="Object.keys(result.parsedSheets).length > 0">
        <div class="text-body-2 font-weight-medium mb-1">已解析工作表：</div>
        <v-table density="compact" class="rounded border">
          <thead>
            <tr>
              <th class="text-left text-caption">工作表名稱</th>
              <th class="text-right text-caption">資料列數</th>
              <th class="text-left text-caption">偵測欄位數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(sheet, name) in result.parsedSheets" :key="name">
              <td class="text-body-2">{{ sheet.originalName }}</td>
              <td class="text-right text-body-2">{{ sheet.rowCount }}</td>
              <td class="text-body-2">{{ sheet.headers.filter(h => h !== '').length }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import type { WorkbookValidationResult } from '@/types/excel'

  defineProps<{
    result: WorkbookValidationResult
  }>()
</script>
