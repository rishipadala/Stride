-- ============================================================
-- WorkLog Schema
-- Run this entire file in Supabase SQL Editor (once only)
-- ============================================================

-- profiles: extends auth.users with app-specific fields
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null,
  email           text not null,
  role            text not null default 'EMPLOYEE'
                    check (role in ('EMPLOYEE', 'ADMIN')),
  employment_type text check (employment_type in ('INTERN', 'FULL_TIME')),
  start_date      date,
  created_at      timestamptz default now()
);

alter table profiles enable row level security;

-- IMPORTANT: security definer avoids infinite recursion on profiles RLS
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'ADMIN'
  );
$$;

create policy "Users can view own profile or admins can view all"
  on profiles for select
  using (auth.uid() = id or is_admin());

create policy "Users can insert own profile during onboarding"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile or admins can update any"
  on profiles for update
  using (auth.uid() = id or is_admin());

-- attendance table
create table if not exists attendance (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) not null,
  date       date not null,
  status     text not null check (status in ('PRESENT','HALF_DAY','WFH','LEAVE','ABSENT')),
  notes      text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

alter table attendance enable row level security;

create policy "View own attendance or all if admin"
  on attendance for select using (auth.uid() = user_id or is_admin());
create policy "Insert own attendance"
  on attendance for insert with check (auth.uid() = user_id);
create policy "Update own attendance"
  on attendance for update using (auth.uid() = user_id);
create policy "Delete own attendance"
  on attendance for delete using (auth.uid() = user_id);

-- work_logs table
create table if not exists work_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) not null,
  date              date not null,
  task              text not null,
  client_or_project text,
  status            text not null check (status in ('DONE','IN_PROGRESS','WAITING_ON_CLIENT','TO_IMPLEMENT','BLOCKED')),
  created_at        timestamptz default now()
);

alter table work_logs enable row level security;

create policy "View own work logs or all if admin"
  on work_logs for select using (auth.uid() = user_id or is_admin());
create policy "Insert own work logs"
  on work_logs for insert with check (auth.uid() = user_id);
create policy "Update own work logs"
  on work_logs for update using (auth.uid() = user_id);
create policy "Delete own work logs"
  on work_logs for delete using (auth.uid() = user_id);
