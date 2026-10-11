-- ============================================================
-- FaceClone migration 004: post extensions + saved posts
-- Run once in Supabase SQL Editor
-- ============================================================

alter table posts add column if not exists feeling text;
alter table posts add column if not exists video_url text;
alter table posts add column if not exists group_id uuid;

create table if not exists saved_posts (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (user_id, post_id)
);

alter table saved_posts enable row level security;

drop policy if exists "saved: owner read" on saved_posts;
create policy "saved: owner read" on saved_posts for select
  using (user_id = auth.uid());

drop policy if exists "saved: owner insert" on saved_posts;
create policy "saved: owner insert" on saved_posts for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

drop policy if exists "saved: owner delete" on saved_posts;
create policy "saved: owner delete" on saved_posts for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table saved_posts;
