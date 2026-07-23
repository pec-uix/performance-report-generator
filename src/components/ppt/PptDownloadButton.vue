<template>
  <div>
    <v-btn
      color="deep-purple"
      size="large"
      prepend-icon="mdi-file-powerpoint"
      :loading="isGenerating"
      :disabled="isGenerating"
      @click="handleGenerate"
    >
      產生測試 PPT（5 頁）
    </v-btn>

    <v-alert
      v-if="generateError"
      type="error"
      variant="tonal"
      class="mt-3"
      :text="generateError"
      density="compact"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import type { ReportAnalysisResult } from '@/types/reportAnalysis'
  import { QUARTER_CONFIG } from '@/config/quarterConfig'
  import { renderWorkTypePieChart } from '@/services/chartRenderer'
  import { preparePptSlideData, assemblePptBlob } from '@/services/pptxBuilder'
  import { triggerPptDownload, revokeAfterTick } from '@/services/downloadService'

  const props = defineProps<{
    result: ReportAnalysisResult
  }>()

  const emit = defineEmits<{
    blobUrlCreated: [url: string]
    blobReady: [url: string, blob: Blob]
  }>()

  const isGenerating = ref(false)
  const generateError = ref('')

  async function handleGenerate(): Promise<void> {
    if (isGenerating.value) return
    isGenerating.value = true
    generateError.value = ''

    try {
      // Step 1: 渲染圓餅圖（同步 DOM 操作）
      const cumulativeChart = renderWorkTypePieChart(props.result.cumulative.workHours)
      const quarterChart = renderWorkTypePieChart(props.result.quarterSummary.workHours)

      // Step 2: 提取純資料（純函式）
      const slideData = preparePptSlideData(props.result, cumulativeChart, quarterChart)

      // Step 3: 組裝 PPT Blob（非同步）
      const blob = await assemblePptBlob(slideData)

      // Step 4: 觸發下載
      const qConfig = QUARTER_CONFIG[props.result.quarter]
      const filename = `績效報告_${qConfig.label}_測試版.pptx`
      const url = triggerPptDownload(blob, filename)

      // Step 5: 通知父層追蹤 URL 與 Blob（供清除使用）
      emit('blobReady', url, blob)
      emit('blobUrlCreated', url)

      // Step 6: 在下一個事件循環撤銷 Object URL
      revokeAfterTick(url)
    } catch (err) {
      generateError.value = err instanceof Error ? err.message : 'PPT 產生發生未知錯誤。'
    } finally {
      isGenerating.value = false
    }
  }
</script>
