# 季度績效報告產生器

純瀏覽器本機處理的季度績效報告自動產生系統。所有資料處理均在使用者瀏覽器內完成，不上傳至任何伺服器。

---

## 系統目的

協助生成 2026 年度 S1、S2、S3 季度績效報告 PowerPoint。使用者在瀏覽器本機完成資料解析、圖表產生與 PPT 輸出，報告內容不經過任何後端服務。

---

## Phase 1 已完成功能

- ✅ Vue 3 + Vite + TypeScript 專案骨架
- ✅ Vuetify 企業介面設計
- ✅ 季度選擇器（S1 / S2 / S3）
- ✅ 三個檔案選取卡片（工時 Excel、專案 Excel、圖片 ZIP）
- ✅ 檔案大小與副檔名驗證
- ✅ 清除所有資料功能
- ✅ 安全提示元件
- ✅ Content Security Policy (meta)
- ✅ GitHub Actions 自動部署 GitHub Pages
- ✅ ESLint + Prettier 程式碼品質
- ✅ Vitest 單元測試（季度設定、清除服務、網路阻擋）

---

## Phase 2 已完成功能

- ✅ 瀏覽器本機 Excel 解析（`xlsx` 函式庫，無任何網路呼叫）
- ✅ 必要工作表驗證（工時分析(自助)、專案清單、維運清單、人員清單、收入工時彙總）
- ✅ 兩層表頭解析（合併儲存格正規化）
- ✅ 專案內容工作表解析（「專案內容」/ 「專案內容第一期」）
- ✅ 項次驗證（主/子專案分類、重複偵測、孤兒子專案偵測）
- ✅ 瀏覽器本機 ZIP 解壓（`jszip` 函式庫，無任何網路呼叫）
- ✅ ZIP 安全防護：路徑穿越（`../`、`..\`）拒絕、絕對路徑拒絕、僅允許 `.png/.jpg/.jpeg`
- ✅ ZIP 大小防護：單張上限 15 MB、總解壓上限 500 MB、圖片上限 300 張
- ✅ 圖片比對（Excel 引用 vs ZIP 圖片，大小寫不敏感）
- ✅ 驗證進度顯示（6 步驟進度條）
- ✅ 結構化驗證結果展示（錯誤/警告/資訊分類）
- ✅ Phase 2 記憶體清除（`clearPhase2Data`，含 Object URL 釋放）
- ✅ 完整 Vitest 測試（Phase 2 新增 78 個測試，總計 105 個）

---

## Phase 3 已完成功能

- ✅ 欄位盤點與映射設定（`workbookFieldMappings.ts`，5 張工作表，`configuredStatus: pending-confirmation`）
- ✅ 禁止模糊字串比對：欄位解析使用精確 Header 比對（`fieldResolver.ts`）
- ✅ 日期正規化（XLSX serial、YYYY-MM-DD、YYYY/M/D、YYYY.M.D、datetime 字串，UTC 計算）
- ✅ 數字正規化（千分位、小數、空白去除；拒絕空值、NaN、Infinity、負數、含單位文字）
- ✅ 5 張工作表資料映射（工時記錄、人員、專案主檔、維運主檔、收入彙總）
- ✅ 季度與累計日期範圍過濾（純字串比較，不修改原始陣列）
- ✅ 工時分類加總（專案/維運/其他；totalHours=0 時 ratio=0 而非 NaN）
- ✅ 人力統計（去重 activePeopleCount、只計算 hours>0、personMonths 尚未設定）
- ✅ 專案群組工時計算（主項+子項，無雙重加總；群組人員取聯集）
- ✅ 專案工時排行（累計/季度；穩定次排序；不截斷；不修改原始陣列）
- ✅ 收入績效（保守口徑：欄位未找到或全為 null 時 configured=false；不分攤年度收入）
- ✅ 分析主服務（Phase 2 有錯誤時拋出 Error；不猜工作表名稱）
- ✅ 分析結果 UI（7 個新元件：AnalysisPeriodSummary、WorkHoursSummaryCard、WorkforceSummaryCard、WorkTypeDistributionSummary、ProjectRankingSummary、RevenueSummaryCard、DataQualitySummary）
- ✅ Phase 3 記憶體清除（`clearPhase3Data`）
- ✅ Phase 3 網路阻擋測試（fetch / XHR / sendBeacon 全封鎖）
- ✅ Vitest 測試：Phase 3 新增 113 個測試，總計 218 個

---

## 尚未完成（Phase 4+）

- ❌ ECharts 圖表產生（工時分佈圓餅圖、趨勢折線圖）
- ❌ PptxGenJS PowerPoint 產生（帶有圖表與圖片的 PPT）
- ❌ 完整季度報告預覽

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 前端框架 | Vue 3 (Composition API) |
| 建構工具 | Vite 6 |
| 語言 | TypeScript |
| UI 元件庫 | Vuetify 3 |
| 測試框架 | Vitest |
| 程式碼風格 | ESLint + Prettier |
| CI/CD | GitHub Actions |
| 部署 | GitHub Pages |
| Excel 解析（未啟用）| xlsx |
| ZIP 解壓（未啟用）| jszip |
| 圖表（未啟用）| ECharts |
| PPT（未啟用）| pptxgenjs |

---

## 本機啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

開啟 http://localhost:5173

---

## 常用指令

```bash
# Lint（程式碼品質檢查）
npm run lint

# Lint 自動修正
npm run lint:fix

# 執行測試
npm run test

# 監聽模式測試
npm run test:watch

# 建構正式版本
npm run build

# 預覽建構結果
npm run preview
```

---

## GitHub Pages 部署

1. 在 GitHub 建立 repository
2. 前往 **Settings → Pages → Source** 選擇 **GitHub Actions**
3. Push 至 `main` 分支即會自動觸發部署
4. 部署完成後，網址為 `https://帳號.github.io/REPOSITORY_NAME/`

> **注意**：`vite.config.ts` 會自動從環境變數 `GITHUB_REPOSITORY` 讀取 repository 名稱作為 base path，不需要手動修改。

---

## 資料只存在瀏覽器記憶體的設計

本系統的所有使用者資料（Excel、ZIP、圖片、計算結果、PowerPoint）：

1. **只存在 JavaScript 記憶體（Vue reactive state）**
2. **不寫入 localStorage / sessionStorage / IndexedDB / Cache Storage**
3. **不上傳至任何伺服器**
4. **重新整理或關閉網頁後，所有資料自動消失**
5. **使用者下載 PPT 後，資料在記憶體中仍然存在，直到頁面關閉或手動清除**

---

## 禁止提交的檔案

以下檔案已在 `.gitignore` 中排除，**絕對不要提交**：

- `*.xlsx` — 真實工時或專案 Excel
- `*.zip` — 真實圖片壓縮檔
- `*.pptx` — 產出的 PowerPoint
- `sample-data/private/` — 私密測試資料
- `private-assets/` — 真實專案圖片

> **提醒**：若需要提交測試用的虛假資料，請使用程式產生的假 File 物件，不要提交真實公司資料。

---

## 如何使用 Chrome DevTools 驗證沒有資料上傳

### Network 分頁

1. 開啟 Chrome DevTools（F12）→ Network
2. 清除紀錄（🚫 按鈕）
3. 選取測試檔案並操作
4. 確認：
   - 沒有 POST/PUT/PATCH/DELETE 請求
   - 沒有連到 google-analytics.com、sentry.io 等第三方
   - 沒有傳送檔案內容的請求

### Application 分頁

1. 開啟 Chrome DevTools → Application
2. 依序檢查 Local Storage、Session Storage、IndexedDB、Cache Storage
3. 確認：選取檔案後，上述儲存空間沒有使用者資料

詳細步驟請參考 [docs/security-verification.md](docs/security-verification.md)。

---

## 已知限制

1. **CSP meta tag**：GitHub Pages 無法設定伺服器 HTTP 標頭，CSP 只能透過 `<meta>` 實作。`frame-ancestors` 等指令不支援 meta CSP。
2. **Vite HMR**：開發模式下，Vite 使用 WebSocket 進行熱更新，可能觸發 CSP 警告，這是預期行為，正式環境不受影響。
3. **大檔案限制**：圖片 ZIP 上限 200 MB，受限於瀏覽器可用記憶體。
4. **瀏覽器相容性**：建議使用 Chrome 110+ 或 Edge 110+，不支援 Internet Explorer。
5. **ZIP metadata 可偽造**：圖片大小檢查依賴 ZIP 中央目錄 metadata，惡意檔案可能填入不實大小。本系統針對企業內部使用，不防護刻意偽造的惡意 ZIP。
6. **JSZip 不驗證 CRC32**：載入階段不驗證 CRC32，CRC 損毀的 ZIP 不會在本階段被偵測。
