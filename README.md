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
