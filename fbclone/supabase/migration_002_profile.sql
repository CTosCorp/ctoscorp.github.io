-- ============================================================
-- FaceClone migration 002: full profile features
-- Adds: avatar_url, cover_url, birthday, thought
-- Run once in Supabase SQL Editor AFTER schema.sql
-- ============================================================

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists cover_url text;
alter table profiles add column if not exists birthday date;
alter table profiles add column if not exists thought varchar(120) default '';

-- RLS: existing "profiles: owner or admin update" policy already
-- covers the new columns (no policy change needed).
-- New columns are readable via the existing public-read policy.
