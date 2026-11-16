-- 旅遊記帳本：開放「編輯者」登入後修改與刪除。需在 schema.sql 之後執行一次。
-- 編輯者名單存在 travel_editors，前端與公開金鑰都讀不到；名單內容不放進版本庫，
-- 由管理者另外執行：INSERT INTO public.travel_editors (email) VALUES ('編輯者信箱（小寫）');
BEGIN;

CREATE TABLE public.travel_editors (
    email text PRIMARY KEY CHECK (email = lower(email))
);
ALTER TABLE public.travel_editors ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.travel_editors FROM PUBLIC, anon, authenticated;
-- 不建立任何政策：anon 與 authenticated 都無法讀寫名單。

-- 目前登入者的信箱是否在編輯者名單內；SECURITY DEFINER 才能讀取名單。
CREATE FUNCTION public.is_travel_editor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.travel_editors
        WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;
REVOKE ALL ON FUNCTION public.is_travel_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_travel_editor() TO authenticated;

-- 登入後的 authenticated 角色：與 anon 相同可讀取、新增；另可修改輸入欄位與刪除。
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.travel_expenses TO authenticated;
GRANT INSERT (trip_name, expense_date, category, currency, amount, exchange_rate, payment_method, note)
    ON TABLE public.travel_expenses TO authenticated;
GRANT UPDATE (trip_name, expense_date, category, currency, amount, exchange_rate, payment_method, note)
    ON TABLE public.travel_expenses TO authenticated;
GRANT DELETE ON TABLE public.travel_expenses TO authenticated;

CREATE POLICY travel_expenses_authenticated_select
    ON public.travel_expenses FOR SELECT TO authenticated
    USING (true);
CREATE POLICY travel_expenses_authenticated_insert
    ON public.travel_expenses FOR INSERT TO authenticated
    WITH CHECK (true);
-- 修改與刪除只限編輯者名單內的帳號；其他登入者的請求不會影響任何資料列。
CREATE POLICY travel_expenses_editor_update
    ON public.travel_expenses FOR UPDATE TO authenticated
    USING ((SELECT public.is_travel_editor()))
    WITH CHECK ((SELECT public.is_travel_editor()));
CREATE POLICY travel_expenses_editor_delete
    ON public.travel_expenses FOR DELETE TO authenticated
    USING ((SELECT public.is_travel_editor()));

COMMIT;
