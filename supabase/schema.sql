-- 記帳系統示範：僅產生建表腳本，不會自動執行；供具建表權限的管理者審閱後使用。
-- 本腳本用於首次建置，不覆蓋既有資料表；重複執行將報錯並回滾。
BEGIN;

-- 第一段：建立資料表；識別碼及登記時間由資料庫自動產生。
-- 金額以新台幣整數儲存，避免浮點誤差；備註為選填。
CREATE TABLE public.ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    entry_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Taipei')::date),
    entry_type text NOT NULL,
    category text NOT NULL,
    amount integer NOT NULL,
    payment_method text NOT NULL,
    note text NOT NULL DEFAULT '',

    -- 第二段：CHECK 限制選項、金額範圍與文字長度；類別必須與收支類型相符。
    CONSTRAINT ledger_entries_entry_type_check
        CHECK (entry_type IN ('收入', '支出')),
    CONSTRAINT ledger_entries_category_check
        CHECK ((entry_type = '支出' AND category IN ('餐飲', '交通', '購物', '居住', '娛樂', '醫療', '其他'))
            OR (entry_type = '收入' AND category IN ('薪資', '獎金', '投資', '其他'))),
    CONSTRAINT ledger_entries_amount_check
        CHECK (amount > 0 AND amount <= 10000000),
    CONSTRAINT ledger_entries_payment_method_check
        CHECK (payment_method IN ('現金', '信用卡', '轉帳', '行動支付')),
    CONSTRAINT ledger_entries_entry_date_check
        CHECK (entry_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
    CONSTRAINT ledger_entries_note_check
        CHECK (char_length(note) <= 500)
);

CREATE INDEX ledger_entries_entry_date_idx
    ON public.ledger_entries (entry_date DESC, created_at DESC);

-- 第三段：GRANT 採明確授權；先移除一般角色可能由預設權限取得的資料表權限。
-- 僅 anon 可讀取與新增輸入欄位；不授權 authenticated、PUBLIC 修改或刪除。
REVOKE ALL PRIVILEGES ON TABLE public.ledger_entries FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.ledger_entries TO anon;
GRANT INSERT (entry_date, entry_type, category, amount, payment_method, note)
    ON TABLE public.ledger_entries TO anon;
-- 不授予 id、created_at 的新增權限，前端應省略這兩欄以使用資料庫預設值。
-- 不授予 UPDATE、DELETE、TRUNCATE 等權限；UUID 不需要另行授權序列。

-- 第四段：RLS 再限制資料列；此示範的「任何人」指使用公開金鑰的未登入 anon 訪客。
-- 登入後的 authenticated 角色未獲授權；管理者與可繞過 RLS 的角色另須保護憑證。
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_entries_anon_select
    ON public.ledger_entries FOR SELECT TO anon
    USING (true);
CREATE POLICY ledger_entries_anon_insert
    ON public.ledger_entries FOR INSERT TO anon
    WITH CHECK (true);
-- 不建立修改及刪除政策；記錯時以相反的收支紀錄沖銷。

-- 第五段：原子化完成建表、限制及授權，避免只有部分安全設定成功。
COMMIT;

-- 第六段：通知 Supabase API 重新讀取資料表結構，建表後網頁即可立即使用。
NOTIFY pgrst, 'reload schema';
