<template>
  <v-card
    :color="hasFile ? 'surface' : 'surface'"
    :style="hasFile ? 'border: 2px solid #00ACC1' : 'border: 2px dashed #B0BEC5'"
    class="file-upload-card"
  >
    <v-card-title class="d-flex align-center gap-2 pb-1">
      <v-icon :icon="icon" :color="hasFile ? 'secondary' : 'grey'" />
      <span class="text-subtitle-2 font-weight-bold">{{ title }}</span>
      <v-chip size="small" color="error" variant="flat" class="ml-auto">必填</v-chip>
    </v-card-title>

    <v-card-text>
      <!-- 已選取檔案 -->
      <div v-if="hasFile" class="d-flex align-center gap-3">
        <v-icon icon="mdi-file-check" color="success" size="32" />
        <div class="flex-grow-1">
          <div class="text-body-2 font-weight-medium text-truncate" style="max-width: 300px">
            {{ safeFileName }}
          </div>
          <div class="text-caption text-medium-emphasis">{{ safeFileSize }}</div>
        </div>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          color="error"
          :aria-label="`移除 ${title}`"
          @click="removeFile"
        />
      </div>

      <!-- 未選取檔案 -->
      <div v-else class="d-flex flex-column align-center py-4 gap-2">
        <v-icon icon="mdi-upload" size="40" color="grey-lighten-1" />
        <span class="text-body-2 text-medium-emphasis">{{ hint }}</span>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-folder-open"
          @click="triggerFileInput"
        >
          選取檔案
        </v-btn>
      </div>

      <!-- 錯誤訊息 -->
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-2"
        :text="error"
      />

      <!-- 隱藏的 file input -->
      <input
        ref="inputRef"
        type="file"
        :accept="accept"
        style="display: none"
        @change="handleFileChange"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { formatBytes } from '@/config/fileLimits'
  import { assertAllowedFileExtension, assertFileSize } from '@/services/securityService'

  const props = defineProps<{
    title: string
    icon: string
    hint: string
    accept: string
    allowedExtensions: string[]
    maxBytes: number
    extensionErrorMsg: string
    sizeErrorMsg: string
    file: File | null
    error: string
  }>()

  const emit = defineEmits<{
    (e: 'update:file', value: File | null): void
    (e: 'update:error', value: string): void
    (e: 'registerInput', el: HTMLInputElement): void
  }>()

  const inputRef = ref<HTMLInputElement | null>(null)

  const hasFile = computed(() => props.file !== null)

  /**
   * 只顯示檔名（不顯示完整本機路徑）
   */
  const safeFileName = computed(() => {
    if (!props.file) return ''
    // File.name 只包含檔案名稱，不含路徑
    return props.file.name
  })

  const safeFileSize = computed(() => {
    if (!props.file) return ''
    return formatBytes(props.file.size)
  })

  function triggerFileInput() {
    inputRef.value?.click()
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const selectedFile = input.files?.[0] ?? null

    if (!selectedFile) return

    // 驗證副檔名
    if (!assertAllowedFileExtension(selectedFile, props.allowedExtensions)) {
      emit('update:error', props.extensionErrorMsg)
      emit('update:file', null)
      input.value = ''
      return
    }

    // 驗證檔案大小
    if (!assertFileSize(selectedFile, props.maxBytes)) {
      emit('update:error', props.sizeErrorMsg)
      emit('update:file', null)
      input.value = ''
      return
    }

    emit('update:error', '')
    emit('update:file', selectedFile)
  }

  function removeFile() {
    emit('update:file', null)
    emit('update:error', '')
    if (inputRef.value) {
      inputRef.value.value = ''
    }
  }

  // 向父元件公開 input 元素，供清除功能使用
  defineExpose({
    clearInput() {
      if (inputRef.value) {
        inputRef.value.value = ''
      }
    },
  })
</script>

<style scoped>
  .file-upload-card {
    transition: border-color 0.2s ease;
  }
</style>
