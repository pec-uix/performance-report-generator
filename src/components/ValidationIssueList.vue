<template>
  <v-card class="mb-4" color="surface">
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon icon="mdi-format-list-bulleted" color="primary" />
      <span class="text-subtitle-1 font-weight-bold">驗證問題清單</span>
      <v-spacer />
      <span class="text-caption text-medium-emphasis">共 {{ issues.length }} 項</span>
    </v-card-title>

    <v-card-text v-if="issues.length === 0">
      <v-alert type="success" variant="tonal" text="沒有任何驗證問題。" />
    </v-card-text>

    <v-card-text v-else>
      <!-- 篩選按鈕 -->
      <div class="d-flex gap-2 flex-wrap mb-3">
        <v-btn
          v-for="f in filters"
          :key="f.value"
          :variant="activeFilter === f.value ? 'elevated' : 'tonal'"
          size="small"
          :color="f.color"
          @click="activeFilter = f.value"
        >
          {{ f.label }}（{{ f.count }}）
        </v-btn>
      </div>

      <v-list density="compact" class="pa-0">
        <v-list-item
          v-for="(issue, idx) in filteredIssues"
          :key="idx"
          :prepend-icon="severityIcon(issue.severity)"
          :base-color="severityColor(issue.severity)"
          class="mb-1"
        >
          <v-list-item-title class="text-body-2 text-wrap">
            {{ issue.message }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="issue.sheet || issue.row" class="text-caption">
            <span v-if="issue.sheet">工作表：{{ issue.sheet }}</span>
            <span v-if="issue.row"> 列 {{ issue.row }}</span>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { ValidationIssue, ValidationSeverity } from '@/types/validation'

  const props = defineProps<{
    issues: ValidationIssue[]
  }>()

  type FilterValue = 'all' | ValidationSeverity
  const activeFilter = ref<FilterValue>('all')

  const errorCount = computed(() => props.issues.filter((i) => i.severity === 'error').length)
  const warningCount = computed(() => props.issues.filter((i) => i.severity === 'warning').length)
  const infoCount = computed(() => props.issues.filter((i) => i.severity === 'info').length)

  const filters = computed(() => [
    { value: 'all' as FilterValue, label: '全部', color: 'primary', count: props.issues.length },
    { value: 'error' as FilterValue, label: '錯誤', color: 'error', count: errorCount.value },
    { value: 'warning' as FilterValue, label: '警告', color: 'warning', count: warningCount.value },
    { value: 'info' as FilterValue, label: '資訊', color: 'info', count: infoCount.value },
  ])

  const filteredIssues = computed(() => {
    if (activeFilter.value === 'all') return props.issues
    return props.issues.filter((i) => i.severity === activeFilter.value)
  })

  function severityIcon(severity: ValidationSeverity): string {
    if (severity === 'error') return 'mdi-close-circle'
    if (severity === 'warning') return 'mdi-alert-circle'
    return 'mdi-information'
  }

  function severityColor(severity: ValidationSeverity): string {
    if (severity === 'error') return 'error'
    if (severity === 'warning') return 'warning'
    return 'info'
  }
</script>
