<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      資料品質摘要
    </v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col v-for="item in qualityItems" :key="item.label" cols="6" sm="4">
          <div class="d-flex align-center">
            <v-icon
              :color="item.count > 0 ? 'warning' : 'success'"
              size="16"
              class="mr-1"
            >
              {{ item.count > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}
            </v-icon>
            <div>
              <div class="text-caption text-medium-emphasis">{{ item.label }}</div>
              <div class="text-body-2" :class="item.count > 0 ? 'text-warning' : ''">
                {{ item.count }} {{ item.unit }}
              </div>
            </div>
          </div>
        </v-col>
      </v-row>

      <template v-if="issueCount > 0">
        <v-divider class="my-3" />
        <div class="text-caption text-medium-emphasis mb-2">
          分析訊息（共 {{ issueCount }} 則）
        </div>
        <v-list density="compact" class="pa-0">
          <v-list-item
            v-for="(issue, i) in displayIssues"
            :key="i"
            density="compact"
            class="px-0"
          >
            <template #prepend>
              <v-icon size="14" :color="severityColor(issue.severity)" class="mr-1">
                mdi-information-outline
              </v-icon>
            </template>
            <v-list-item-title class="text-caption text-wrap">
              {{ issue.message }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
        <div v-if="result.issues.length > maxDisplayIssues" class="text-caption text-medium-emphasis mt-1">
          …另有 {{ result.issues.length - maxDisplayIssues }} 則訊息。
        </div>
      </template>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ValidationSeverity } from '@/types/validation'

const props = defineProps<{
  result: ReportAnalysisResult
}>()

const maxDisplayIssues = 20

const qualityItems = computed(() => {
  const dq = props.result.dataQuality
  return [
    { label: '日期錯誤列', count: dq.invalidDateRows,         unit: '列' },
    { label: '工時錯誤列', count: dq.invalidHourRows,         unit: '列' },
    { label: '未比對到專案', count: dq.unmatchedProjectRows,  unit: '列' },
    { label: '歸類為其他',   count: dq.unclassifiedRows,      unit: '列' },
    { label: '未歸類工時',   count: dq.unclassifiedHours,     unit: 'H'  },
    { label: '人員未比對',   count: dq.unmatchedPeopleRows,   unit: '列' },
  ]
})

const issueCount = computed(() => props.result.issues.length)

const displayIssues = computed(() =>
  props.result.issues.slice(0, maxDisplayIssues)
)

function severityColor(severity: ValidationSeverity): string {
  if (severity === 'error')   return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}
</script>
