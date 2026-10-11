-- ============================================================
-- FaceClone migration 005: messenger (1-1 realtime chat)
-- Run once in Supabase SQL Editor
-- ============================================================

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null
);

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz default now() not null,
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now() not null
);

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

-- conversations: visible to participants
drop policy if exists "conv: participant read" on conversations;
create policy "conv: participant read" on conversations for select
  using (exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  ));
drop policy if exists "conv: authenticated insert" on conversations;
create policy "conv: authenticated insert" on conversations for insert
  with check (auth.role() = 'authenticated');

-- participants: own rows
drop policy if exists "cp: owner read" on conversation_participants;
create policy "cp: owner read" on conversation_participants for select
  using (user_id = auth.uid());
drop policy if exists "cp: owner insert" on conversation_participants;
create policy "cp: owner insert" on conversation_participants for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());
drop policy if exists "cp: owner update" on conversation_participants;
create policy "cp: owner update" on conversation_participants for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages: participants read; sender must be participant
drop policy if exists "msg: participant read" on messages;
create policy "msg: participant read" on messages for select
  using (exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  ));
drop policy if exists "msg: sender insert" on messages;
create policy "msg: sender insert" on messages for insert
  with check (
    auth.role() = 'authenticated' and sender_id = auth.uid()
    and exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table conversation_participants;
alter publication supabase_realtime add table messages;
