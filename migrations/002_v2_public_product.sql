-- ============================================================
-- Stride v2 — "public product" migration
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
-- Baseline: schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Broader user types
--    Stride is no longer just for interns and full-timers.
--    SEEKING = the "Yet to be Employed" crowd tracking progress
--    toward a goal. Everyone deserves a streak.
-- ------------------------------------------------------------
alter table profiles drop constraint if exists profiles_employment_type_check;
alter table profiles add constraint profiles_employment_type_check
  check (employment_type in (
    'INTERN', 'FULL_TIME', 'STUDENT', 'FREELANCER', 'SEEKING'
  ));

-- ------------------------------------------------------------
-- 2. Public profile fields (opt-in sharing)
--    is_public defaults to FALSE — nothing becomes visible
--    until a user explicitly turns sharing on.
--    NOTE: the anon read policies/views for /share/[username]
--    ship with the public-profile feature, so that the exact
--    exposed columns can be reviewed on their own. Adding these
--    columns now is inert.
-- ------------------------------------------------------------
alter table profiles add column if not exists username     text;
alter table profiles add column if not exists is_public    boolean not null default false;
alter table profiles add column if not exists bio          text;
alter table profiles add column if not exists avatar_emoji text default '🕷️';

-- Case-insensitive uniqueness: "PeterParker" and "peterparker"
-- must not both exist.
create unique index if not exists profiles_username_lower_key
  on profiles (lower(username))
  where username is not null;

-- Keep usernames URL-safe and human-readable.
alter table profiles drop constraint if exists profiles_username_format_check;
alter table profiles add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-zA-Z0-9_]{3,24}$');

-- ------------------------------------------------------------
-- 3. Achievements
--    Only UNLOCKED achievements are stored. The catalog itself
--    (names, descriptions, thresholds) lives in lib/achievements.ts
--    so adding a badge never needs a migration.
-- ------------------------------------------------------------
create table if not exists achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists achievements_user_id_idx on achievements (user_id);

alter table achievements enable row level security;

-- Owner-only for now (admins can read, matching the other tables).
drop policy if exists "View own achievements or all if admin" on achievements;
create policy "View own achievements or all if admin"
  on achievements for select using (auth.uid() = user_id or is_admin());

drop policy if exists "Insert own achievements" on achievements;
create policy "Insert own achievements"
  on achievements for insert with check (auth.uid() = user_id);

drop policy if exists "Delete own achievements" on achievements;
create policy "Delete own achievements"
  on achievements for delete using (auth.uid() = user_id);
