-- ============================================================
-- FaceClone migration 007: allow 1-1 conversation creation
-- Lets a user insert the *other* participant row when creating
-- a conversation they themselves participate in.
-- Run once in Supabase SQL Editor AFTER 005.
-- ============================================================

drop policy if exists "cp: owner insert" on conversation_participants;

create policy "cp: participant insert" on conversation_participants for insert
  with check (
    auth.role() = 'authenticated' and (
      user_id = auth.uid()
      or conversation_id in (
        select conversation_id from conversation_participants where user_id = auth.uid()
      )
    )
  );
