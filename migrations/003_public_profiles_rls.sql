-- ============================================================
-- Stride v2 — Public Profiles: anonymous read access
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
-- Baseline: schema.sql + 002_v2_public_product.sql
--
-- WHY THIS FILE IS LONGER THAN IT LOOKS LIKE IT SHOULD BE
--
-- RLS is row-level, not column-level. A policy decides WHICH ROWS
-- you can see; it says nothing about which COLUMNS. Supabase's
-- bootstrap grants `select` on every table in `public` to the
-- `anon` role, so the moment a permissive policy matches a row,
-- anon can read EVERY column of that row -- including
-- profiles.email and profiles.role.
--
-- A policy of `using (is_public = true)` alone would therefore
-- publish the email address of every user who ever flipped the
-- share toggle, readable in bulk by anyone holding the anon key
-- (which ships in the browser bundle, by design).
--
-- So this migration works in three layers:
--   1. REVOKE the table-wide grant from anon, then GRANT only the
--      named columns back. This is the real enforcement boundary:
--      any column added to profiles in future is closed to anon by
--      default, because grants are per-column and new columns are
--      never auto-granted.
--   2. Policies carry an explicit `to anon` clause. A policy with
--      no `to` clause defaults to `to public`, which silently
--      includes authenticated users too.
--   3. Rows are filtered so anon sees only opted-in profiles, and
--      only the days a person SHOWED UP -- never their absences.
--
-- WHAT BECOMES PUBLIC (for users with is_public = true only):
--   profiles     : full_name, username, bio, employment_type
--   achievements : which badges, and when they unlocked
--   attendance   : the DATES a person showed up, and whether that
--                  was PRESENT / WFH / HALF_DAY
--
-- WHAT STAYS PRIVATE, ALWAYS:
--   profiles.email, profiles.role, profiles.start_date, profiles.id*
--   attendance rows with status LEAVE or ABSENT
--   attendance.notes
--   work_logs -- the entire table. Task text and client names never
--             leave the owner's session.
--
--   *profiles.id is granted because the share page needs it to join
--    achievements and attendance. It is an opaque auth.users UUID,
--    not a secret, and RLS on every other table still gates it.
--
-- Attendance dates are the "GitHub contribution graph" level of
-- detail: it is what makes a public streak verifiable rather than a
-- number you have to take on faith. Absences are excluded so a
-- missing day is indistinguishable from an unlogged one.
-- ============================================================


-- ------------------------------------------------------------
-- 0a. Retire the spider-emoji avatar
--     002 added avatar_emoji with a default of a spider glyph, and
--     the settings page briefly re-purposed it as a monogram. The
--     public profile now derives initials from full_name, so the
--     column has no reader. Dropping the default stops new rows
--     inheriting an emoji nobody renders. The column itself is
--     left in place -- dropping it is not worth the migration risk
--     on data that is already inert.
-- ------------------------------------------------------------
alter table profiles alter column avatar_emoji drop default;


-- ------------------------------------------------------------
-- 0. Case-insensitive username lookup, without LIKE
--
--    /share/PeterParker and /share/peterparker must resolve to the
--    same profile. The obvious fix is `.ilike("username", param)`
--    -- but `_` is a LIKE single-character wildcard and `_` is a
--    legal username character, so `peter_parker` would also match
--    `peterXparker` and could serve the WRONG person's profile.
--    ILIKE also cannot use the lower(username) index.
--
--    A stored generated column removes the whole class of problem:
--    the lookup becomes plain indexed equality.
-- ------------------------------------------------------------
alter table profiles add column if not exists username_lower text
  generated always as (lower(username)) stored;

create unique index if not exists profiles_username_lower_uniq
  on profiles (username_lower)
  where username_lower is not null;

-- Superseded by the index above.
drop index if exists profiles_username_lower_key;


-- ------------------------------------------------------------
-- 1. Profiles — column-scoped anon access
-- ------------------------------------------------------------
revoke select on profiles from anon;

grant select (
  id,
  full_name,
  username,
  username_lower,
  is_public,
  bio,
  employment_type
) on profiles to anon;

drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Anon can read opted-in public profiles"
  on profiles for select
  to anon
  using (is_public = true);


-- ------------------------------------------------------------
-- 2. Achievements — column-scoped anon access
--    user_id is granted because it appears in the query's WHERE
--    clause, and referencing a column requires select on it.
-- ------------------------------------------------------------
revoke select on achievements from anon;

grant select (user_id, code, unlocked_at) on achievements to anon;

drop policy if exists "Public achievements are viewable by everyone" on achievements;
create policy "Anon can read achievements of public profiles"
  on achievements for select
  to anon
  using (
    exists (
      select 1 from profiles p
      where p.id = achievements.user_id
        and p.is_public = true
    )
  );


-- ------------------------------------------------------------
-- 3. Attendance — show-up days only
--    Deliberately NOT exposing notes, and deliberately NOT
--    exposing LEAVE / ABSENT rows.
-- ------------------------------------------------------------
revoke select on attendance from anon;

grant select (user_id, date, status) on attendance to anon;

drop policy if exists "Anon can read show-up days of public profiles" on attendance;
create policy "Anon can read show-up days of public profiles"
  on attendance for select
  to anon
  using (
    status in ('PRESENT', 'WFH', 'HALF_DAY')
    and exists (
      select 1 from profiles p
      where p.id = attendance.user_id
        and p.is_public = true
    )
  );


-- ------------------------------------------------------------
-- 4. Work logs — explicitly closed
--    No anon policy exists, so RLS already denies everything. The
--    revoke is belt-and-braces against a future `grant select on
--    all tables in schema public to anon` run from the dashboard.
-- ------------------------------------------------------------
revoke select on work_logs from anon;


-- ------------------------------------------------------------
-- 5. Verify — run this after the migration and read the output.
--    Expect exactly the granted columns above, and nothing else.
-- ------------------------------------------------------------
-- select table_name, column_name
--   from information_schema.column_privileges
--  where grantee = 'anon'
--    and table_schema = 'public'
--  order by table_name, column_name;
