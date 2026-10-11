-- ============================================================
-- FaceClone migration 003: stories (24-hour, FB-style)
-- Run once in Supabase SQL Editor AFTER schema.sql
-- ============================================================

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null constraint stories_author_fk references profiles(id) on delete cascade,
  image_url text,
  text text default '',
  bg text,
  created_at timestamptz default now() not null,
  expires_at timestamptz default now() + interval '24 hours' not null
);

alter table stories enable row level security;

drop policy if exists "stories: public read" on stories;
create policy "stories: public read" on stories for select
  using (expires_at > now());

drop policy if exists "stories: author insert" on stories;
create policy "stories: author insert" on stories for insert
  with check (auth.role() = 'authenticated' and author_id = auth.uid());

drop policy if exists "stories: author delete" on stories;
create policy "stories: author delete" on stories for delete
  using (author_id = auth.uid() or is_admin());

alter publication supabase_realtime add table stories;
