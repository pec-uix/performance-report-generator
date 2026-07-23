<template>
  <v-alert
    color="info"
    variant="tonal"
    border="start"
    class="mb-4"
    icon="mdi-shield-check"
  >
    <div class="d-flex flex-column gap-1">
      <span class="text-body-2 font-weight-medium">
        所有 Excel、圖片 ZIP 與簡報資料皆在目前瀏覽器本機處理，不會上傳至伺服器。
        重新整理或關閉網頁後，尚未下載的資料將被清除。
      </span>
      <span class="text-caption text-medium-emphasis mt-1">
        目前版本不使用後端 API、雲端資料庫、外部 AI、使用行為追蹤或第三方錯誤監控。
      </span>
    </div>
  </v-alert>
</template>

<script setup lang="ts">
  // 此元件無需任何邏輯，純顯示用
</script>
