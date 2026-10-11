-- ============================================================
-- FaceClone — Supabase schema (run once in SQL Editor)
-- Creates: tables, auto-profile trigger, RLS policies,
--          public storage bucket, realtime publication
-- ============================================================

-- ---------- Tables ----------
create table if not exists profiles (
  id uuid primary key constraint profiles_user_fk references auth.users(id) on delete cascade,
  name text not null,
  email text,
  bio text default '',
  banned boolean default false not null,
  is_admin boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null constraint posts_author_fk references profiles(id) on delete cascade,
  text text default '',
  image_url text,
  bg text,
  shared_from uuid constraint posts_shared_fk references posts(id) on delete cascade,
  pinned boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null constraint comments_post_fk references posts(id) on delete cascade,
  author_id uuid not null constraint comments_author_fk references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now() not null
);

create table if not exists likes (
  post_id uuid not null constraint likes_post_fk references posts(id) on delete cascade,
  user_id uuid not null constraint likes_user_fk references profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (post_id, user_id)
);

create table if not exists follows (
  follower_id uuid not null constraint follows_follower_fk references profiles(id) on delete cascade,
  following_id uuid not null constraint follows_following_fk references profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid constraint reports_post_fk references posts(id) on delete cascade,
  reporter_id uuid constraint reports_reporter_fk references profiles(id) on delete set null,
  reason text not null,
  status text default 'open' not null,
  created_at timestamptz default now() not null
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint notif_user_fk references profiles(id) on delete cascade,
  actor_id uuid constraint notif_actor_fk references profiles(id) on delete set null,
  type text not null,
  post_id uuid constraint notif_post_fk references posts(id) on delete cascade,
  message text,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists settings (
  id int primary key,
  site_name text default 'FaceClone',
  tagline text default 'Connect with friends and the world around you.',
  reg_open boolean default true not null,
  maintenance boolean default false not null
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------- Auto-create profile on signup ----------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
          new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Admin helper (used by RLS policies) ----------
create or replace function is_admin()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- Row Level Security ----------
alter table profiles      enable row level security;
alter table posts         enable row level security;
alter table comments      enable row level security;
alter table likes         enable row level security;
alter table follows       enable row level security;
alter table reports       enable row level security;
alter table notifications enable row level security;
alter table settings      enable row level security;

-- profiles
drop policy if exists "profiles: public read" on profiles;
create policy "profiles: public read" on profiles for select using (true);
drop policy if exists "profiles: owner or admin update" on profiles;
create policy "profiles: owner or admin update" on profiles for update
  using (auth.uid() = id or is_admin()) with check (auth.uid() = id or is_admin());

-- posts
drop policy if exists "posts: public read" on posts;
create policy "posts: public read" on posts for select using (true);
drop policy if exists "posts: author insert" on posts;
create policy "posts: author insert" on posts for insert
  with check (auth.role() = 'authenticated' and author_id = auth.uid());
drop policy if exists "posts: author or admin update" on posts;
create policy "posts: author or admin update" on posts for update
  using (author_id = auth.uid() or is_admin()) with check (author_id = auth.uid() or is_admin());
drop policy if exists "posts: author or admin delete" on posts;
create policy "posts: author or admin delete" on posts for delete
  using (author_id = auth.uid() or is_admin());

-- comments
drop policy if exists "comments: public read" on comments;
create policy "comments: public read" on comments for select using (true);
drop policy if exists "comments: author insert" on comments;
create policy "comments: author insert" on comments for insert
  with check (auth.role() = 'authenticated' and author_id = auth.uid());
drop policy if exists "comments: author or admin delete" on comments;
create policy "comments: author or admin delete" on comments for delete
  using (author_id = auth.uid() or is_admin());

-- likes
drop policy if exists "likes: public read" on likes;
create policy "likes: public read" on likes for select using (true);
drop policy if exists "likes: owner insert" on likes;
create policy "likes: owner insert" on likes for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());
drop policy if exists "likes: owner delete" on likes;
create policy "likes: owner delete" on likes for delete using (user_id = auth.uid());

-- follows
drop policy if exists "follows: public read" on follows;
create policy "follows: public read" on follows for select using (true);
drop policy if exists "follows: owner insert" on follows;
create policy "follows: owner insert" on follows for insert
  with check (auth.role() = 'authenticated' and follower_id = auth.uid());
drop policy if exists "follows: owner delete" on follows;
create policy "follows: owner delete" on follows for delete using (follower_id = auth.uid());

-- reports
drop policy if exists "reports: admin read" on reports;
create policy "reports: admin read" on reports for select using (is_admin());
drop policy if exists "reports: user insert" on reports;
create policy "reports: user insert" on reports for insert
  with check (auth.role() = 'authenticated' and reporter_id = auth.uid());
drop policy if exists "reports: admin update" on reports;
create policy "reports: admin update" on reports for update
  using (is_admin()) with check (is_admin());

-- notifications
drop policy if exists "notif: owner read" on notifications;
create policy "notif: owner read" on notifications for select using (user_id = auth.uid());
drop policy if exists "notif: authenticated insert" on notifications;
create policy "notif: authenticated insert" on notifications for insert
  with check (auth.role() = 'authenticated');
drop policy if exists "notif: owner update" on notifications;
create policy "notif: owner update" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- settings
drop policy if exists "settings: public read" on settings;
create policy "settings: public read" on settings for select using (true);
drop policy if exists "settings: admin update" on settings;
create policy "settings: admin update" on settings for update
  using (is_admin()) with check (is_admin());

-- ---------- Storage: public "media" bucket ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media: public read" on storage.objects;
create policy "media: public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media: authenticated upload" on storage.objects;
create policy "media: authenticated upload" on storage.objects
  for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');

drop policy if exists "media: owner delete" on storage.objects;
create policy "media: owner delete" on storage.objects
  for delete using (bucket_id = 'media' and auth.uid() = owner);

-- ---------- Realtime ----------
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table likes;
alter publication supabase_realtime add table reports;
alter publication supabase_realtime add table notifications;

-- ============================================================
-- AFTER running this: sign up on your site, then make yourself
-- admin by running (replace with your signup email):
--
--   update profiles set is_admin = true where email = 'you@example.com';
-- ============================================================
