# 報修登記系統
提供表單與清單，讓同事登記報修並查閱處理狀態。
雲端任務測試
[報修欄位表與範例資料](文件/報修欄位表.xlsx)

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
