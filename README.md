# 旅遊記帳本
記錄旅途中的機票、飯店、交通、吃飯、買東西等花費，外幣依匯率自動換算新台幣，並依旅程查看總花費與各類別占比。需求請見 `記帳需求筆記.txt`。

> 由一般記帳本（收入／支出）改版而來。`文件/記帳欄位表.xlsx` 仍是舊版欄位，待更新。

## 網頁前端

根目錄 `index.html` 為首頁，搭配 `style.css`、`app.js`、`config.js`；不需要建置或 npm 套件。透過 CDN 載入 supabase-js v2，使用公開 publishable key 連線。

本機需要 Python 3，於儲存庫根目錄執行：

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000。需能連線至 cdn.jsdelivr.net 與 Supabase 專案。

- 表單：旅程名稱（可從已有旅程挑選）、類別（機票、飯店、交通、吃飯、買東西、門票、其他）、日期（預設今天，台北時間）、付款方式、幣別（新台幣、日圓、韓元、美元等 12 種）、金額（可到小數兩位）、匯率（外幣時必填，自動帶入該幣別上一筆的匯率）、備註（選填）。表單即時顯示「約合新台幣」。
- 台幣金額由資料庫以 `round(金額 × 匯率)` 產生，前端無法指定；登記時間亦由資料庫產生。
- 旅程統計：可切換旅程或「全部旅程」，顯示總花費、筆數、平均每天（第一筆到最後一筆日期的天數）與各類別花費長條圖。最多讀取最新 1,000 筆，超過時頁面會提示。
- 花費紀錄：依日期由新到舊，可依類別篩選；外幣紀錄顯示原幣金額與匯率。
- 每筆紀錄有「編輯」與「刪除」，**不需登入**即可使用：編輯沿用上方表單，刪除前會再確認。任何知道網址的人都能修改或刪除，網址請只分享給自己人。（先前的 Email 登入功能已隱藏，程式保留。）
- 退款（如退稅）可輸入負數金額。
- 有新版本時頁面上方顯示「立即更新」，按下即換成新版（手機與電腦都適用）。

GitHub Pages：在 Settings → Pages 選擇「Deploy from a branch」、`main` 分支及 `/ (root)`。預設網址為 https://saaka66-dev.github.io/Pin/ 。

## Supabase

資料表 `travel_expenses` 的結構、限制與權限在 `supabase/schema.sql`，需由管理者在 Supabase SQL Editor 執行一次。舊版 `ledger_entries` 資料表不受影響，前端已不使用。

- 啟用 RLS。
- `supabase/public_edit.sql`（最後執行，已套用）：依使用者決定開放 anon 修改輸入欄位與刪除；`twd_amount` 仍由資料庫產生。
- `supabase/edit_permissions.sql`（在 `schema.sql` 之後執行）：建立編輯者名單 `travel_editors` 與函式 `is_travel_editor()`；登入者（authenticated）可讀取、新增，只有信箱在名單內的帳號能修改輸入欄位與刪除。名單前端讀不到，內容不放進版本庫，由管理者以 `INSERT INTO public.travel_editors (email) VALUES ('信箱')` 加入。
- 編輯者帳號：使用者在網頁登入區輸入 Email 與自訂密碼按「建立帳號」（Supabase signUp），再由管理者啟用（確認信或 SQL 設定 `email_confirmed_at`）；也可在 Supabase 後台 Authentication → Users → Add user 建立（勾選 Auto Confirm User）。只有信箱在 `travel_editors` 名單內的帳號能修改或刪除。
- anon 只能寫入 `trip_name, expense_date, category, currency, amount, exchange_rate, payment_method, note`；`id`、`created_at`、`twd_amount` 由資料庫產生。
- CHECK 限制：旅程名稱 1～50 字、類別與幣別選項、金額不為 0 且在 ±100,000,000 內、匯率 0～1,000 且新台幣必須為 1、換算台幣在 ±10,000,000 內、付款方式選項、備註 500 字內。
- 示範資料公開可讀，請只使用虛構資料。
- 免費方案專案約 7 天未使用會自動暫停，網頁會無法載入。`.github/workflows/keep-supabase-awake.yml` 每 3 天以公開金鑰讀取 1 筆資料保持啟用（須在 `main` 分支才會依排程執行）；若仍被暫停，到 Supabase 後台按 Restore project。2026-11-26 曾因暫停無法載入，恢復後資料完整。

## PWA 安裝與離線使用

- `manifest.webmanifest`、`pwa.js`、`sw.js` 與 `icons/` 提供安裝與頁面快取，路徑皆為相對路徑，支援 GitHub Pages 的 `/Pin/` 子路徑。
- 離線只能開啟已快取的頁面；記帳資料不快取、不離線儲存、不補送。
- 變更頁面資源時須提升 `sw.js` 的快取版本（目前 v2；沿用舊前綴以清除報修版快取）。

## 驗證紀錄

- `node --check app.js` 通過。
- 2026-11-16 已於實際 Supabase 專案執行 `schema.sql`（RLS 已啟用）。
- Chromium 連線實際 Supabase，於旅程「測試 東京五日遊（虛構）」新增三筆虛構花費：機票 NT$15,800、飯店 JPY 36,000 × 0.21 = NT$7,560、吃飯 JPY 1,280（匯率自動帶入 0.21）= NT$269；總花費 NT$23,629、3 筆、各類別占比正確；「飯店」篩選只顯示 1 筆；390px 寬度無水平捲動；無主控台錯誤。
- 以公開金鑰驗證：修改與刪除皆被拒（permission denied）；指定 `twd_amount` 被拒（generated column）；新台幣匯率非 1 被 CHECK 擋下。上述三筆測試資料之後已由管理者刪除。
- 截圖：`docs/travel-mobile.png`、`docs/travel-desktop.png`、`docs/travel-edit-list.png`。
- 編輯權限（2026-11-16，於實際資料庫以交易測試後回滾）：名單內帳號可修改、刪除；名單外的登入者修改、刪除皆影響 0 筆；登入者讀不到名單；anon 無法呼叫 `is_travel_editor()`、無法刪除。
- 編輯畫面以 Chromium 模擬登入與資料（不連線資料庫）驗證：未登入不顯示按鈕；登入後編輯會帶入原值、送出 PATCH 只含八個輸入欄位、統計更新；刪除確認後送出 DELETE；取消編輯恢復新增模式；登出後按鈕消失；390px 無水平捲動。
