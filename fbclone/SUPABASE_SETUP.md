# FaceClone — Supabase Setup Guide

Site ekhon **full-functional + realtime** — kintu cholte hole ekbar Supabase backend connect korte hobe (5 minute-er kaj, free).

## Step 1 — Supabase project banao
1. [supabase.com](https://supabase.com) → **Start your project** → GitHub diye login
2. **New project** → name `faceclone`, password dao, region `Singapore` (tomar kache fast) → **Create new project**
3. 1–2 min wait koro jotokkhon project ready hoy

## Step 2 — Database schema run koro
1. Left sidebar → **SQL Editor** → **New query**
2. Ei repo-r `supabase/schema.sql` file-er **puro content** copy kore paste koro
3. **Run** (▶) chap dao — success dekhabe
   - Eta banabe: `profiles, posts, comments, likes, follows, reports, notifications, settings` tables
   - Row Level Security policies, `media` storage bucket, realtime publication — sob

## Step 3 — Email confirmation OFF koro (demo login-er jonno)
1. **Authentication** → **Providers** → **Email**
2. **Confirm email** toggle ta **OFF** kore **Save** dao
   - (Na korle signup-er por email verify na kora porjonto login hobe na)

## Step 4 — API keys amake dao
1. **Project Settings** (⚙️) → **API**
2. Amake pathao:
   - **Project URL** (jemon `https://xyzcompany.supabase.co`)
   - **anon public** key
   - ⚠️ **service_role key kokhono share koro na** — ota lagbe na

Ami `assets/js/config.js`-e bosay GitHub-e push kore dibo. Site live hoye jabe.

## Step 5 — Nijeke admin banao
1. Site-e giye **Sign Up** koro tomar email diye
2. Supabase → **SQL Editor** → New query → run koro:
   ```sql
   update profiles set is_admin = true where email = 'tomar@email.com';
   ```
3. Ekhon `.../fbclone/admin.html`-e oi email/password diye login → full admin panel 🎛️
4. **Settings** tab-e **"Insert demo posts"** chap dile 8 ta demo post chole asbe

## Realtime ki ki live?
- 📰 Feed — keu post korle sobar screen-e auto asbe
- 👍❤️ Like / 💬 comment count — instant update
- 🔔 Notifications — like/comment/follow-e sathe sathe toast + badge
- 🛠️ Admin panel — notun user/post/report dashboard-e auto refresh

## Khoroch
Supabase free tier: 500MB database + 1GB storage + realtime included — ei demo-r jonno more than enough.
