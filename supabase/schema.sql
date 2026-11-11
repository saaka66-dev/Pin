-- 報修登記示範：僅產生建表腳本，不會自動執行；供具建表權限的管理者審閱後使用。
-- 本腳本用於首次建置，不覆蓋既有資料表；重複執行將報錯並回滾。
BEGIN;

-- 第一段：建立資料表；識別碼及建立時間由資料庫自動產生，所有業務欄位皆必填。
-- 文字長度為本次設計上限：姓名 100 字、地點 200 字、問題說明 5000 字，正式需求仍待確認。
CREATE TABLE public.repair_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    reporter_name text NOT NULL,
    location text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    urgency text NOT NULL DEFAULT '中',
    status text NOT NULL DEFAULT '待處理',

    -- 第二段：CHECK 限制選項及文字長度；至少須含一個非空白字元，原始文字不得超出上限。
    CONSTRAINT repair_requests_reporter_name_check
        CHECK (char_length(reporter_name) <= 100 AND reporter_name ~ '[^[:space:]]'),
    CONSTRAINT repair_requests_location_check
        CHECK (char_length(location) <= 200 AND location ~ '[^[:space:]]'),
    CONSTRAINT repair_requests_description_check
        CHECK (char_length(description) <= 5000 AND description ~ '[^[:space:]]'),
    CONSTRAINT repair_requests_category_check
        CHECK (category IN ('設備', '網路', '環境', '其他')),
    CONSTRAINT repair_requests_urgency_check
        CHECK (urgency IN ('低', '中', '高')),
    CONSTRAINT repair_requests_status_check
        CHECK (status IN ('待處理', '處理中', '已完成'))
);

-- 第三段：GRANT 採明確授權；先移除一般角色可能由預設權限取得的資料表權限。
-- 僅 anon 可讀取清單與新增輸入欄位；不授權 authenticated、PUBLIC 修改或刪除。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.repair_requests TO anon;
GRANT INSERT (reporter_name, location, category, description, urgency)
    ON TABLE public.repair_requests TO anon;
-- 不授予 id、created_at、status 的新增權限，前端應省略這三欄以使用資料庫預設值。
-- 不授予 UPDATE、DELETE、TRUNCATE 等權限；UUID 不需要另行授權序列。

-- 第四段：RLS 再限制資料列；此示範的「任何人」指使用公開金鑰的未登入 anon 訪客。
-- 登入後的 authenticated 角色未獲授權；管理者與可繞過 RLS 的角色另須保護憑證。
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY repair_requests_anon_select
    ON public.repair_requests FOR SELECT TO anon
    USING (true);
CREATE POLICY repair_requests_anon_insert
    ON public.repair_requests FOR INSERT TO anon
    WITH CHECK (status = '待處理');
-- 不建立修改及刪除政策；即使日後擴增新增欄位權限，RLS 仍要求新資料的狀態為待處理。

-- 第五段：原子化完成建表、限制及授權，避免只有部分安全設定成功。
COMMIT;
