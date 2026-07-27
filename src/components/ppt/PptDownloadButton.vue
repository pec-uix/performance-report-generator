<template>
  <div>
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-subtitle-2">專案成本與績效設定</v-card-title>
      <v-card-text>
        <div class="text-caption text-grey mb-3">
          三個單位平均時薪皆填寫後，系統才會計算各專案成本、總費用及截至本期累積績效。
        </div>
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="hourlyRateInputs.informationService"
              label="資訊服務組平均時薪"
              suffix="元／小時"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              variant="outlined"
              :error-messages="rateError(hourlyRateInputs.informationService)"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="hourlyRateInputs.frontendDevelopment"
              label="前端開發課平均時薪"
              suffix="元／小時"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              variant="outlined"
              :error-messages="rateError(hourlyRateInputs.frontendDevelopment)"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="hourlyRateInputs.backendDevelopment"
              label="後端開發課平均時薪"
              suffix="元／小時"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              variant="outlined"
              :error-messages="rateError(hourlyRateInputs.backendDevelopment)"
            />
          </v-col>
        </v-row>
        <v-alert
          :type="hourlyRateSettings ? 'success' : 'info'"
          variant="tonal"
          density="compact"
          class="mt-1"
        >
          <div v-if="hourlyRateSettings">
            已啟用成本與績效計算：
            資訊服務組 {{ formatRate(hourlyRateSettings.informationService) }}、
            前端開發課 {{ formatRate(hourlyRateSettings.frontendDevelopment) }}、
            後端開發課 {{ formatRate(hourlyRateSettings.backendDevelopment) }}
          </div>
          <div v-else>
            尚未啟用成本與績效計算；仍可下載 PPT，截至本期累積績效將顯示 —，成本區顯示成本與績效尚未計算。
          </div>
        </v-alert>
      </v-card-text>
    </v-card>

    <div class="d-flex gap-3 flex-wrap">
      <v-btn
        v-if="canGenerateFull"
        color="teal-darken-2"
        prepend-icon="mdi-file-powerpoint"
        :loading="isGeneratingFull"
        :disabled="isGeneratingFull"
        @click="handleGenerateFull"
      >
        下載完整版 PPT
      </v-btn>
    </div>

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

    <!-- 専案對應表阻擋提示 -->
    <v-alert
      v-if="result.dataQuality.projectMappingBlocked"
      type="error"
      variant="tonal"
      class="mt-3"
      density="compact"
      text="專案工時尚未成功對應至專案內容，請確認專案對應表。完整版 PPT 已停用。"
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
  import type { HourlyRateSettings } from '@/types/projectCost'
  import { QUARTER_CONFIG } from '@/config/quarterConfig'
  import {
    renderMonthlyWorkTypeChart,
    renderMonthlyProjectMaintenanceChart,
    renderModuleWorkHoursChart,
    renderModuleWorkforceChart,
    buildWorkforceFromHoursChart,
    renderWorkTypePieChart,
  } from '@/services/chartRenderer'
  import { triggerPptDownload, revokeAfterTick } from '@/services/downloadService'
  import { buildImageRepository } from '@/services/imagePresentationService'
  import { buildFullPresentation } from '@/services/fullPptxBuilder'
  import {
    createDefaultHourlyRateInputs,
    formatHourlyRate,
    hourlyRateInputError,
    resolveHourlyRateSettings,
  } from '@/services/hourlyRateSettings'

  const props = defineProps<{
    result: ReportAnalysisResult
    projectContent?: ProjectContentResult | null
    zipFile?: File | null
    validImages?: ParsedImageEntry[] | null
  }>()

  const emit = defineEmits<{
    fullBlobReady: [url: string, blob: Blob, stats: FullPresentationResult]
  }>()

  const isGeneratingFull = ref(false)
  const generateFullError = ref('')
  const currentProgressStep = ref<Phase5ProgressStep | null>(null)
  const completedSteps = ref<Set<Phase5ProgressStep>>(new Set())
  const presentationStats = ref<FullPresentationResult | null>(null)
  const hourlyRateInputs = ref(createDefaultHourlyRateInputs())

  const canGenerateFull = computed(
    () =>
      props.projectContent !== null &&
      props.projectContent !== undefined &&
      !props.result.dataQuality.projectMappingBlocked
  )

  function rateError(value: string): string {
    return hourlyRateInputError(value)
  }

  function formatRate(value: number | undefined): string {
    return formatHourlyRate(value)
  }

  const hourlyRateSettings = computed<HourlyRateSettings | undefined>(() => {
    return resolveHourlyRateSettings(hourlyRateInputs.value)
  })

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
      const workHoursCharts = props.result.presentationAnalysis.presentationWorkHoursCharts
        ?? props.result.presentationAnalysis.moduleWorkHoursCharts
      const presentationWHCharts = workHoursCharts
      const peopleCont = props.result.frontendPeopleCount
      const cumulativeWHWorkforceItems = buildWorkforceFromHoursChart(presentationWHCharts[0]!, peopleCont)
      const quarterWHChart = presentationWHCharts.length > 1 ? presentationWHCharts[1]! : null
      const quarterWHWorkforceItems = quarterWHChart
        ? buildWorkforceFromHoursChart(quarterWHChart, peopleCont)
        : null
      const presentationCharts = {
        moduleWorkHours: workHoursCharts.map((chart) => ({
          chart,
          imageBase64: renderModuleWorkHoursChart(chart),
        })),
        moduleWorkforce: renderModuleWorkforceChart(cumulativeWHWorkforceItems),
        moduleWorkforceQuarter: quarterWHWorkforceItems
          ? renderModuleWorkforceChart(quarterWHWorkforceItems)
          : null,
        monthlyWorkType:
          props.result.presentationAnalysis.monthlyRatioBasis === 'project-and-maintenance-only'
            ? renderMonthlyProjectMaintenanceChart(props.result.presentationAnalysis.monthlyWorkTypes)
            : renderMonthlyWorkTypeChart(props.result.presentationAnalysis.monthlyWorkTypes),
      }

      currentProgressStep.value = 'processing-images'
      const images = props.zipFile && props.validImages
        ? await buildImageRepository(props.zipFile, props.validImages)
        : new Map<string, Uint8Array>()

      completedSteps.value = new Set(['processing-images'])

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
        {
          analysis: props.result,
          projectContent,
          images,
          presentationCharts,
          hourlyRateSettings: hourlyRateSettings.value,
        },
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
</script>
