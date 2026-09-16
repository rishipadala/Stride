-- ============================================================
-- Stride — add HOLIDAY attendance status
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
-- Baseline: schema.sql
-- ============================================================

-- The existing CHECK constraint on attendance.status only allows
-- PRESENT, HALF_DAY, WFH, LEAVE, ABSENT.  HOLIDAY is a new status
-- that lets users mark public holidays (Ganesh Chaturthi, etc.)
-- so that the day doesn't break their streak.
alter table attendance drop constraint if exists attendance_status_check;
alter table attendance add constraint attendance_status_check
  check (status in ('PRESENT','HALF_DAY','WFH','LEAVE','ABSENT','HOLIDAY'));
