-- ============================================================
-- FaceClone migration 006: marketplace, events, groups
-- Run once in Supabase SQL Editor
-- ============================================================

-- ---------- Marketplace listings ----------
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  price numeric not null default 0,
  description text default '',
  image_url text,
  sold boolean default false not null,
  created_at timestamptz default now() not null
);

-- ---------- Events ----------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text default '',
  location text default '',
  starts_at timestamptz not null,
  image_url text,
  created_at timestamptz default now() not null
);

create table if not exists event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('interested', 'going')),
  primary key (event_id, user_id)
);

-- ---------- Groups ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text default '',
  cover_url text,
  created_at timestamptz default now() not null
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

-- posts.group_id FK (column added in 004)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_group_fk') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_group_fk
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------- RLS ----------
alter table listings enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;

-- listings
drop policy if exists "listings: public read" on listings;
create policy "listings: public read" on listings for select using (true);
drop policy if exists "listings: seller insert" on listings;
create policy "listings: seller insert" on listings for insert
  with check (auth.role() = 'authenticated' and seller_id = auth.uid());
drop policy if exists "listings: seller update" on listings;
create policy "listings: seller update" on listings for update
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists "listings: seller delete" on listings;
create policy "listings: seller delete" on listings for delete
  using (seller_id = auth.uid());

-- events
drop policy if exists "events: public read" on events;
create policy "events: public read" on events for select using (true);
drop policy if exists "events: creator insert" on events;
create policy "events: creator insert" on events for insert
  with check (auth.role() = 'authenticated' and creator_id = auth.uid());
drop policy if exists "events: creator update" on events;
create policy "events: creator update" on events for update
  using (creator_id = auth.uid() or is_admin()) with check (creator_id = auth.uid() or is_admin());
drop policy if exists "events: creator delete" on events;
create policy "events: creator delete" on events for delete
  using (creator_id = auth.uid() or is_admin());

-- event_rsvps
drop policy if exists "rsvp: public read" on event_rsvps;
create policy "rsvp: public read" on event_rsvps for select using (true);
drop policy if exists "rsvp: owner write" on event_rsvps;
create policy "rsvp: owner write" on event_rsvps for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());
drop policy if exists "rsvp: owner update" on event_rsvps;
create policy "rsvp: owner update" on event_rsvps for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "rsvp: owner delete" on event_rsvps;
create policy "rsvp: owner delete" on event_rsvps for delete
  using (user_id = auth.uid());

-- groups
drop policy if exists "groups: public read" on groups;
create policy "groups: public read" on groups for select using (true);
drop policy if exists "groups: creator insert" on groups;
create policy "groups: creator insert" on groups for insert
  with check (auth.role() = 'authenticated' and creator_id = auth.uid());
drop policy if exists "groups: creator update" on groups;
create policy "groups: creator update" on groups for update
  using (creator_id = auth.uid() or is_admin()) with check (creator_id = auth.uid() or is_admin());
drop policy if exists "groups: creator delete" on groups;
create policy "groups: creator delete" on groups for delete
  using (creator_id = auth.uid() or is_admin());

-- group_members
drop policy if exists "gm: public read" on group_members;
create policy "gm: public read" on group_members for select using (true);
drop policy if exists "gm: self join" on group_members;
create policy "gm: self join" on group_members for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());
drop policy if exists "gm: self leave" on group_members;
create policy "gm: self leave" on group_members for delete
  using (user_id = auth.uid());

-- ---------- Realtime ----------
alter publication supabase_realtime add table listings;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table event_rsvps;
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table group_members;
