-- 旅遊記帳本：依使用者決定，開放「不登入」直接修改與刪除。需在 schema.sql、edit_permissions.sql 之後執行。
-- 影響：任何知道網址、持有公開金鑰的人都能修改或刪除任一筆紀錄，刪除無法復原。
-- 台幣金額（twd_amount）、識別碼與登記時間仍由資料庫產生，無法由前端指定。
BEGIN;

GRANT UPDATE (trip_name, expense_date, category, currency, amount, exchange_rate, payment_method, note)
    ON TABLE public.travel_expenses TO anon;
GRANT DELETE ON TABLE public.travel_expenses TO anon;

CREATE POLICY travel_expenses_anon_update
    ON public.travel_expenses FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);
CREATE POLICY travel_expenses_anon_delete
    ON public.travel_expenses FOR DELETE TO anon
    USING (true);

COMMIT;
