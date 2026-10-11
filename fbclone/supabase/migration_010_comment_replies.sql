-- ============================================================
-- FaceClone migration 010: comment replies + comment reactions
-- - comments.parent_id for threaded replies
-- - comment_reactions table (7 types, one per user per comment)
-- Run once.
-- ============================================================

alter table comments add column if not exists parent_id uuid references comments(id) on delete cascade;
create index if not exists idx_comments_parent on comments(parent_id);

create table if not exists comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('like','love','haha','wow','sad','angry','care')),
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

alter table comment_reactions enable row level security;

drop policy if exists "crx: public read" on comment_reactions;
create policy "crx: public read" on comment_reactions for select using (true);

drop policy if exists "crx: owner manage" on comment_reactions;
create policy "crx: owner manage" on comment_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_crx_comment on comment_reactions(comment_id);

alter publication supabase_realtime add table comment_reactions;
