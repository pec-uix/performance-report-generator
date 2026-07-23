<template>
  <div>
    <!-- 兩個下載按鈕 -->
    <div class="d-flex gap-3 flex-wrap">
      <!-- 測試版（Phase 4）-->
      <v-btn
        color="deep-purple"
        variant="tonal"
        prepend-icon="mdi-file-powerpoint-outline"
        :loading="isGenerating"
        :disabled="isGenerating || isGeneratingFull"
        @click="handleGenerateTest"
      >
        下載測試版 PPT（5 頁）
      </v-btn>

      <!-- 完整版（Phase 5）-->
      <v-btn
        v-if="canGenerateFull"
        color="teal-darken-2"
        prepend-icon="mdi-file-powerpoint"
        :loading="isGeneratingFull"
        :disabled="isGenerating || isGeneratingFull"
        @click="handleGenerateFull"
      >
        下載完整版 PPT
      </v-btn>
    </div>

    <!-- 測試版錯誤 -->
    <v-alert
      v-if="generateError"
      type="error"
      variant="tonal"
      class="mt-3"
      :text="generateError"
      density="compact"
    />

    <!-- 完整版進度 -->
    <v-card v-if="isGeneratingFull" class="mt-4" variant="outlined">
      <v-card-title class="text-subtitle-2">完整版 PPT 產生中…</v-card-title>
      <v-card-text class="pb-2">
        <v-list density="compact">
          <v-list-item
            v-for="step in progressStepDefs"
            :key="step.key"
            :prepend-icon="stepIcon(step.key)"
            :base-color="stepColor(step.key)"
          >
            <v-list-item-title class="text-body-2">{{ step.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- 完整版錯誤 -->
    <v-alert
      v-if="generateFullError"
      type="error"
      variant="tonal"
      class="mt-3"
      :text="generateFullError"
      density="compact"
    />

    <!-- 完整版產生完成統計 -->
    <v-card
      v-if="presentationStats && !isGeneratingFull"
      class="mt-4"
      variant="outlined"
      color="teal-lighten-5"
    >
      <v-card-title class="text-subtitle-2">
        <v-icon color="teal" class="mr-2">mdi-check-circle</v-icon>
        完整版 PPT 已下載
      </v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-3 mb-2">
          <v-chip size="small" color="teal" label>
            {{ presentationStats.totalSlides }} 頁
          </v-chip>
          <v-chip size="small" color="blue" label>
            {{ presentationStats.projectGroupCount }} 個主專案
          </v-chip>
          <v-chip size="small" color="purple" label>
            {{ presentationStats.imageCount }} 張圖片
          </v-chip>
          <v-chip
            v-if="presentationStats.warnings.length > 0"
            size="small"
            color="orange"
            label
          >
            {{ presentationStats.warnings.length }} 個警告
          </v-chip>
        </div>
        <div class="text-caption text-grey">產生時間：{{ presentationStats.generatedAt }}</div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { ReportAnalysisResult } from '@/types/reportAnalysis'
  import type { ProjectContentResult } from '@/types/project'
  import type { ParsedImageEntry } from '@/types/image'
  import type { FullPresentationResult, Phase5ProgressStep } from '@/types/ppt'
  import { QUARTER_CONFIG } from '@/config/quarterConfig'
  import { renderWorkTypePieChart } from '@/services/chartRenderer'
  import { preparePptSlideData, assemblePptBlob } from '@/services/pptxBuilder'
  import { triggerPptDownload, revokeAfterTick } from '@/services/downloadService'
  import { buildImageRepository } from '@/services/imagePresentationService'
  import { buildFullPresentation } from '@/services/fullPptxBuilder'
  import { PPT_MIME_TYPE } from '@/services/pptxBuilder'

  const props = defineProps<{
    result: ReportAnalysisResult
    projectContent?: ProjectContentResult | null
    zipFile?: File | null
    validImages?: ParsedImageEntry[] | null
  }>()

  const emit = defineEmits<{
    blobUrlCreated: [url: string]
    blobReady: [url: string, blob: Blob]
    fullBlobReady: [url: string, blob: Blob, stats: FullPresentationResult]
  }>()

  // ── 測試版狀態 ────────────────────────────────────────────────────────────

  const isGenerating = ref(false)
  const generateError = ref('')

  // ── 完整版狀態 ────────────────────────────────────────────────────────────

  const isGeneratingFull = ref(false)
  const generateFullError = ref('')
  const currentProgressStep = ref<Phase5ProgressStep | null>(null)
  const completedSteps = ref<Set<Phase5ProgressStep>>(new Set())
  const presentationStats = ref<FullPresentationResult | null>(null)

  const canGenerateFull = computed(
    () => props.projectContent !== null && props.projectContent !== undefined
  )

  const progressStepDefs: { key: Phase5ProgressStep; label: string }[] = [
    { key: 'preparing-content', label: '整理專案內容' },
    { key: 'processing-images', label: '處理圖片' },
    { key: 'building-summary-slides', label: '建立摘要頁' },
    { key: 'building-project-slides', label: '建立專案頁' },
    { key: 'assembling-pptx', label: '組裝 PowerPoint' },
    { key: 'preparing-download', label: '準備下載' },
  ]

  function stepIcon(key: Phase5ProgressStep): string {
    if (completedSteps.value.has(key)) return 'mdi-check-circle'
    if (currentProgressStep.value === key) return 'mdi-loading'
    return 'mdi-circle-outline'
  }

  function stepColor(key: Phase5ProgressStep): string {
    if (completedSteps.value.has(key)) return 'success'
    if (currentProgressStep.value === key) return 'teal'
    return 'grey'
  }

  // ── 測試版產生 ────────────────────────────────────────────────────────────

  async function handleGenerateTest(): Promise<void> {
    if (isGenerating.value) return
    isGenerating.value = true
    generateError.value = ''

    try {
      const cumulativeChart = renderWorkTypePieChart(props.result.cumulative.workHours)
      const quarterChart = renderWorkTypePieChart(props.result.quarterSummary.workHours)
      const slideData = preparePptSlideData(props.result, cumulativeChart, quarterChart)
      const blob = await assemblePptBlob(slideData)
      const qConfig = QUARTER_CONFIG[props.result.quarter]
      const filename = `績效報告_${qConfig.label}_測試版.pptx`
      const url = triggerPptDownload(blob, filename)
      emit('blobReady', url, blob)
      emit('blobUrlCreated', url)
      revokeAfterTick(url)
    } catch (err) {
      generateError.value = err instanceof Error ? err.message : 'PPT 產生發生未知錯誤。'
    } finally {
      isGenerating.value = false
    }
  }

  // ── 完整版產生 ────────────────────────────────────────────────────────────

  async function handleGenerateFull(): Promise<void> {
    if (isGeneratingFull.value) return
    isGeneratingFull.value = true
    generateFullError.value = ''
    presentationStats.value = null
    completedSteps.value = new Set()
    currentProgressStep.value = null

    try {
      const cumulativeChart = renderWorkTypePieChart(props.result.cumulative.workHours)
      const quarterChart = renderWorkTypePieChart(props.result.quarterSummary.workHours)

      // 建立圖片資料庫（從 ZIP 提取已驗證圖片）
      currentProgressStep.value = 'processing-images'
      const images = props.zipFile && props.validImages
        ? await buildImageRepository(props.zipFile, props.validImages)
        : new Map<string, Uint8Array>()

      completedSteps.value = new Set(['processing-images'])

      // 準備 PresentationInput
      const emptyProjectContent: ProjectContentResult = {
        sheetFound: false,
        alternativeSheetFound: false,
        totalRows: 0,
        mainCount: 0,
        childCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        orphanChildCount: 0,
        items: [],
        detectedHeaders: [],
        issues: [],
      }
      const projectContent = props.projectContent ?? emptyProjectContent

      const stats = await buildFullPresentation(
        { analysis: props.result, projectContent, images },
        cumulativeChart,
        quarterChart,
        (step) => {
          if (currentProgressStep.value !== null) {
            completedSteps.value = new Set([...completedSteps.value, currentProgressStep.value])
          }
          currentProgressStep.value = step
        }
      )

      completedSteps.value = new Set([...completedSteps.value, 'preparing-download'])
      presentationStats.value = stats

      const qConfig = QUARTER_CONFIG[props.result.quarter]
      const filename = `績效報告_${qConfig.label}_完整版.pptx`
      const url = triggerPptDownload(stats.blob, filename)
      emit('fullBlobReady', url, stats.blob, stats)
      revokeAfterTick(url)
    } catch (err) {
      generateFullError.value = err instanceof Error ? err.message : '完整版 PPT 產生發生未知錯誤。'
    } finally {
      isGeneratingFull.value = false
    }
  }

  // 防止意外重複呼叫：僅在此元件內部使用，不對外暴露
  // PPT_MIME_TYPE 由父層使用（verify content type if needed）
  void PPT_MIME_TYPE
</script>

