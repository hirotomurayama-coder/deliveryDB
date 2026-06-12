-- デリバリー管理ダッシュボード 初期スキーマ（適用済み: delivery-dashboard / initial_schema）
create table members (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_sales boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id bigint primary key, -- 既存スプレッドシートの管理番号を踏襲
  name text not null,
  abbreviation text,
  status text,            -- 支援中 / 休眠 / 支援外
  category text,          -- プライム / スタンダード / 未上場 など
  industry text,
  created_at timestamptz not null default now()
);

create table menus (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table projects (
  id bigint primary key, -- 既存スプレッドシートの案件IDを踏襲
  client_id bigint references clients(id),
  client_name text not null, -- 顧客ID未連携(#N/A)の案件のための生値
  status text not null default '不明', -- 実施中 / 開始前 / 案件終了 / 社内クロージング中 / 取り消し
  consulting_type text,   -- ハンズオン / アドバイザリー / 月額 / スポット / レビュー / なし
  amount_jpy bigint,
  start_date date,
  end_date date,
  support_months int,
  pm_name text,
  sales_name text,
  notes text,
  contract_url text,
  created_at timestamptz not null default now()
);

create table project_menus (
  project_id bigint not null references projects(id) on delete cascade,
  menu_id bigint not null references menus(id),
  primary key (project_id, menu_id)
);

create table assignments (
  id bigint generated always as identity primary key,
  project_id bigint not null references projects(id) on delete cascade,
  member_id bigint not null references members(id),
  role text not null check (role in ('PM','Main','Sub','Review','Support','PM/Main')),
  unique (project_id, member_id, role)
);

create table skills (
  member_id bigint not null references members(id) on delete cascade,
  menu_id bigint not null references menus(id) on delete cascade,
  level text not null check (level in ('main','sub')), -- main=メイン以上可, sub=サブ可
  primary key (member_id, menu_id)
);

create index idx_projects_status on projects(status);
create index idx_projects_end_date on projects(end_date);
create index idx_assignments_member on assignments(member_id);
create index idx_assignments_project on assignments(project_id);

-- RLS: rechroma.co.jp ドメインの認証済みユーザーのみアクセス可
create or replace function public.is_internal_user()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@rechroma.co.jp'
$$;

alter table members enable row level security;
alter table clients enable row level security;
alter table menus enable row level security;
alter table projects enable row level security;
alter table project_menus enable row level security;
alter table assignments enable row level security;
alter table skills enable row level security;

create policy internal_all_members on members for all using (public.is_internal_user()) with check (public.is_internal_user());
create policy internal_all_clients on clients for all using (public.is_internal_user()) with check (public.is_internal_user());
create policy internal_all_menus on menus for all using (public.is_internal_user()) with check (public.is_internal_user());
create policy internal_all_projects on projects for all using (public.is_internal_user()) with check (public.is_internal_user());
create policy internal_all_project_menus on project_menus for all using (public.is_internal_user()) with check (public.is_internal_user());
create policy internal_all_assignments on assignments for all using (public.is_internal_user()) with check (public.is_internal_user());
create policy internal_all_skills on skills for all using (public.is_internal_user()) with check (public.is_internal_user());
