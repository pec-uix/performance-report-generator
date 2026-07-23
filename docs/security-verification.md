# 安全驗證手冊

本文件說明如何手動驗證「季度績效報告產生器」不會洩漏使用者資料。

---

## 驗證 1：Network（網路流量檢查）

**目標：確認選取或處理檔案時，沒有資料被傳送至外部。**

1. 執行 `npm run dev`，在瀏覽器開啟 `http://localhost:5173`
2. 開啟 Chrome DevTools（F12）
3. 切換至 **Network** 分頁
4. 按下 🚫（Clear）清除所有紀錄
5. 選擇工時分析 Excel（任意 .xlsx 測試檔案）
6. 選擇專案內容 Excel（任意 .xlsx 測試檔案）
7. 選擇圖片 ZIP（任意 .zip 測試檔案）
8. 切換 S1、S2、S3 季度
9. 按下「下一步：驗證資料」
10. 按下「清除所有資料」

**預期結果：**
- ✅ 沒有任何 POST、PUT、PATCH、DELETE 請求
- ✅ 沒有任何連到第三方網域的請求（如 google-analytics.com、sentry.io 等）
- ✅ 沒有包含檔案內容的請求
- ✅ 僅有靜態資源請求（js、css、fonts），且全部指向 localhost 或 github.io

---

## 驗證 2：Application Storage（儲存空間檢查）

**目標：確認沒有資料被寫入瀏覽器持久化儲存。**

1. 開啟 Chrome DevTools → **Application** 分頁
2. 左側展開 **Storage** 區段
3. 分別檢查：
   - Local Storage → `http://localhost:5173`
   - Session Storage → `http://localhost:5173`
   - IndexedDB（應為空）
   - Cache Storage（應只有 Vite 開發快取，無使用者資料）
4. 選取三個測試檔案並操作
5. 重新檢查上述所有儲存空間

**預期結果：**
- ✅ Local Storage 沒有使用者資料（應完全為空）
- ✅ Session Storage 沒有使用者資料（應完全為空）
- ✅ IndexedDB 沒有本系統建立的資料庫
- ✅ Cache Storage 沒有包含 Excel、ZIP 或圖片的項目

---

## 驗證 3：頁面重新整理（狀態揮發性確認）

**目標：確認所有資料只存在頁面的 JavaScript 記憶體，重新整理後消失。**

1. 選取三個測試檔案（工時 Excel、專案 Excel、圖片 ZIP）
2. 確認三個卡片都顯示檔案名稱
3. 按下 F5 重新整理頁面
4. 確認所有卡片回到「尚未選取」狀態

**預期結果：**
- ✅ 重新整理後所有檔案狀態消失
- ✅ 季度選擇回到預設值 S1
- ✅ 使用者需要重新選取檔案

---

## 驗證 4：Build 產物檢查

**目標：確認打包後的 dist 資料夾不包含真實資料。**

1. 執行 `npm run build`
2. 確認 build 成功（無錯誤）
3. 在 `dist/` 資料夾中搜尋關鍵字：
   - 員工姓名
   - 真實專案名稱
   - 真實檔案路徑
   - 任何 .xlsx、.zip 二進位內容
4. 確認 `dist/` 只包含 HTML、JS、CSS、font 與 favicon.svg

```bash
# 搜尋 dist 是否包含可疑字串（請替換為您的測試關鍵字）
grep -r "員工姓名關鍵字" dist/
grep -r "api.example.com" dist/
grep -r "localStorage" dist/
```

**預期結果：**
- ✅ dist/ 只包含 HTML/JS/CSS/font 檔案
- ✅ 沒有真實姓名、專案名稱
- ✅ 沒有硬編碼 API 端點
- ✅ 沒有 localStorage/sessionStorage 的使用

---

## 驗證 5：CSP 標頭確認

**目標：確認 Content Security Policy 生效。**

1. 在 Chrome DevTools → **Console** 分頁
2. 嘗試執行以下指令（應被 CSP 阻擋）：

```javascript
// 嘗試連線外部 —— 應被 CSP connect-src 阻擋
fetch('https://example.com/test').catch(e => console.error('CSP 阻擋成功', e))
```

3. 切換至 **Network** 分頁，確認請求被阻擋或失敗

**注意事項：**
- GitHub Pages 使用 meta CSP，部分瀏覽器行為可能有差異
- Chrome 完整支援 meta CSP
- 若需完整 HTTP 標頭 CSP，需搭配支援自訂標頭的 CDN（如 Cloudflare）

**預期結果：**
- ✅ Console 顯示 CSP 違規警告
- ✅ 外部請求被阻擋

---

## 已知限制

1. **meta CSP 限制**：GitHub Pages 不支援設定伺服器 HTTP 標頭，CSP 只能透過 `<meta>` 設定。部分 CSP 指令（如 `frame-ancestors`）無法透過 meta 設定，若需完整防護，應搭配 Cloudflare 或其他支援自訂標頭的服務。

2. **開發模式 HMR**：Vite dev server 的 Hot Module Replacement (HMR) 使用 WebSocket（`ws://localhost`），在嚴格 CSP 下可能需要在開發時暫時移除或放寬 meta tag。正式環境不受此影響。

3. **Phase 1 限制**：本階段尚未實作 Excel 解析、ZIP 解壓、ECharts 圖表或 PowerPoint 產生。「下一步：驗證資料」只確認三個檔案已選取，尚未進行真正的資料驗證。

---

## Phase 2：瀏覽器本機 Excel/ZIP 解析驗證

### 驗證 6：Phase 2 解析流程網路隔離

**目標：確認 Excel 與 ZIP 解析完全在瀏覽器記憶體中進行，不傳送任何資料。**

1. 開啟 Chrome DevTools → **Network** 分頁，勾選「Preserve log」
2. 清除所有記錄
3. 選取測試用工時 Excel（`.xlsx`）
4. 選取測試用專案內容 Excel（`.xlsx`）
5. 選取測試用圖片 ZIP（`.zip`）
6. 按下「下一步：驗證資料」，等待驗證完成
7. 觀察 Network 分頁

**預期結果：**
- ✅ 沒有任何新的 HTTP 請求（除靜態資源外）
- ✅ 沒有 XLSX/ZIP 檔案上傳
- ✅ 驗證進度在頁面內顯示（不需要 API 回應）

---

### 驗證 7：ZIP 路徑穿越防護

**目標：確認惡意 ZIP 中的路徑穿越路徑被拒絕。**

手動測試方法（需要 Python 或 zip 工具）：

```python
# 建立含有 ../ 路徑的惡意 ZIP（測試用）
import zipfile
with zipfile.ZipFile('malicious.zip', 'w') as z:
    z.writestr('../evil.png', b'fake image data')
```

1. 選取 `malicious.zip` 作為圖片 ZIP
2. 按下「下一步：驗證資料」
3. 觀察驗證結果

**預期結果：**
- ✅ 出現 `ZIP_UNSAFE_PATH` 錯誤提示
- ✅ 惡意檔案不出現在已解析圖片列表
- ✅ 瀏覽器沒有嘗試讀取 `../evil.png` 的內容

---

### 驗證 8：不允許的副檔名防護

**目標：確認 ZIP 中的非圖片檔案被拒絕。**

1. 建立一個包含 `.exe`、`.js`、`.html` 等非圖片檔案的 ZIP
2. 選取該 ZIP 並執行驗證
3. 觀察驗證結果

**預期結果：**
- ✅ 出現 `ZIP_INVALID_EXTENSION` 錯誤
- ✅ 非圖片檔案不出現在已解析圖片列表
- ✅ `.png`、`.jpg`、`.jpeg` 的圖片正常解析

---

### 驗證 9：圖片大小與數量上限

**目標：確認超大圖片與過多圖片被拒絕，防止記憶體耗盡。**

測試場景：
- 單張圖片超過 15 MB → 應出現 `ZIP_IMAGE_TOO_LARGE`
- ZIP 中圖片超過 300 張 → 應出現 `ZIP_TOO_MANY_IMAGES`
- 解壓後估算總大小超過 500 MB → 應出現 `ZIP_TOTAL_SIZE_EXCEEDED`

**預期結果：**
- ✅ 超出限制的 ZIP 顯示錯誤，不繼續解析
- ✅ 頁面沒有崩潰或無回應
- ✅ 可以清除資料並重新選取

---

### 驗證 10：Excel 必要工作表驗證

**目標：確認工時 Excel 缺少必要工作表時有清楚的錯誤提示。**

1. 選取一個缺少「工時分析(自助)」、「專案清單」等工作表的 Excel
2. 執行驗證
3. 觀察驗證結果

**預期結果：**
- ✅ 出現 `WH_MISSING_SHEET` 錯誤，標明缺少哪些工作表
- ✅ 其他必要工作表正常顯示

---

### 驗證 11：清除 Phase 2 驗證結果

**目標：確認「清除所有資料」可完整移除 Phase 2 的驗證結果。**

1. 完成驗證後，觀察頁面顯示驗證結果
2. 按下「清除所有資料」
3. 觀察頁面狀態

**預期結果：**
- ✅ 驗證結果卡片消失
- ✅ 進度步驟回到初始狀態
- ✅ 所有 Object URL 已被 `URL.revokeObjectURL()` 釋放（可在 Chrome DevTools → Memory 觀察）
- ✅ 重新選取檔案不受前次驗證結果影響

---

### 已知限制（Phase 2）

1. **ZIP metadata 可能被偽造**：圖片大小檢查依賴 ZIP 中央目錄的 metadata（`uncompressedSize`）。惡意製作的 ZIP 可能填入不實的大小數值，繞過大小限制。本系統針對企業內部使用，不防護刻意偽造 metadata 的惡意檔案。

2. **JSZip 不驗證 CRC32**：`JSZip.loadAsync()` 在載入階段不驗證 CRC32，需呼叫 `file.async()` 解壓時才會驗證。本系統只讀取 ZIP metadata 不全量解壓，因此 CRC 損毀的 ZIP 不會被偵測出來。

3. **重複 basename 的圖片引用**：若 ZIP 中有兩個不同路徑但相同 basename 的圖片（如 `A/photo.png` 與 `B/photo.png`），系統無法確定 Excel 引用的是哪一張，會標記為 `ZIP_DUPLICATE_BASENAME` 錯誤。

---

## Phase 3：工時分析計算驗證

### 驗證 12：欄位映射設定確認（`workbookFieldMappings.ts`）

**目標：確認所有欄位均須人工確認，系統不自動猜測欄位名稱。**

1. 開啟 `src/config/workbookFieldMappings.ts`
2. 確認 5 張工作表的每個 `FieldAliasConfig` 物件
3. 驗證重點：
   - 所有欄位 `configuredStatus` 為 `'pending-confirmation'`（收入欄位可能為 `'not-configured'`）
   - 沒有任何 `includes()`、字串相似度等模糊比對邏輯
   - `aliases` 陣列只有明確已知的欄位別名

**預期結果：**
- ✅ 無任何欄位為 `'auto-detected'` 或 `'guessed'`
- ✅ 欄位解析失敗時，系統回報 `MISSING_REQUIRED_FIELD` 而非猜測
- ✅ 收入欄位未找到時，`revenueFieldFound=false`，不計算收入績效

---

### 驗證 13：無模糊字串比對（`fieldResolver.ts`）

**目標：確認 Header 比對只使用精確比對，無 `includes` 或相似度演算法。**

1. 開啟 `src/services/fieldResolver.ts`
2. 確認 `resolveColumnIndex` 函式
3. 確認只有 `=== normalized` 精確比對，無 `includes`、Levenshtein、Jaccard 等

**預期結果：**
- ✅ 欄位名稱完全相符才被接受
- ✅ 錯別字或縮寫不會被自動接受

---

### 驗證 14：日期標準化 UTC 確認（`dateNormalizer.ts`）

**目標：確認所有日期轉換使用 UTC，不受時區影響。**

1. 開啟 `src/services/dateNormalizer.ts`
2. 確認 `getUTCFullYear()`、`getUTCMonth()`、`getUTCDate()` 被使用
3. 確認沒有 `getFullYear()`、`getMonth()`、`getDate()` 等本地時區方法

**預期結果：**
- ✅ Excel serial 45992 轉換結果為 `2025-12-01`
- ✅ 所有日期在不同時區環境下產生相同結果

---

### 驗證 15：季度過濾不修改原始陣列（`quarterFilter.ts`）

**目標：確認過濾操作不會變動輸入資料。**

1. 使用開發者工具在 `filterRecordsByDateRange` 設置斷點
2. 執行分析，觀察函式執行前後 `records` 陣列是否相同

**預期結果：**
- ✅ 過濾前後 `records` 陣列長度相同
- ✅ 函式回傳新陣列，不是原始陣列的 splice 或 pop 結果

---

### 驗證 16：totalHours=0 時 ratio 為 0 非 NaN（`workHoursCalculator.ts`）

**目標：確認空資料時，比率欄位為 0 而非 NaN，不造成 UI 顯示異常。**

**預期結果：**
- ✅ 空工時記錄下，`projectRatio = 0`、`maintenanceRatio = 0`、`otherRatio = 0`
- ✅ UI 顯示 `0%` 而非 `NaN%`

---

### 驗證 17：activePeopleCount 去重（`workforceCalculator.ts`）

**目標：確認同一員工在多筆記錄中只計算一次人數。**

**預期結果：**
- ✅ 員工 A 有 3 筆工時記錄，`activePeopleCount` 仍為 1（含員工 A）
- ✅ `hours = 0` 的員工不計入 `activePeopleCount`

---

### 驗證 18：專案群組無雙重計算（`projectGroupCalculator.ts`）

**目標：確認主項工時不包含子項工時，群組總計 = 主項 + 各子項。**

**預期結果：**
- ✅ 主項 10H + 子項 5H + 子項 3H → 群組 18H（非 36H）
- ✅ 群組人員 = 主項人員 ∪ 子項人員（不重複計算）

---

### 驗證 19：收入績效保守口徑（`revenueCalculator.ts`）

**目標：確認收入欄位不確定時，系統不顯示收入數字。**

**預期結果：**
- ✅ 若 `revenueFieldFound=false`，`configured=false`，UI 顯示「尚未設定」
- ✅ 若所有金額均為 null，`configured=false`
- ✅ 不將年度收入除以 4 分攤至季度（`quarterRevenue = null`）
- ✅ `inputOutputRatio = null`（無成本資料）

---

### 驗證 20：Phase 2 有錯誤時分析拒絕執行（`reportAnalysisService.ts`）

**目標：確認驗證未通過時，分析不會產生錯誤的結果。**

1. 使用缺少必要工作表的 Excel
2. Phase 2 驗證完成後，觀察分析按鈕是否存在

**預期結果：**
- ✅ `validationState.errorCount > 0` 時，「計算分析結果」按鈕不顯示
- ✅ 若強制呼叫 `runAnalysis()`，應拋出 Error

---

### 驗證 21：UI 顯示「尚未設定」提示

**目標：確認收入未設定與人月未設定時有清楚提示，不顯示空白或 0。**

**預期結果：**
- ✅ `RevenueSummaryCard`：收入未設定時顯示藍色「尚未設定」提示文字
- ✅ `WorkforceSummaryCard`：人月未設定時顯示「尚未設定」（非 0 或空值）

---

### 驗證 22：Phase 3 網路隔離（`phase3NetworkGuard.spec.ts`）

**目標：確認分析計算服務不發出任何網路請求。**

執行自動化測試：

```bash
npm run test -- --reporter=verbose phase3NetworkGuard
```

**預期結果：**
- ✅ 4 個測試全部通過
- ✅ `fetch`、`XMLHttpRequest.open`、`navigator.sendBeacon` 均未被呼叫
- ✅ Phase 3 所有 service 檔案均可正常 import

---

### 已知限制（Phase 3）

1. **欄位映射待確認**：所有 5 張工作表的欄位均標記為 `pending-confirmation`，需與資料提供者確認真實欄位名稱後才能正式啟用。

2. **人月未實作**：`personMonths` 固定為 `null`（`personMonthsStatus: 'not-configured'`），需另行設定計算邏輯。

3. **季度收入未區分**：`quarterRevenue` 固定為 `null`，因來源工作表無法確定各筆收入的所屬期別（年度/季度）。

4. **投入產出比未實作**：`inputOutputRatio` 固定為 `null`，需成本資料才能計算。
