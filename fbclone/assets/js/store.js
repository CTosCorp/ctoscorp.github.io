/* ============================================================
   FaceClone — data layer (localStorage-backed demo database)
   ============================================================ */
const DBKEY = 'fbclone_';
const DB = {
  get(k, fb) {
    try { const raw = localStorage.getItem(DBKEY + k); return raw == null ? fb : JSON.parse(raw); }
    catch (e) { return fb; }
  },
  set(k, v) { try { localStorage.setItem(DBKEY + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { localStorage.removeItem(DBKEY + k); }
};

const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'Just now';
  const m = s / 60; if (m < 60) return Math.floor(m) + 'm';
  const h = m / 60; if (h < 24) return Math.floor(h) + 'h';
  const d = h / 24; if (d < 7) return Math.floor(d) + 'd';
  const w = d / 7; if (w < 5) return Math.floor(w) + 'w';
  return new Date(ts).toLocaleDateString();
}
function fullDate(ts) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const AV_COLORS = ['#1877F2', '#42B883', '#E1306C', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444', '#0EA5E9'];
function avColor(name) {
  let h = 0; const s = String(name || '?');
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function avatarHTML(name, size, extra) {
  size = size || 40;
  return `<div class="avatar" style="width:${size}px;height:${size}px;` +
    `font-size:${Math.round(size * 0.38)}px;background:${avColor(name)}" ${extra || ''}>${esc(initials(name))}</div>`;
}

/* ---------------- Seed data ---------------- */
function seedDB() {
  if (DB.get('seeded_v2')) return;
  const now = Date.now(), H = 3600e3, D = 24 * H;

  const users = [
    { id: 'u1', name: 'Rahim Uddin',   email: 'rahim@demo.com',   password: 'password', bio: 'Photographer | Dhaka, Bangladesh', joined: now - 400 * D, banned: false, isAdmin: true,  following: ['u2', 'u3', 'u5'] },
    { id: 'u2', name: 'Nusrat Jahan',   email: 'nusrat@demo.com',  password: 'password', bio: 'Food blogger 🍜',                  joined: now - 320 * D, banned: false, isAdmin: false, following: ['u1', 'u4'] },
    { id: 'u3', name: 'Tanvir Hasan',   email: 'tanvir@demo.com',  password: 'password', bio: 'Software engineer. Build things.', joined: now - 280 * D, banned: false, isAdmin: false, following: ['u1', 'u2'] },
    { id: 'u4', name: 'Sadia Afrin',    email: 'sadia@demo.com',   password: 'password', bio: 'Travel diaries ✈️',                joined: now - 200 * D, banned: false, isAdmin: false, following: ['u2', 'u6'] },
    { id: 'u5', name: 'Arif Chowdhury', email: 'arif@demo.com',    password: 'password', bio: 'Cricket lover 🏏 | Chattogram',    joined: now - 150 * D, banned: false, isAdmin: false, following: ['u1'] },
    { id: 'u6', name: 'Emma Wilson',    email: 'emma@demo.com',    password: 'password', bio: 'Designer & illustrator',          joined: now - 120 * D, banned: false, isAdmin: false, following: ['u4'] },
    { id: 'u7', name: 'Karim Sheikh',   email: 'karim@demo.com',   password: 'password', bio: 'Startup founder',                 joined: now - 60 * D,  banned: false, isAdmin: false, following: ['u1', 'u3'] },
    { id: 'u8', name: 'Mim Akter',      email: 'mim@demo.com',     password: 'password', bio: 'Student | bookworm 📚',            joined: now - 20 * D,  banned: false, isAdmin: false, following: ['u2'] },
  ];

  const pic = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w || 640}/${h || 360}`;
  const posts = [
    { id: 'p1', authorId: 'u4', text: 'Sunset at Cox\'s Bazar never disappoints 🌅 Who\'s joining next weekend?', image: pic('coxsbazar'), ts: now - 1 * H, likes: ['u1', 'u2', 'u3', 'u5'], shares: 6, pinned: true,
      comments: [
        { id: uid('c'), authorId: 'u1', text: 'Count me in! 🙌', ts: now - 50 * 60000 },
        { id: uid('c'), authorId: 'u2', text: 'That view 😍', ts: now - 30 * 60000 },
      ] },
    { id: 'p2', authorId: 'u3', text: 'Shipped my first open-source project today. 200 stars overnight — grateful! 🚀', bg: 'bg-blue', ts: now - 3 * H, likes: ['u1', 'u7'], shares: 2, pinned: false,
      comments: [ { id: uid('c'), authorId: 'u7', text: 'Congrats! Link?', ts: now - 2 * H } ] },
    { id: 'p3', authorId: 'u2', text: 'Homemade biryani recipe — full video in comments 👇', image: pic('biryani'), ts: now - 5 * H, likes: ['u1', 'u4', 'u8', 'u5', 'u3'], shares: 11, pinned: false,
      comments: [
        { id: uid('c'), authorId: 'u8', text: 'Recipe please!!', ts: now - 4 * H },
        { id: uid('c'), authorId: 'u2', text: 'Posted below 👇🍚', ts: now - 4 * H + 60000 },
      ] },
    { id: 'p4', authorId: 'u1', text: 'Golden hour hits different in the village 🌾', image: pic('village'), ts: now - 8 * H, likes: ['u2', 'u4', 'u6'], shares: 1, pinned: false, comments: [] },
    { id: 'p5', authorId: 'u5', text: 'Bangladesh wins by 6 wickets! What a chase!! 🏏🔥', bg: 'bg-green', ts: now - 12 * H, likes: ['u1', 'u3', 'u4', 'u7', 'u8', 'u2'], shares: 23, pinned: false,
      comments: [ { id: uid('c'), authorId: 'u3', text: 'That last over 😱', ts: now - 11 * H } ] },
    { id: 'p6', authorId: 'u6', text: 'New illustration series: "City Dreams" — 12 pieces, all done in Procreate 🎨', image: pic('cityart'), ts: now - 1 * D, likes: ['u4', 'u1'], shares: 3, pinned: false, comments: [] },
    { id: 'p7', authorId: 'u7', text: 'We just closed our pre-seed round. To everyone who believed early — thank you 🙏', bg: 'bg-purple', ts: now - 2 * D, likes: ['u3', 'u1', 'u5'], shares: 4, pinned: false,
      comments: [ { id: uid('c'), authorId: 'u3', text: 'Huge! Congrats 🎉', ts: now - 2 * D + H } ] },
    { id: 'p8', authorId: 'u8', text: 'Finished "The Alchemist" in one sitting. 10/10 recommend 📚✨', ts: now - 2 * D - 5 * H, likes: ['u2'], shares: 0, pinned: false, comments: [] },
    { id: 'p9', authorId: 'u4', text: 'Morning mist over the tea gardens 🍃', image: pic('teagarden'), ts: now - 3 * D, likes: ['u1', 'u2', 'u6', 'u8'], shares: 5, pinned: false, comments: [] },
    { id: 'p10', authorId: 'u2', text: 'Monday motivation: small steps every day 💪', bg: 'bg-orange', ts: now - 4 * D, likes: ['u5', 'u8'], shares: 1, pinned: false, comments: [] },
    { id: 'p11', authorId: 'u3', text: 'TIL: honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs — still edible 🍯', bg: 'bg-teal', ts: now - 5 * D, likes: ['u1', 'u8', 'u4'], shares: 9, pinned: false,
      comments: [ { id: uid('c'), authorId: 'u8', text: 'Mind blown 🤯', ts: now - 5 * D + 2 * H } ] },
    { id: 'p12', authorId: 'u1', text: 'Night sky from last night\'s shoot — no filter needed ✨', image: pic('nightsky', 640, 420), ts: now - 6 * D, likes: ['u4', 'u6', 'u2', 'u3', 'u7'], shares: 7, pinned: false, comments: [] },
  ];

  const reports = [
    { id: uid('r'), postId: 'p10', reporterId: 'u8', reason: 'Spam', ts: now - 2 * H, status: 'open' },
  ];

  DB.set('users', users);
  DB.set('posts', posts);
  DB.set('reports', reports);
  DB.set('settings', { siteName: 'FaceClone', tagline: 'Connect with friends and the world around you.', maintenance: false, regOpen: true, adminPass: 'admin123' });
  DB.set('seeded_v2', true);
}

function getSettings() { return DB.get('settings', { siteName: 'FaceClone' }); }
function saveSettings(s) { DB.set('settings', s); }
function getUsers() { return DB.get('users', []); }
function saveUsers(u) { DB.set('users', u); }
function getPosts() { return DB.get('posts', []); }
function savePosts(p) { DB.set('posts', p); }
function getReports() { return DB.get('reports', []); }
function saveReports(r) { DB.set('reports', r); }
function userById(id) { return getUsers().find(u => u.id === id); }
function postById(id) { return getPosts().find(p => p.id === id); }
function totalLikes() { return getPosts().reduce((n, p) => n + (p.likes || []).length, 0); }
function totalComments() { return getPosts().reduce((n, p) => n + (p.comments || []).length, 0); }
