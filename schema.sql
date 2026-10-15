-- Desklog: run in Supabase SQL Editor, on a NEW project.
-- No real records or credentials are stored in this repository.
create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  work_date date not null,
  person_name text check (person_name is null or char_length(btrim(person_name)) between 1 and 120),
  site text not null check (site in ('DBP', '120HB', 'D2')),
  unit text not null check (char_length(unit) between 1 and 120),
  category text not null check (category in ('Phần cứng', 'Phần mềm')),
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'Mới tiếp nhận' check (status in ('Mới tiếp nhận', 'Đang xử lý', 'Hoàn thành')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_items_owner_date_idx on public.work_items(owner_id, work_date desc);

alter table public.work_items enable row level security;
revoke all on public.work_items from anon;
revoke all on public.work_items from authenticated;
grant select, insert, update, delete on public.work_items to authenticated;

drop policy if exists "owner_select" on public.work_items;
drop policy if exists "owner_insert" on public.work_items;
drop policy if exists "owner_update" on public.work_items;
drop policy if exists "owner_delete" on public.work_items;
create policy "owner_select" on public.work_items for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "owner_insert" on public.work_items for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "owner_update" on public.work_items for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owner_delete" on public.work_items for delete to authenticated
  using ((select auth.uid()) = owner_id);
