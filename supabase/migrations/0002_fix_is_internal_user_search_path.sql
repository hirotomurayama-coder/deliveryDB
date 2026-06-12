-- Supabaseセキュリティアドバイザリ対応: search_path を固定（function_search_path_mutable）
create or replace function public.is_internal_user()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@rechroma.co.jp'
$$;
