/* ============================================================
   FaceClone — Supabase config
   Paste your Project URL + anon key below (Supabase dashboard
   → Project Settings → API). The anon key is publishable and
   safe to ship in client-side code.
   ============================================================ */
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

function supabaseConfigured() {
  return typeof SUPABASE_URL === 'string'
    && SUPABASE_URL.startsWith('https://')
    && typeof SUPABASE_ANON_KEY === 'string'
    && !SUPABASE_ANON_KEY.startsWith('YOUR_');
}
