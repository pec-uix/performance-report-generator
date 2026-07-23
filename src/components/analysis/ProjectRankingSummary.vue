<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      專案工時排行（{{ rankLabel }}，前 {{ displayCount }} 名）
    </v-card-title>
    <v-card-text>
      <div v-if="displayGroups.length === 0" class="text-body-2 text-medium-emphasis">
        無專案工時資料。
      </div>
      <v-table v-else density="compact">
        <thead>
          <tr>
            <th class="text-left">排名</th>
            <th class="text-left">項次</th>
            <th class="text-left">專案名稱</th>
            <th class="text-right">工時 (H)</th>
            <th class="text-right">人次</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(group, idx) in displayGroups" :key="group.mainItemNo">
            <td>{{ idx + 1 }}</td>
            <td>{{ group.mainItemNo }}</td>
            <td>{{ group.mainProject.projectName ?? group.mainProject.projectKey ?? '（未命名）' }}</td>
            <td class="text-right">{{ hoursForGroup(group).toFixed(1) }}</td>
            <td class="text-right">{{ peopleForGroup(group) }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectGroupAnalysis } from '@/types/analysis'

const props = defineProps<{
  /** 已排序的完整列表（由外層傳入） */
  rankedGroups: ProjectGroupAnalysis[]
  /** 'cumulative' 或 'quarter' */
  rankType: 'cumulative' | 'quarter'
  displayCount?: number
}>()

const rankLabel = computed(() =>
  props.rankType === 'cumulative' ? '累計' : '單季'
)
const displayCount = computed(() => props.displayCount ?? 5)

const displayGroups = computed(() =>
  props.rankedGroups.slice(0, displayCount.value)
)

function hoursForGroup(group: ProjectGroupAnalysis): number {
  return props.rankType === 'cumulative' ? group.cumulativeHours : group.quarterHours
}

function peopleForGroup(group: ProjectGroupAnalysis): number {
  return props.rankType === 'cumulative' ? group.cumulativePeopleCount : group.quarterPeopleCount
}
</script>
