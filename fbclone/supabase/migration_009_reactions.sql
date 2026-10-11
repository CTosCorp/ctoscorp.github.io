-- ============================================================
-- FaceClone migration 009: Facebook-style reactions
-- Replaces the likes table with a reactions table
-- (like/love/haha/wow/sad/angry/care), one per user per post.
-- Run once.
-- ============================================================

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('like','love','haha','wow','sad','angry','care')),
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table reactions enable row level security;

drop policy if exists "rx: public read" on reactions;
create policy "rx: public read" on reactions for select using (true);

drop policy if exists "rx: owner manage" on reactions;
create policy "rx: owner manage" on reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_reactions_post on reactions(post_id);
create index if not exists idx_reactions_user on reactions(user_id);

-- migrate existing likes -> reactions(type='like')
insert into reactions (post_id, user_id, type, created_at)
select post_id, user_id, 'like', created_at from likes
on conflict (post_id, user_id) do nothing;

-- realtime
alter publication supabase_realtime add table reactions;

-- retire the old likes table (data already migrated)
alter publication supabase_realtime drop table if exists likes;
drop table if exists likes;
