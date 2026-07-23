<template>
  <v-card class="mb-4" color="surface">
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon icon="mdi-calendar-range" color="primary" />
      <span class="text-subtitle-1 font-weight-bold">選擇季度</span>
    </v-card-title>

    <v-card-text>
      <v-btn-toggle
        :model-value="modelValue"
        mandatory
        color="primary"
        variant="outlined"
        class="mb-4"
        @update:model-value="$emit('update:modelValue', $event)"
      >
        <v-btn
          v-for="key in QUARTER_KEYS"
          :key="key"
          :value="key"
          class="px-6"
        >
          {{ QUARTER_CONFIG[key].label }}
        </v-btn>
      </v-btn-toggle>

      <v-divider class="mb-3" />

      <div class="d-flex flex-column gap-1">
        <div class="d-flex align-center gap-2">
          <v-icon icon="mdi-clock-time-four-outline" size="18" color="secondary" />
          <span class="text-body-2 text-medium-emphasis">{{ currentConfig.cumulativeLabel }}</span>
        </div>
        <div class="d-flex align-center gap-2">
          <v-icon icon="mdi-briefcase-outline" size="18" color="secondary" />
          <span class="text-body-2 text-medium-emphasis">{{ currentConfig.periodLabel }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { QUARTER_CONFIG, QUARTER_KEYS } from '@/config/quarterConfig'
  import type { QuarterKey } from '@/types/report'

  const props = defineProps<{
    modelValue: QuarterKey
  }>()

  defineEmits<{
    (e: 'update:modelValue', value: QuarterKey): void
  }>()

  const currentConfig = computed(() => QUARTER_CONFIG[props.modelValue])
</script>
