# 記帳本
記錄每筆收入與支出，並查看本月收入、支出與結餘。需求請見 `記帳需求筆記.txt`。

[記帳欄位表與範例資料（Excel）](文件/記帳欄位表.xlsx)

> 由報修系統改版而來；原報修的 Word 操作說明與 PowerPoint 提案已移除，記帳版待補。

## 網頁前端

根目錄 `index.html` 為首頁，搭配 `style.css`、`app.js`、`config.js`；不需要建置或 npm 套件。透過 CDN 載入 supabase-js v2，使用公開 publishable key 連線。

本機需要 Python 3，於儲存庫根目錄執行：

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000。需能連線至 cdn.jsdelivr.net 與 Supabase 專案。

- 表單：收支類型（支出／收入）、日期（預設今天，台北時間）、金額（新台幣整數）、類別（依收支類型切換）、付款方式、備註（選填）。登記時間由資料庫產生。
- 本月統計：收入合計、支出合計、結餘，依本月（台北時間）紀錄計算，最多讀取 500 筆；超過時頁面會提示統計可能不完整。
- 本月紀錄：依日期由新到舊，可依「全部／支出／收入」篩選（只在已載入資料中篩選，不另查詢）。
- 不提供修改或刪除；記錯時新增一筆相反紀錄沖銷。

GitHub Pages：在 Settings → Pages 選擇「Deploy from a branch」、`main` 分支及 `/ (root)`。預設網址為 https://saaka66-dev.github.io/Pin/ 。

## Supabase

資料表 `ledger_entries` 的結構、限制與權限在 `supabase/schema.sql`，需由管理者在 Supabase SQL Editor 執行一次（原 `repair_requests` 資料表不受影響，可自行決定是否保留）。

- 啟用 RLS；公開金鑰（anon）僅能讀取與新增，不能修改或刪除。
- anon 只能寫入 `entry_date, entry_type, category, amount, payment_method, note`；`id`、`created_at` 由資料庫產生。
- CHECK 限制收支類型、類別必須與類型相符、金額 1～10,000,000、付款方式選項、備註 500 字內。
- 示範資料公開可讀，請只使用虛構資料。

## PWA 安裝與離線使用

- `manifest.webmanifest`、`pwa.js`、`sw.js` 與 `icons/` 提供安裝與頁面快取，路徑皆為相對路徑，支援 GitHub Pages 的 `/Pin/` 子路徑。
- 離線只能開啟已快取的頁面；記帳資料不快取、不離線儲存、不補送。
- 變更頁面資源時須提升 `sw.js` 的快取版本（目前 v3；沿用舊前綴以清除報修版快取）。

## 驗證紀錄

- `node --check app.js` 通過。
- Chromium 以本機假 Supabase（不連線資料庫）驗證：切換收入／支出時類別選項正確；送出一筆虛構支出，寫入內容只含六個輸入欄位、顯示成功訊息、表單重設；本月統計正確更新；「收入」篩選只顯示收入；390px 寬度無水平捲動。
- 2026-11-16 檢查線上 Supabase：查詢 `ledger_entries` 回傳 `PGRST205`（找不到資料表），表示 `schema.sql` 尚未執行，這是送出失敗的原因。頁面現在會顯示「資料庫尚未建立記帳資料表」的提示。執行 `schema.sql` 後即可新增與讀取。
- 截圖：`docs/ledger-mobile.png`、`docs/ledger-desktop.png`。
