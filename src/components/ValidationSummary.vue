<template>
  <v-card class="mb-4" color="surface">
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon
        :icon="hasErrors ? 'mdi-close-circle' : hasWarnings ? 'mdi-alert-circle' : 'mdi-check-circle'"
        :color="hasErrors ? 'error' : hasWarnings ? 'warning' : 'success'"
      />
      <span class="text-subtitle-1 font-weight-bold">驗證結果摘要</span>
    </v-card-title>
    <v-card-text>
      <v-alert
        v-if="hasErrors"
        type="error"
        variant="tonal"
        class="mb-3"
        text="資料驗證未通過，請修正錯誤後重新選取檔案。"
      />
      <v-alert
        v-else-if="hasWarnings"
        type="warning"
        variant="tonal"
        class="mb-3"
        text="資料可繼續使用，但請先確認警告內容。"
      />
      <v-alert
        v-else
        type="success"
        variant="tonal"
        class="mb-3"
        text="所有驗證通過，資料格式正確。"
      />

      <v-row dense>
        <v-col cols="4">
          <div class="d-flex align-center gap-1">
            <v-icon icon="mdi-close-circle" color="error" size="18" />
            <span class="text-body-2">錯誤：<strong>{{ state.errorCount }}</strong></span>
          </div>
        </v-col>
        <v-col cols="4">
          <div class="d-flex align-center gap-1">
            <v-icon icon="mdi-alert-circle" color="warning" size="18" />
            <span class="text-body-2">警告：<strong>{{ state.warningCount }}</strong></span>
          </div>
        </v-col>
        <v-col cols="4">
          <div class="d-flex align-center gap-1">
            <v-icon icon="mdi-information" color="info" size="18" />
            <span class="text-body-2">資訊：<strong>{{ state.infoCount }}</strong></span>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { ValidationState } from '@/services/validationService'

  const props = defineProps<{
    state: ValidationState
  }>()

  const hasErrors = computed(() => props.state.errorCount > 0)
  const hasWarnings = computed(() => props.state.warningCount > 0)
</script>
