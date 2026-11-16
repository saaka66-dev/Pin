-- 旅遊記帳本示範：建表腳本，供具建表權限的管理者審閱後在 SQL Editor 執行一次。
-- 本腳本用於首次建置，不覆蓋既有資料表；重複執行將報錯並回滾。
-- 先前一般記帳版的 ledger_entries 資料表不受影響，前端已不再使用。
BEGIN;

-- 第一段：建立資料表；識別碼、登記時間與台幣金額由資料庫自動產生。
-- 外幣金額最多兩位小數，負數代表退款（如退稅）或沖銷記錯的紀錄；台幣金額 = round(外幣金額 × 匯率)，前端無法自行指定。
CREATE TABLE public.travel_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    trip_name text NOT NULL,
    expense_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Taipei')::date),
    category text NOT NULL,
    currency text NOT NULL DEFAULT 'TWD',
    amount numeric(14, 2) NOT NULL,
    exchange_rate numeric(12, 6) NOT NULL DEFAULT 1,
    twd_amount bigint GENERATED ALWAYS AS (round(amount * exchange_rate)::bigint) STORED,
    payment_method text NOT NULL,
    note text NOT NULL DEFAULT '',

    -- 第二段：CHECK 限制選項、金額範圍與文字長度。
    CONSTRAINT travel_expenses_trip_name_check
        CHECK (char_length(btrim(trip_name)) BETWEEN 1 AND 50),
    CONSTRAINT travel_expenses_category_check
        CHECK (category IN ('機票', '飯店', '交通', '吃飯', '買東西', '門票', '其他')),
    CONSTRAINT travel_expenses_currency_check
        CHECK (currency IN ('TWD', 'JPY', 'KRW', 'USD', 'EUR', 'THB', 'HKD', 'CNY', 'SGD', 'VND', 'GBP', 'AUD')),
    CONSTRAINT travel_expenses_amount_check
        CHECK (amount <> 0 AND amount BETWEEN -100000000 AND 100000000),
    CONSTRAINT travel_expenses_exchange_rate_check
        CHECK (exchange_rate > 0 AND exchange_rate <= 1000 AND (currency <> 'TWD' OR exchange_rate = 1)),
    CONSTRAINT travel_expenses_twd_amount_check
        CHECK (twd_amount BETWEEN -10000000 AND 10000000),
    CONSTRAINT travel_expenses_payment_method_check
        CHECK (payment_method IN ('現金', '信用卡', '轉帳', '行動支付')),
    CONSTRAINT travel_expenses_expense_date_check
        CHECK (expense_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
    CONSTRAINT travel_expenses_note_check
        CHECK (char_length(note) <= 500)
);

CREATE INDEX travel_expenses_expense_date_idx
    ON public.travel_expenses (expense_date DESC, created_at DESC);

-- 第三段：GRANT 採明確授權；僅 anon 可讀取與新增輸入欄位。
REVOKE ALL PRIVILEGES ON TABLE public.travel_expenses FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.travel_expenses TO anon;
GRANT INSERT (trip_name, expense_date, category, currency, amount, exchange_rate, payment_method, note)
    ON TABLE public.travel_expenses TO anon;
-- 不授予 id、created_at、twd_amount 的新增權限，也不授予 UPDATE、DELETE、TRUNCATE。

-- 第四段：RLS；此示範的「任何人」指使用公開金鑰的未登入 anon 訪客。
ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY travel_expenses_anon_select
    ON public.travel_expenses FOR SELECT TO anon
    USING (true);
CREATE POLICY travel_expenses_anon_insert
    ON public.travel_expenses FOR INSERT TO anon
    WITH CHECK (true);
-- 不建立修改及刪除政策；記錯時新增一筆負數金額沖銷，並於備註說明。

COMMIT;
