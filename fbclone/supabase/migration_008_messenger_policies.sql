-- ============================================================
-- FaceClone migration 008: (re)create messenger RLS policies
-- Ensures all policies exist (idempotent). Run once.
-- ============================================================

-- conversations
drop policy if exists "conv: participant read" on conversations;
create policy "conv: participant read" on conversations for select
  using (exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  ));
drop policy if exists "conv: authenticated insert" on conversations;
create policy "conv: authenticated insert" on conversations for insert
  with check (auth.role() = 'authenticated');

-- conversation_participants
drop policy if exists "cp: owner read" on conversation_participants;
create policy "cp: owner read" on conversation_participants for select
  using (user_id = auth.uid());
drop policy if exists "cp: participant insert" on conversation_participants;
create policy "cp: participant insert" on conversation_participants for insert
  with check (
    auth.role() = 'authenticated' and (
      user_id = auth.uid()
      or conversation_id in (
        select conversation_id from conversation_participants where user_id = auth.uid()
      )
    )
  );
drop policy if exists "cp: owner update" on conversation_participants;
create policy "cp: owner update" on conversation_participants for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages
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
