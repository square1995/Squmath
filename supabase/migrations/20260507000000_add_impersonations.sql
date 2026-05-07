-- Phase 2 Step B-2: 管理者の代理操作(impersonation)機能の追加
-- 詳細は DESIGN.md §3.5、DATA.md §2.7 を参照

create table if not exists public.impersonations (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists impersonations_admin_active_idx
  on public.impersonations (admin_user_id)
  where ended_at is null;

create index if not exists impersonations_target_user_id_idx
  on public.impersonations (target_user_id);

create index if not exists impersonations_started_at_idx
  on public.impersonations (started_at desc);

alter table public.impersonations enable row level security;

-- SELECT: admin だけが全件閲覧可
drop policy if exists "impersonations_select_admin" on public.impersonations;
create policy "impersonations_select_admin"
  on public.impersonations for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  );

-- INSERT / UPDATE は Route Handler の service_role 経由のみ。
-- フロントから直接書かせない設計のため、ポリシーを意図的に作らない。
