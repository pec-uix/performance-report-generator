<template>
  <div class="report-generator">
    <!-- 安全提示 -->
    <SecurityNotice />

    <!-- 季度選擇 -->
    <QuarterSelector v-model="selectedQuarter" />

    <!-- 三個檔案選取卡片 -->
    <v-row class="mb-4">
      <v-col cols="12" md="4">
        <FileUploadCard
          ref="workExcelCardRef"
          title="工時分析 Excel"
          icon="mdi-microsoft-excel"
          hint="請選取 .xlsx 檔案（上限 30 MB）"
          accept=".xlsx"
          :allowed-extensions="['.xlsx']"
          :max-bytes="FILE_LIMITS.workExcelMaxBytes"
          extension-error-msg="工時分析 Excel 必須為 .xlsx。"
          size-error-msg="工時分析 Excel 不得超過 30 MB。"
          :file="workExcel.file"
          :error="workExcel.error"
          @update:file="workExcel.file = $event"
          @update:error="workExcel.error = $event"
        />
      </v-col>

      <v-col cols="12" md="4">
        <FileUploadCard
          ref="contentExcelCardRef"
          title="專案內容 Excel"
          icon="mdi-file-table"
          hint="請選取 .xlsx 檔案（上限 10 MB）"
          accept=".xlsx"
          :allowed-extensions="['.xlsx']"
          :max-bytes="FILE_LIMITS.contentExcelMaxBytes"
          extension-error-msg="專案內容 Excel 必須為 .xlsx。"
          size-error-msg="專案內容 Excel 不得超過 10 MB。"
          :file="contentExcel.file"
          :error="contentExcel.error"
          @update:file="contentExcel.file = $event"
          @update:error="contentExcel.error = $event"
        />
      </v-col>

      <v-col cols="12" md="4">
        <FileUploadCard
          ref="imageZipCardRef"
          title="圖片 ZIP"
          icon="mdi-folder-zip"
          hint="請選取 .zip 檔案（上限 200 MB）"
          accept=".zip"
          :allowed-extensions="['.zip']"
          :max-bytes="FILE_LIMITS.zipMaxBytes"
          extension-error-msg="圖片資料必須為 .zip。"
          size-error-msg="圖片 ZIP 不得超過 200 MB。"
          :file="imageZip.file"
          :error="imageZip.error"
          @update:file="imageZip.file = $event"
          @update:error="imageZip.error = $event"
        />
      </v-col>
    </v-row>

    <!-- 檔案選取摘要 -->
    <v-card class="mb-4" color="surface">
      <v-card-title class="d-flex align-center gap-2 pb-1">
        <v-icon icon="mdi-clipboard-list-outline" color="primary" />
        <span class="text-subtitle-1 font-weight-bold">檔案選取摘要</span>
      </v-card-title>
      <v-card-text>
        <v-list density="compact">
          <v-list-item
            v-for="item in fileSummary"
            :key="item.label"
            :prepend-icon="item.selected ? 'mdi-check-circle' : 'mdi-circle-outline'"
            :base-color="item.selected ? 'success' : 'grey'"
          >
            <v-list-item-title class="text-body-2">
              {{ item.label }}：{{ item.selected ? item.name : '尚未選取' }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- 操作按鈕 -->
    <div class="d-flex gap-4 flex-wrap">
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-arrow-right-circle"
        :disabled="!allFilesSelected || isValidating"
        :loading="isValidating"
        @click="handleNextStep"
      >
        下一步：驗證資料
      </v-btn>

      <v-btn
        color="error"
        variant="tonal"
        size="large"
        prepend-icon="mdi-delete-sweep"
        @click="handleClearAll"
      >
        清除所有資料
      </v-btn>
    </div>

    <!-- 全域訊息 -->
    <v-alert
      v-if="globalMessage"
      type="success"
      variant="tonal"
      class="mt-4"
      :text="globalMessage"
      closable
      @click:close="globalMessage = ''"
    />

    <!-- Phase 2：驗證進度 -->
    <v-card v-if="isValidating" class="mt-4" color="surface">
      <v-card-title class="d-flex align-center gap-2 pb-1">
        <v-progress-circular indeterminate size="20" color="primary" />
        <span class="text-subtitle-1 font-weight-bold">資料驗證進行中…</span>
      </v-card-title>
      <v-card-text>
        <v-list density="compact">
          <v-list-item
            v-for="step in progressSteps"
            :key="step.key"
            :prepend-icon="stepIcon(step.key)"
            :base-color="stepColor(step.key)"
          >
            <v-list-item-title class="text-body-2">{{ step.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Phase 2：驗證結果 -->
    <template v-if="validationResult && !isValidating">
      <ValidationSummary :state="validationResult" class="mt-4" />
      <WorkbookSummary
        v-if="validationResult.workbookResult"
        :result="validationResult.workbookResult"
      />
      <ProjectContentSummary
        v-if="validationResult.projectContentResult"
        :result="validationResult.projectContentResult"
      />
      <ImageSummary
        v-if="validationResult.zipResult"
        :zip-result="validationResult.zipResult"
        :match-result="validationResult.imageMatchResult"
      />
      <ValidationIssueList :issues="validationResult.allIssues" />

      <!-- Phase 3：計算分析結果按鈕 -->
      <div
        v-if="validationResult.errorCount === 0"
        class="d-flex gap-4 flex-wrap mt-4"
      >
        <v-btn
          color="success"
          size="large"
          prepend-icon="mdi-calculator"
          :loading="isAnalyzing"
          @click="handleAnalyze"
        >
          下一步：計算分析結果
        </v-btn>
      </div>
      <v-alert
        v-else
        type="warning"
        variant="tonal"
        class="mt-4"
        text="驗證尚有錯誤，請修正後再計算分析結果。"
      />
    </template>

    <!-- Phase 3：分析進行中 -->
    <v-card v-if="isAnalyzing" class="mt-4" color="surface">
      <v-card-title class="d-flex align-center gap-2 pb-1">
        <v-progress-circular indeterminate size="20" color="success" />
        <span class="text-subtitle-1 font-weight-bold">分析計算中…</span>
      </v-card-title>
    </v-card>

    <!-- Phase 3：分析錯誤 -->
    <v-alert
      v-if="analysisError"
      type="error"
      variant="tonal"
      class="mt-4"
      :text="analysisError"
    />

    <!-- Phase 3：分析結果 -->
    <template v-if="analysisResult && !isAnalyzing">
      <v-divider class="my-6" />
      <div class="text-h6 font-weight-bold mb-4">
        <v-icon color="success" class="mr-2">mdi-chart-bar</v-icon>
        分析結果（{{ analysisResult.quarter }}）
      </div>
      <AnalysisPeriodSummary :result="analysisResult" />
      <v-row>
        <v-col cols="12" md="6">
          <WorkHoursSummaryCard
            :summary="analysisResult.cumulative.workHours"
            period-label="累計"
          />
        </v-col>
        <v-col cols="12" md="6">
          <WorkHoursSummaryCard
            :summary="analysisResult.quarterSummary.workHours"
            period-label="單季"
          />
        </v-col>
        <v-col cols="12" md="6">
          <WorkforceSummaryCard
            :summary="analysisResult.cumulative.workforce"
            period-label="累計"
          />
        </v-col>
        <v-col cols="12" md="6">
          <WorkforceSummaryCard
            :summary="analysisResult.quarterSummary.workforce"
            period-label="單季"
          />
        </v-col>
        <v-col cols="12" md="6">
          <WorkTypeDistributionSummary
            :summary="analysisResult.cumulative.workHours"
            period-label="累計"
          />
        </v-col>
        <v-col cols="12" md="6">
          <WorkTypeDistributionSummary
            :summary="analysisResult.quarterSummary.workHours"
            period-label="單季"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="6">
          <ProjectRankingSummary
            :ranked-groups="analysisResult.cumulativeProjectRanking"
            rank-type="cumulative"
            :display-count="5"
          />
        </v-col>
        <v-col cols="12" md="6">
          <ProjectRankingSummary
            :ranked-groups="analysisResult.quarterProjectRanking"
            rank-type="quarter"
            :display-count="5"
          />
        </v-col>
      </v-row>
      <RevenueSummaryCard :revenue="analysisResult.revenue" />
      <DataQualitySummary :result="analysisResult" />

      <!-- Phase 4：產生 PPT -->
      <v-divider class="my-4" />
      <PptDownloadButton
        :result="analysisResult"
        @blob-ready="handlePptBlobReady"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onUnmounted } from 'vue'
  import SecurityNotice from '@/components/SecurityNotice.vue'
  import QuarterSelector from '@/components/QuarterSelector.vue'
  import FileUploadCard from '@/components/FileUploadCard.vue'
  import ValidationSummary from '@/components/ValidationSummary.vue'
  import ValidationIssueList from '@/components/ValidationIssueList.vue'
  import WorkbookSummary from '@/components/WorkbookSummary.vue'
  import ProjectContentSummary from '@/components/ProjectContentSummary.vue'
  import ImageSummary from '@/components/ImageSummary.vue'
  import AnalysisPeriodSummary from '@/components/analysis/AnalysisPeriodSummary.vue'
  import WorkHoursSummaryCard from '@/components/analysis/WorkHoursSummaryCard.vue'
  import WorkforceSummaryCard from '@/components/analysis/WorkforceSummaryCard.vue'
  import WorkTypeDistributionSummary from '@/components/analysis/WorkTypeDistributionSummary.vue'
  import ProjectRankingSummary from '@/components/analysis/ProjectRankingSummary.vue'
  import RevenueSummaryCard from '@/components/analysis/RevenueSummaryCard.vue'
  import DataQualitySummary from '@/components/analysis/DataQualitySummary.vue'
  import PptDownloadButton from '@/components/ppt/PptDownloadButton.vue'
  import { FILE_LIMITS } from '@/config/fileLimits'
  import type { QuarterKey } from '@/types/report'
  import type { ReportAnalysisResult } from '@/types/reportAnalysis'
  import { clearAllData, clearPhase2Data, clearPhase3Data, clearPhase4Data, createEmptyFileState } from '@/services/cleanupService'
  import {
    runValidation,
    type ValidationState,
    type ProcessingStep,
  } from '@/services/validationService'
  import { runAnalysis } from '@/services/reportAnalysisService'

  type FileUploadCardInstance = InstanceType<typeof FileUploadCard>

  const selectedQuarter = ref<QuarterKey>('S1')

  const workExcel = ref(createEmptyFileState())
  const contentExcel = ref(createEmptyFileState())
  const imageZip = ref(createEmptyFileState())
  const globalMessage = ref('')

  const workExcelCardRef = ref<FileUploadCardInstance | null>(null)
  const contentExcelCardRef = ref<FileUploadCardInstance | null>(null)
  const imageZipCardRef = ref<FileUploadCardInstance | null>(null)

  const isValidating = ref(false)
  const currentStep = ref<ProcessingStep | null>(null)
  const validationResult = ref<ValidationState | null>(null)

  // Phase 3
  const isAnalyzing = ref(false)
  const analysisResult = ref<ReportAnalysisResult | null>(null)
  const analysisError = ref('')

  // Phase 4
  const pptBlobUrl = ref('')
  const pptBlob = ref<Blob | null>(null)

  const progressSteps: { key: ProcessingStep; label: string }[] = [
    { key: 'reading-work-excel', label: '讀取工時 Excel' },
    { key: 'validating-workbook', label: '驗證工作表與欄位' },
    { key: 'reading-content-excel', label: '讀取專案內容 Excel' },
    { key: 'validating-items', label: '驗證項次' },
    { key: 'reading-zip', label: '安全解析圖片 ZIP' },
    { key: 'matching-images', label: '比對圖片' },
  ]

  const completedSteps = ref<Set<ProcessingStep>>(new Set())

  function stepIcon(key: ProcessingStep): string {
    if (completedSteps.value.has(key)) return 'mdi-check-circle'
    if (currentStep.value === key) return 'mdi-loading'
    return 'mdi-circle-outline'
  }

  function stepColor(key: ProcessingStep): string {
    if (completedSteps.value.has(key)) return 'success'
    if (currentStep.value === key) return 'primary'
    return 'grey'
  }

  const allFilesSelected = computed(
    () =>
      workExcel.value.file !== null &&
      contentExcel.value.file !== null &&
      imageZip.value.file !== null
  )

  const fileSummary = computed(() => [
    {
      label: '工時分析 Excel',
      selected: workExcel.value.file !== null,
      name: workExcel.value.file?.name ?? '',
    },
    {
      label: '專案內容 Excel',
      selected: contentExcel.value.file !== null,
      name: contentExcel.value.file?.name ?? '',
    },
    {
      label: '圖片 ZIP',
      selected: imageZip.value.file !== null,
      name: imageZip.value.file?.name ?? '',
    },
  ])

  async function handleNextStep() {
    if (!allFilesSelected.value || isValidating.value) return

    const workFile = workExcel.value.file!
    const contentFile = contentExcel.value.file!
    const zipFile = imageZip.value.file!

    isValidating.value = true
    globalMessage.value = ''
    validationResult.value = null
    analysisResult.value = null
    analysisError.value = ''
    completedSteps.value = new Set()

    try {
      const result = await runValidation(
        workFile,
        contentFile,
        zipFile,
        (step) => {
          if (currentStep.value !== null) {
            completedSteps.value = new Set([...completedSteps.value, currentStep.value])
          }
          currentStep.value = step
        }
      )
      validationResult.value = result
    } finally {
      isValidating.value = false
      currentStep.value = null
    }
  }

  function handleAnalyze() {
    if (!validationResult.value) return
    isAnalyzing.value = true
    analysisResult.value = null
    analysisError.value = ''

    try {
      analysisResult.value = runAnalysis(validationResult.value, selectedQuarter.value)
    } catch (err) {
      analysisError.value = err instanceof Error ? err.message : '分析計算發生未知錯誤。'
    } finally {
      isAnalyzing.value = false
    }
  }

  function handleClearAll() {
    // 取得各 card 的 input 元素
    const workInputEl = (workExcelCardRef.value as { $el?: HTMLElement } | null)
      ?.$el?.querySelector('input[type="file"]') as HTMLInputElement | null

    const contentInputEl = (contentExcelCardRef.value as { $el?: HTMLElement } | null)
      ?.$el?.querySelector('input[type="file"]') as HTMLInputElement | null

    const zipInputEl = (imageZipCardRef.value as { $el?: HTMLElement } | null)
      ?.$el?.querySelector('input[type="file"]') as HTMLInputElement | null

    clearAllData({
      workExcel,
      contentExcel,
      imageZip,
      globalMessage,
      workExcelInputEl: workInputEl,
      contentExcelInputEl: contentInputEl,
      imageZipInputEl: zipInputEl,
    })

    workExcelCardRef.value?.clearInput()
    contentExcelCardRef.value?.clearInput()
    imageZipCardRef.value?.clearInput()

    clearPhase2Data({
      validationState: validationResult,
      processingStep: currentStep,
    })
    clearPhase3Data({
      analysisResult,
      analysisError,
    })
    clearPhase4Data({
      pptBlobUrl,
      pptBlob,
    })
    completedSteps.value = new Set()
    isValidating.value = false
    isAnalyzing.value = false
  }

  function handlePptBlobReady(url: string, blob: Blob): void {
    pptBlobUrl.value = url
    pptBlob.value = blob
  }

  // 元件卸載時清除記憶體狀態
  onUnmounted(() => {
    workExcel.value = createEmptyFileState()
    contentExcel.value = createEmptyFileState()
    imageZip.value = createEmptyFileState()
    globalMessage.value = ''
    clearPhase2Data({
      validationState: validationResult,
      processingStep: currentStep,
    })
    clearPhase3Data({
      analysisResult,
      analysisError,
    })
    clearPhase4Data({
      pptBlobUrl,
      pptBlob,
    })
  })
</script>
