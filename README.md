# 報修登記系統
提供表單與清單，讓同事登記報修並查閱處理狀態。
雲端任務測試
[報修欄位表與範例資料](文件/報修欄位表.xlsx)

[報修系統操作說明（Word）](文件/報修系統操作說明.docx)

[報修登記系統提案（PowerPoint）](文件/報修登記系統提案.pptx)

## 網頁前端

根目錄 `index.html` 為首頁，搭配 `style.css`、`app.js`、`config.js`；不需要建置或 npm 套件。透過 CDN 載入 supabase-js v2，使用公開 publishable key 連線。

本機需要 Python 3，於儲存庫根目錄執行：

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000。需能連線至 cdn.jsdelivr.net 與 Supabase 專案。資料表欄位與權限請參考 `supabase/schema.sql`；管理者應先確認目標專案已套用該結構及 RLS。前端只新增五個輸入欄位，由資料庫產生 id、created_at 與預設 status，不提供修改或刪除操作。

GitHub Pages：在 Settings → Pages 選擇「Deploy from a branch」、`main` 分支及 `/ (root)`。預設網址為 https://saaka66-dev.github.io/Pin/ 。

手動驗證：以虛構姓名及地點提交，確認成功訊息、表單清空、清單新增及系統時間；切斷網路驗證錯誤訊息與保留輸入；於手機寬度確認無水平捲動。公開訪客應僅能新增與讀取，無法修改或刪除，須在實際 Supabase 環境驗證。

### 本次驗證紀錄

- `node --check app.js`、`node --check config.js` 與 `git diff --check` 通過。
- Chromium 390px 手機版無水平溢出；實際操作虛構資料送出，確認網路失敗時顯示錯誤並保留輸入。
- Cloud 網路政策封鎖本專案 Supabase 網域（CONNECT 403），因此未成功新增線上測試資料，亦未驗證實際資料庫 RLS、成功送出與讀取排序。既有 SQL 已包含 RLS 及禁止公開修改／刪除授權，本次未更動 SQL。
- 截圖：`docs/repair-mobile.png`、`docs/repair-desktop.png`。截圖使用由實際 CDN 下載的 SDK，由本機提供給瀏覽器以避免瀏覽器的 CDN 連線問題；Supabase 請求未模擬。


### 清單緊急程度篩選

- 清單上方提供「全部／高／中／低」，預設「全部」；深綠底白字代表目前選取，並以 `aria-pressed` 提供輔助技術辨識。
- 篩選僅在瀏覽器已載入的最近 20 筆紀錄中進行，不會額外查詢 Supabase，也不代表所有歷史資料。重新整理或送出成功後仍保留目前篩選。
- 高緊急報修的標籤改為紅底白字；沒有符合項目時顯示提示。
- 本次只修改網頁與說明文件，未變更資料庫、欄位、權限、`config.js` 或 `supabase/`。
- 手機確認：開啟此分支的本機網頁，捲到「最近報修」，依序點選四個按鈕，確認選取樣式、對應紀錄、高緊急紅色標籤及無符合紀錄提示；回到「全部」應恢復原清單。按鈕切換不應新增網路請求。PR 尚未合併前，GitHub Pages 仍顯示 main 版本。
- 驗證：使用本機虛構清單（不連線資料庫）檢查「全部→高→中→低→全部」、無符合項目提示與選取狀態；切換過程讀取次數維持 1 次，390px 寬度無水平溢出，高標籤為紅底白字。`node --check app.js` 與 `git diff --check` 通過。手機截圖：`docs/urgency-filter-mobile.png`。

## PWA 安裝與離線使用

- 以 HTTPS 開啟 GitHub Pages；Android Chrome 可使用瀏覽器的「安裝應用程式／加到主畫面」，符合瀏覽器條件時頁面也會出現安裝按鈕。iPhone Safari 使用「分享 → 加入主畫面」。安裝後可從主畫面以獨立視窗開啟；實際選單名稱依裝置版本而異。
- `manifest.webmanifest`、`pwa.js`、`sw.js` 與 `icons/` 提供安裝資訊及頁面快取。所有路徑皆相對於網站，支援 GitHub Pages 的 `/Pin/` 子路徑。需要至少成功連線開啟一次，完成 Service Worker 安裝後，才可離線開啟。
- 離線僅提供已快取的頁面；Supabase 報修內容不快取、不離線儲存、不排程補送。填寫內容只存在目前頁面，關閉或重新載入會遺失。清單與送出仍需網路；CDN SDK 若尚未快取，會顯示服務初始化失敗。
- 更新時會提示使用者完成填寫後關閉所有報修頁面再開啟，避免更新中丟失表單。維護時變更頁面資源，必須同步提升 `sw.js` 的快取版本；快取只清理此應用程式自己的舊版本。
- 本機以 `python3 -m http.server 8000` 啟動，開啟 localhost（安全來源例外）。確認 manifest、圖示及 Service Worker 正常後，切換瀏覽器離線並重開頁面，應可看到頁面與離線提示；送出不能成功，內容不會自動補送。再連線可重新整理清單。資料庫、欄位及 RLS 未更動。
- 本次驗證：Chromium 一般使用者設定檔的 manifest 及安裝條件檢查均無錯誤；在 `/Pin/` 下確認 Service Worker 範圍與靜態快取，離線重新載入、離線阻擋送出及保留目前輸入、恢復連線提示消失、390px 無水平溢出。截圖為 `docs/pwa-offline-mobile.png`。CDN 在測試環境不可用，亦確認缺少 SDK 時仍可開啟頁面並明示未送出。尚未在實體 Android／iPhone 完成安裝驗證；線上 Supabase 成功寫入及 RLS 驗證仍待確認。
