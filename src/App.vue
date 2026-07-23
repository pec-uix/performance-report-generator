<template>
  <v-app>
    <v-app-bar color="primary" elevation="4">
      <v-app-bar-title>
        <div class="d-flex align-center gap-2">
          <v-icon icon="mdi-chart-bar" size="28" />
          <span class="text-h6 font-weight-bold">季度績效報告產生器</span>
        </div>
      </v-app-bar-title>
      <template #append>
        <span class="text-caption text-blue-lighten-3 mr-4">Phase 1 — 檔案選取</span>
      </template>
    </v-app-bar>

    <v-main style="background-color: #f0f4f8">
      <v-container max-width="1280" class="py-6">
        <ReportGeneratorView />
      </v-container>
    </v-main>

    <v-footer color="primary" class="text-center text-caption">
      <span class="w-100 text-blue-lighten-3">
        季度績效報告產生器 — 純瀏覽器本機處理，資料不會上傳至任何伺服器
      </span>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
  import ReportGeneratorView from '@/views/ReportGeneratorView.vue'
</script>
