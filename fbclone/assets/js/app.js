/* ============================================================
   FaceClone — main app (Supabase + realtime)
   ============================================================ */
const S = {
  view: 'home', profileId: null, query: '',
  dark: (() => { try { return localStorage.getItem('fbclone_dark') === '1'; } catch (e) { return false; } })(),
  openMenu: null, composerBg: '', followingCache: [],
};

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
function openModal(html) {
  closeModal();
  const m = document.createElement('div');
  m.id = 'modal';
  m.innerHTML = `<div class="modal-back" onclick="closeModal()"></div><div class="modal-box">${html}</div>`;
  document.body.appendChild(m);
}
function err(e) {
  console.error(e);
  toast(e.message || 'Something went wrong.');
}

/* ---------------- Boot ---------------- */
async function boot() {
  if (!supabaseConfigured()) { renderSetup(); return; }
  try {
    await bootSession();
  } catch (e) { console.error(e); }
  let st;
  try {
    st = await getSettings();
  } catch (e) {
    if (e.code === '42P01' || /relation[^]*does not exist/i.test(e.message || '')) { renderSchemaMissing(); return; }
    st = { site_name: 'FaceClone' };
  }
  S.settings = st;
  document.title = st.site_name || 'FaceClone';
  if (st.maintenance && !(ME && ME.is_admin)) { renderMaintenance(); return; }
  if (ME) {
    if (ME.banned) { await signOut(); renderAuth(); toast('This account has been banned.'); return; }
    S.followingCache = await followingIds().catch(() => []);
    renderApp();
  } else {
    renderAuth();
  }
}

function renderSetup() {
  document.getElementById('root').innerHTML = `
  <div class="maint"><div class="brand-big">FaceClone</div>
    <h2>⚙️ Setup needed</h2>
    <p class="muted" style="max-width:520px;line-height:1.7">
      This site needs a Supabase backend.<br><br>
      1. Create a free project at <b>supabase.com</b><br>
      2. Run <b>supabase/schema.sql</b> in the SQL Editor<br>
      3. Paste your Project URL + anon key into <b>assets/js/config.js</b> and redeploy.
    </p></div>`;
}

function renderSchemaMissing() {
  document.getElementById('root').innerHTML = `
  <div class="maint"><div class="brand-big">FaceClone</div>
    <h2>🗄️ Database not ready</h2>
    <p class="muted" style="max-width:520px;line-height:1.7">
      Supabase connect hoyeche, kintu tables toiri hoyni.<br><br>
      Supabase dashboard → <b>SQL Editor</b> → <b>supabase/schema.sql</b>-er puro content paste kore <b>Run</b> chap dao, tarpor page reload dao.
    </p></div>`;
}

/* ---------------- Auth ---------------- */
function renderAuth(mode) {
  mode = mode || 'login';
  const st = S.settings || { site_name: 'FaceClone', tagline: '' };
  document.body.classList.remove('app-body');
  const regOpen = st.reg_open !== false;
  $('#root').innerHTML = `
  <div class="auth-wrap">
    <div class="auth-left">
      <div class="brand-big">${esc(st.site_name)}</div>
      <p class="tagline">${esc(st.tagline || '')}</p>
      <div class="demo-box">
        <div class="demo-title">Real accounts, realtime</div>
        <div class="demo-note">Sign up with your email — posts, likes, comments and notifications sync live across every device via Supabase.</div>
      </div>
    </div>
    <div class="auth-card">
      ${mode === 'login' ? `
        <input id="li_email" class="inp" type="email" placeholder="Email address" autocomplete="username">
        <input id="li_pass" class="inp" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')doLogin()" autocomplete="current-password">
        <button class="btn-primary" id="li_btn" onclick="doLogin()">Log in</button>
        <hr class="auth-hr">
        ${regOpen ? `<button class="btn-green" onclick="renderAuth('signup')">Create new account</button>`
                  : `<div class="muted" style="text-align:center">Registrations are currently closed.</div>`}
      ` : `
        <div class="su-title">Sign Up</div>
        <div class="su-sub">It's quick and easy.</div>
        <input id="su_name" class="inp" placeholder="Full name">
        <input id="su_email" class="inp" type="email" placeholder="Email address">
        <input id="su_pass" class="inp" type="password" placeholder="New password" onkeydown="if(event.key==='Enter')doSignup()">
        <button class="btn-green" id="su_btn" onclick="doSignup()">Sign Up</button>
        <div class="auth-link"><a href="#" onclick="event.preventDefault();renderAuth('login')">Already have an account?</a></div>
      `}
    </div>
  </div>
  <div class="auth-foot"><a href="admin.html">Admin Panel</a> · FaceClone — powered by Supabase</div>`;
}
async function doLogin() {
  const btn = $('#li_btn'); btn.disabled = true; btn.textContent = 'Logging in...';
  try {
    await signIn($('#li_email').value.trim(), $('#li_pass').value);
    S.followingCache = await followingIds().catch(() => []);
    renderApp(); toast('Welcome back, ' + ME.name.split(' ')[0] + '!');
  } catch (e) { err(e); btn.disabled = false; btn.textContent = 'Log in'; }
}
async function doSignup() {
  const name = $('#su_name').value.trim(), email = $('#su_email').value.trim(), pass = $('#su_pass').value;
  if (!name || !email || pass.length < 6) { toast('Fill all fields (password min 6 chars).'); return; }
  const btn = $('#su_btn'); btn.disabled = true; btn.textContent = 'Creating...';
  try {
    await signUp(name, email, pass);
    S.followingCache = [];
    renderApp(); toast('Account created. Welcome, ' + name.split(' ')[0] + '!');
  } catch (e) { err(e); btn.disabled = false; btn.textContent = 'Sign Up'; }
}
async function logout() {
  teardownRealtime();
  await signOut();
  S.view = 'home'; S.profileId = null;
  renderAuth();
}

/* ---------------- App shell ---------------- */
let rtChannels = [];
function teardownRealtime() { rtChannels.forEach(ch => { try { sb.removeChannel(ch); } catch (e) {} }); rtChannels = []; }

function renderApp() {
  teardownRealtime();
  document.body.classList.add('app-body');
  document.body.classList.toggle('dark', S.dark);
  const st = S.settings || { site_name: 'FaceClone' };
  document.title = st.site_name;
  $('#root').innerHTML = `
  <header class="topbar">
    <div class="tb-left">
      <div class="logo" onclick="goHome()">${esc((st.site_name || 'F')[0])}</div>
      <div class="search-box">
        <span class="search-ico">⌕</span>
        <input id="q" placeholder="Search ${esc(st.site_name)}" value="${esc(S.query)}"
          onkeydown="if(event.key==='Enter')doSearch(this.value)">
      </div>
    </div>
    <nav class="tb-center">
      <button class="tb-tab ${S.view === 'home' ? 'active' : ''}" onclick="goHome()" title="Home">⌂</button>
      <button class="tb-tab" onclick="toast('Watch is decorative in this demo')" title="Video">▶</button>
      <button class="tb-tab" onclick="toast('Marketplace is decorative in this demo')" title="Marketplace">▦</button>
      <button class="tb-tab ${S.view === 'friends' ? 'active' : ''}" onclick="showFriends()" title="Friends">👥</button>
    </nav>
    <div class="tb-right">
      <span class="live-dot" title="Realtime connected">● LIVE</span>
      <button class="tb-ico" onclick="toast('Messenger is decorative in this demo')" title="Messenger">✉</button>
      <button class="tb-ico" onclick="toggleNotif(event)" title="Notifications">🔔<span class="badge" id="notifBadge">0</span></button>
      <button class="tb-avatar" onclick="toggleMenu(event,'profile')">${pav(ME, 36)}</button>
    </div>
  </header>
  <div id="dropdown"></div>
  <div class="layout">
    <aside class="side left">${leftNavHTML()}</aside>
    <main class="feed" id="feed"><div class="card empty">Loading feed...</div></main>
    <aside class="side right" id="rightBar"><div class="card empty">Loading...</div></aside>
  </div>
  <div class="foot-link"><a href="admin.html">Admin Panel</a></div>`;
  if (!window._fcClickBound) { document.addEventListener('click', closeDropdowns); window._fcClickBound = true; }
  renderView();
  setupRealtime();
  refreshNotifBadge();
  cleanupMyStories().then(() => { if (S.view === 'home') refreshStories(); }).catch(() => {});
}
function closeDropdowns(e) {
  if (!e.target.closest('#dropdown') && !e.target.closest('.tb-ico') && !e.target.closest('.tb-avatar') && !e.target.closest('.post-menu-btn'))
    $('#dropdown').innerHTML = '';
}
function goHome() { S.view = 'home'; S.profileId = null; S.query = ''; renderApp(); }
function doSearch(v) { S.query = v.trim(); if (S.query) { S.view = 'search'; renderApp(); } }
function showFriends() { S.view = 'friends'; renderApp(); }
function openProfile(id) { S.view = 'profile'; S.profileId = id; PROFILE_TAB = 'posts'; renderApp(); window.scrollTo(0, 0); }

async function renderView() {
  const f = $('#feed');
  try {
    if (S.view === 'profile') f.innerHTML = await profileHTML(S.profileId);
    else if (S.view === 'friends') f.innerHTML = await friendsHTML();
    else if (S.view === 'search') f.innerHTML = await searchHTML();
    else f.innerHTML = homeSkeleton();
    if (S.view === 'home') loadHomeFeed();
    loadRightBar();
  } catch (e) { err(e); }
}
function homeSkeleton() {
  return storiesSkeleton() + composerHTML() + `<div id="posts"><div class="card empty">Loading posts...</div></div>`;
}
function storiesSkeleton() {
  return `<div class="stories"><div class="story create" style="opacity:.5">
    <div class="story-top">${pav(ME, 64)}</div>
    <div class="story-plus">+</div><div class="story-label">Create story</div></div></div>`;
}
async function loadHomeFeed() {
  try {
    const posts = await getFeed();
    const el = $('#posts');
    if (el) el.innerHTML = postsHTML(posts.filter(p => !p.author.banned));
    const st = $('#storiesRow');
    if (st) {
      const html = await storiesHTML();
      st.innerHTML = myStoryCardHTML() + html;
    }
  } catch (e) { err(e); }
}
function refreshFeedSoon() {
  if (S._rt) clearTimeout(S._rt);
  S._rt = setTimeout(() => {
    if (S.view === 'home') loadHomeFeed();
    else if (S.view === 'profile') renderView();
  }, 700);
}

/* ---------------- Realtime ---------------- */
function setupRealtime() {
  const reload = debounce(() => { if (S.view === 'home' || S.view === 'profile') refreshFeedSoon(); }, 400);
  rtChannels.push(onTable('posts', reload));
  rtChannels.push(onTable('comments', reload));
  rtChannels.push(onTable('likes', reload));
  rtChannels.push(onTable('stories', debounce(() => { if (S.view === 'home') refreshStories(); }, 600)));
  rtChannels.push(onTable('profiles', debounce(() => loadRightBar(), 800)));
  rtChannels.push(onTable('notifications', async (payload) => {
    if (payload.eventType === 'INSERT' && payload.new.user_id === ME.id) {
      refreshNotifBadge();
      const dd = $('.notif-menu');
      if (dd) toggleNotif._dirty = true;
      toast('🔔 ' + (payload.new.message || 'New notification'));
    }
  }, `user_id=eq.${ME.id}`));
}
async function refreshNotifBadge() {
  const n = await unreadNotifCount().catch(() => 0);
  const b = $('#notifBadge');
  if (b) { b.textContent = Math.min(n, 9); b.style.display = n ? 'flex' : 'none'; }
}

/* ---------------- Sidebars ---------------- */
function leftNavHTML() {
  const items = [
    ['me', ME.name, 'profile'], ['👥', 'Friends', 'friends'], ['🕘', 'Memories', 'x'],
    ['🔖', 'Saved', 'x'], ['👪', 'Groups', 'x'], ['▶', 'Video', 'x'],
    ['🏪', 'Marketplace', 'x'], ['📰', 'Feeds', 'x'], ['📅', 'Events', 'x'],
  ];
  return items.map(([ico, label, act]) => `
    <button class="nav-item" onclick="${act === 'profile' ? `openProfile('${ME.id}')` : act === 'friends' ? 'showFriends()' : `toast('${label} is decorative in this demo')`}">
      ${act === 'profile' ? pav(ME, 32) : `<span class="nav-ico">${ico}</span>`}
      <span>${esc(label)}</span>
    </button>`).join('');
}
async function loadRightBar() {
  try {
    const others = await getUsersList();
    const el = $('#rightBar');
    if (!el) return;
    el.innerHTML = `
      <div class="side-sec"><div class="side-title">Sponsored</div>
        <div class="spon"><div class="spon-img g1"></div><div><b>Daraz 11.11 Sale</b><div class="muted">daraz.com.bd</div></div></div>
        <div class="spon"><div class="spon-img g2"></div><div><b>Learn coding free</b><div class="muted">freecodecamp.org</div></div></div>
      </div><hr>
      <div class="side-sec"><div class="side-title">Contacts · ${others.length}</div>
        ${others.slice(0, 14).map(u => `
          <button class="contact" onclick="openProfile('${u.id}')">
            <span class="contact-av">${pav(u, 32)}<span class="dot"></span></span>
            <span>${esc(u.name)}</span>
          </button>`).join('') || '<div class="muted">No other users yet.</div>'}
      </div>`;
  } catch (e) { /* ignore */ }
}

/* ---------------- Stories / composer ---------------- */
const STORY_GRADS = ['sg1', 'sg2', 'sg3', 'sg4'];
async function storiesHTML() {
  let stories = [];
  try { stories = await getStories(); } catch (e) { console.error(e); }
  S._stories = stories;
  const byAuthor = {};
  stories.forEach(s => { if (!byAuthor[s.author_id]) byAuthor[s.author_id] = s; });
  const mine = byAuthor[ME.id];
  const others = Object.values(byAuthor).filter(s => s.author_id !== ME.id).slice(0, 10);
  return others.map((s, i) => {
    const a = s.author;
    return `<div ${s.image_url ? 'class="story"' : `class="story ${s.bg || STORY_GRADS[i % 4]}"`} ${s.image_url ? `style="background-image:url('${esc(s.image_url)}');background-size:cover;background-position:center"` : ''} onclick="openStoryViewer('${s.author_id}')">
      <div class="story-av">${pav(a, 36)}</div>
      ${!s.image_url && s.text ? `<div class="story-text-prev">${esc(s.text.slice(0, 60))}</div>` : ''}
      <div class="story-label">${esc((a.name || '?').split(' ')[0])}</div>
    </div>`;
  }).join('');
}
function myStoryCardHTML() {
  const mine = (S._stories || []).find(s => s.author_id === ME.id);
  return `<div class="story create" onclick="${mine ? `openStoryViewer('${ME.id}')` : 'openStoryComposer()'}">
    <div class="story-top">${mine && mine.image_url
      ? `<img src="${esc(mine.image_url)}" style="width:100%;height:100%;object-fit:cover">`
      : pav(ME, 64)}</div>
    <div class="story-plus" onclick="event.stopPropagation();openStoryComposer()">+</div>
    <div class="story-label">${mine ? 'Your story' : 'Create story'}</div>
  </div>`;
}
async function refreshStories() {
  const row = $('#storiesRow');
  if (!row || S.view !== 'home') return;
  try {
    const stories = await getStories();
    S._stories = stories;
    row.innerHTML = myStoryCardHTML() + await storiesHTML();
  } catch (e) { /* ignore */ }
}

/* ---- story composer ---- */
function openStoryComposer() {
  S.storyBg = '';
  openModal(`<h3>Create story</h3>
    <p class="muted" style="text-align:center;margin:-8px 0 10px">Visible for 24 hours</p>
    <textarea id="st_text" class="cp-text" placeholder="Say something..." rows="2" maxlength="200"></textarea>
    <div class="swatches" id="st_sw">${BG_SWATCHES.map(b => `<button class="sw ${b} ${b === '' ? 'sw-none sel' : ''}" onclick="pickStoryBg('${b}',this)"></button>`).join('')}</div>
    <label class="lbl">Photo (optional)</label>
    <input id="st_file" type="file" accept="image/*" class="inp">
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" id="st_btn" onclick="submitStory()">Share story</button></div>`);
}
function pickStoryBg(b, el) {
  S.storyBg = b;
  $$('#st_sw .sw').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}
async function submitStory() {
  const text = $('#st_text').value.trim();
  const file = $('#st_file').files[0];
  if (!text && !file) { toast('Add a photo or text first.'); return; }
  const btn = $('#st_btn'); btn.disabled = true; btn.textContent = 'Sharing...';
  try {
    let image_url = null;
    if (file) { btn.textContent = 'Uploading...'; image_url = await uploadToMedia(file, 'story'); }
    await createStory({ image_url, text, bg: S.storyBg || null });
    closeModal(); refreshStories(); toast('Story shared! 📸');
  } catch (e) { err(e); btn.disabled = false; btn.textContent = 'Share story'; }
}

/* ---- story viewer ---- */
let STORY_VIEW = null;
async function openStoryViewer(authorId) {
  let stories = S._stories || [];
  if (!stories.length) { try { stories = await getStories(); S._stories = stories; } catch (e) {} }
  const list = stories.filter(s => s.author_id === authorId);
  if (!list.length) { toast('Story expired.'); refreshStories(); return; }
  STORY_VIEW = { list, idx: 0, timer: null };
  renderStoryViewer();
}
function renderStoryViewer() {
  closeStoryViewer(true);
  const s = STORY_VIEW.list[STORY_VIEW.idx];
  const a = s.author || { name: '?' };
  const mine = s.author_id === ME.id;
  const v = document.createElement('div');
  v.id = 'storyViewer';
  v.innerHTML = `
    <div class="sv-card">
      <div class="sv-progress">${STORY_VIEW.list.map((_, i) =>
        `<div class="sv-bar"><div class="sv-fill ${i < STORY_VIEW.idx ? 'done' : ''} ${i === STORY_VIEW.idx ? 'now' : ''}"></div></div>`).join('')}</div>
      <div class="sv-head">${pav(a, 36)}<div class="sv-who"><b>${esc(a.name)}</b><div class="muted">${timeAgo(s.created_at)}</div></div>
        ${mine ? `<button class="sv-del" onclick="deleteCurrentStory()" title="Delete story">🗑️</button>` : ''}
        <button class="sv-close" onclick="closeStoryViewer()">✕</button></div>
      <div class="sv-body ${s.image_url ? '' : (s.bg || 'sg1')}">
        ${s.image_url ? `<img src="${esc(s.image_url)}">` : `<div class="sv-text">${esc(s.text)}</div>`}
      </div>
      <div class="sv-tap sv-left" onclick="storyNav(-1)"></div>
      <div class="sv-tap sv-right" onclick="storyNav(1)"></div>
    </div>`;
  document.body.appendChild(v);
  clearTimeout(STORY_VIEW.timer);
  STORY_VIEW.timer = setTimeout(() => storyNav(1), 5000);
}
function storyNav(d) {
  if (!STORY_VIEW) return;
  const n = STORY_VIEW.idx + d;
  if (n < 0) { renderStoryViewer(); return; }
  if (n >= STORY_VIEW.list.length) { closeStoryViewer(); return; }
  STORY_VIEW.idx = n;
  renderStoryViewer();
}
function closeStoryViewer(keep) {
  const v = $('#storyViewer');
  if (v) v.remove();
  if (STORY_VIEW) clearTimeout(STORY_VIEW.timer);
  if (!keep) STORY_VIEW = null;
}
async function deleteCurrentStory() {
  if (!STORY_VIEW) return;
  const s = STORY_VIEW.list[STORY_VIEW.idx];
  if (!confirm('Delete this story?')) return;
  try { await deleteStory(s.id); closeStoryViewer(); refreshStories(); toast('Story deleted.'); }
  catch (e) { err(e); }
}
function composerHTML() {
  return `<div id="storiesRow" class="stories">
      <div class="story create" onclick="openStoryComposer()">
        <div class="story-top">${pav(ME, 64)}</div>
        <div class="story-plus">+</div><div class="story-label">Create story</div>
      </div>
    </div>
  <div class="composer card">
    <div class="composer-top" onclick="openComposer()">
      ${pav(ME, 40)}
      <div class="composer-fake">What's on your mind, ${esc(ME.name.split(' ')[0])}?</div>
    </div>
    <hr>
    <div class="composer-actions">
      <button onclick="toast('Live video is decorative in this demo')">🔴 Live video</button>
      <button onclick="openComposer()">🖼️ Photo/video</button>
      <button onclick="toast('Feeling picker is decorative in this demo')">😊 Feeling/activity</button>
    </div>
  </div>`;
}

/* ---------------- Posts ---------------- */
function postsHTML(list) {
  if (!list.length) return `<div class="card empty">No posts yet. Be the first to share something!</div>`;
  return list.map(postHTML).join('');
}
function postHTML(p) {
  const a = p.author || { name: '?' };
  const comments = p.comments || [];
  return `<article class="post card" id="post_${p.id}">
    <div class="post-head">
      <span onclick="openProfile('${a.id || ''}')" class="clickable">${pav(a, 40)}</span>
      <div class="post-meta">
        <div class="post-name" onclick="openProfile('${a.id || ''}')">${esc(a.name)}
          ${p.pinned ? ' <span class="pin-tag">📌 Pinned</span>' : ''}</div>
        <div class="post-time">${timeAgo(p.created_at)} · 🌐</div>
      </div>
      <button class="post-menu-btn" onclick="toggleMenu(event,'post_${p.id}')">⋯</button>
    </div>
    ${p.text ? (p.bg
      ? `<div class="post-bgtext ${p.bg}">${esc(p.text)}</div>`
      : `<div class="post-text">${esc(p.text)}</div>`) : ''}
    ${p.image_url ? `<img class="post-img" loading="lazy" src="${esc(p.image_url)}" onerror="this.style.display='none'">` : ''}
    ${p.shared ? `<div class="shared-box">${sharedHTML(p.shared)}</div>` : ''}
    <div class="post-counts">
      <span>👍❤️ ${p.likeCount}</span>
      <span class="right-counts">${comments.length} comments</span>
    </div>
    <hr>
    <div class="post-actions">
      <button class="${p.likedByMe ? 'liked' : ''}" onclick="toggleLikeUI('${p.id}')">👍 Like</button>
      <button onclick="focusComment('${p.id}')">💬 Comment</button>
      <button onclick="sharePostUI('${p.id}')">↗ Share</button>
    </div>
    <hr>
    <div class="comments" id="comments_${p.id}">
      ${comments.slice(-3).map(commentHTML).join('')}
      ${comments.length > 3 ? `<button class="more-c" onclick="showAllComments('${p.id}')">View all ${comments.length} comments</button>` : ''}
    </div>
    <div class="add-comment">
      ${pav(ME, 32)}
      <input id="cin_${p.id}" placeholder="Write a comment..." onkeydown="if(event.key==='Enter')addCommentUI('${p.id}')">
    </div>
  </article>`;
}
function sharedHTML(s) {
  const a = s.author || { name: '?' };
  return `<div class="post" style="box-shadow:none">
    <div class="post-head"><span class="clickable" onclick="openProfile('${a.id || ''}')">${pav(a, 36)}</span>
      <div class="post-meta"><div class="post-name" onclick="openProfile('${a.id || ''}')">${esc(a.name)}</div>
      <div class="post-time">${timeAgo(s.created_at)}</div></div></div>
    ${s.text ? `<div class="post-text">${esc(s.text)}</div>` : ''}
    ${s.image_url ? `<img class="post-img" loading="lazy" src="${esc(s.image_url)}" onerror="this.style.display='none'">` : ''}
  </div>`;
}
function commentHTML(c) {
  return `<div class="comment">
    ${pav(c.author, 32)}
    <div class="comment-body"><b>${esc(c.author.name)}</b><div>${esc(c.text)}</div></div>
  </div>`;
}

/* post cache for actions */
let POST_CACHE = {};
function cachePosts(list) { list.forEach(p => { POST_CACHE[p.id] = p; }); }

async function toggleLikeUI(pid) {
  const p = POST_CACHE[pid]; if (!p) return;
  try {
    await toggleLike(p);
    p.likedByMe = !p.likedByMe;
    p.likeCount += p.likedByMe ? 1 : -1;
    const card = $('#post_' + pid);
    if (card) {
      card.querySelector('.post-actions button').classList.toggle('liked', p.likedByMe);
      card.querySelector('.post-counts span').textContent = `👍❤️ ${p.likeCount}`;
    }
  } catch (e) { err(e); }
}
async function addCommentUI(pid) {
  const inp = $('#cin_' + pid); const text = inp.value.trim(); if (!text) return;
  const p = POST_CACHE[pid]; if (!p) return;
  inp.disabled = true;
  try {
    const c = await addComment(p, text);
    c.author = { name: ME.name };
    p.comments.push(c);
    refreshComments(pid);
  } catch (e) { err(e); }
  inp.disabled = false;
}
function refreshComments(pid) {
  const p = POST_CACHE[pid];
  const box = $('#comments_' + pid); if (!box || !p) return;
  const comments = p.comments || [];
  box.innerHTML = comments.slice(-3).map(commentHTML).join('') +
    (comments.length > 3 ? `<button class="more-c" onclick="showAllComments('${pid}')">View all ${comments.length} comments</button>` : '');
  const card = $('#post_' + pid);
  if (card) card.querySelector('.right-counts').textContent = `${comments.length} comments`;
}
async function showAllComments(pid) {
  const p = POST_CACHE[pid]; if (!p) return;
  $('#comments_' + pid).innerHTML = (p.comments || []).map(commentHTML).join('');
}
function focusComment(pid) { const i = $('#cin_' + pid); if (i) i.focus(); }
async function sharePostUI(pid) {
  const p = POST_CACHE[pid]; if (!p) return;
  try {
    await createPost({ shared_from: p.shared_from || p.id });
    toast('Post shared to your timeline.');
  } catch (e) { err(e); }
}

/* post ⋯ menu */
function toggleMenu(e, id) {
  e.stopPropagation();
  const dd = $('#dropdown');
  if (S.openMenu === id) { dd.innerHTML = ''; S.openMenu = null; return; }
  S.openMenu = id;
  const r = e.currentTarget.getBoundingClientRect();
  let html = '';
  if (id === 'profile') {
    html = `<div class="menu" style="top:${r.bottom + 6}px;right:${window.innerWidth - r.right}px">
      <button onclick="openProfile('${ME.id}')">${pav(ME, 32)}<span><b>${esc(ME.name)}</b><br><span class="muted">See your profile</span></span></button>
      <hr>
      <button onclick="toggleDark()">🌙 Dark mode: ${S.dark ? 'On' : 'Off'}</button>
      ${ME.is_admin ? `<button onclick="location.href='admin.html'">🛠️ Admin Panel</button>` : ''}
      <button onclick="logout()">🚪 Log out</button>
    </div>`;
  } else if (id.startsWith('post_')) {
    const pid = id.slice(5); const p = POST_CACHE[pid];
    const mine = p && p.author_id === ME.id;
    html = `<div class="menu" style="top:${r.bottom + 4}px;right:${window.innerWidth - r.right}px;min-width:200px">
      ${mine ? `<button onclick="deletePostUI('${pid}')">🗑️ Delete post</button>` : ''}
      <button onclick="openReport('${pid}')">🚩 Report post</button>
      <button onclick="toast('Saved (demo)')">🔖 Save post</button>
    </div>`;
  }
  dd.innerHTML = html;
}
function toggleDark() {
  S.dark = !S.dark;
  try { localStorage.setItem('fbclone_dark', S.dark ? '1' : '0'); } catch (e) {}
  renderApp();
}
async function deletePostUI(pid) {
  if (!confirm('Delete this post?')) return;
  try { await deletePost(pid); $('#dropdown').innerHTML = ''; S.openMenu = null; refreshFeedSoon(); toast('Post deleted.'); }
  catch (e) { err(e); }
}
function openReport(pid) {
  $('#dropdown').innerHTML = ''; S.openMenu = null;
  const reasons = ['Spam', 'Harassment', 'Hate speech', 'False information', 'Nudity', 'Something else'];
  openModal(`<h3>Report post</h3><p class="muted">Why are you reporting this?</p>
    ${reasons.map((r, i) => `<label class="radio"><input type="radio" name="rr" value="${r}" ${i === 0 ? 'checked' : ''}> ${r}</label>`).join('')}
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="submitReport('${pid}')">Submit report</button></div>`);
}
async function submitReport(pid) {
  const reason = ($('input[name=rr]:checked') || {}).value || 'Other';
  try { await reportPost(pid, reason); closeModal(); toast('Thanks — admins will review this.'); }
  catch (e) { err(e); }
}

/* ---------------- Composer ---------------- */
const BG_SWATCHES = ['', 'bg-blue', 'bg-purple', 'bg-green', 'bg-orange', 'bg-teal', 'bg-pink'];
function openComposer() {
  S.composerBg = '';
  openModal(`<h3>Create post</h3>
    <div class="composer-user">${pav(ME, 40)}<div><b>${esc(ME.name)}</b><div class="muted">🌐 Public</div></div></div>
    <textarea id="cp_text" class="cp-text" placeholder="What's on your mind, ${esc(ME.name.split(' ')[0])}?" rows="4"></textarea>
    <div class="swatches" id="cp_sw">${BG_SWATCHES.map(b => `<button class="sw ${b} ${b === '' ? 'sw-none sel' : ''}" onclick="pickBg('${b}',this)"></button>`).join('')}</div>
    <label class="lbl">Photo (optional)</label>
    <input id="cp_file" type="file" accept="image/*" class="inp">
    <div class="muted" id="cp_hint" style="margin-top:6px">or paste an image URL:</div>
    <input id="cp_img" class="inp" placeholder="https://...">
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" id="cp_btn" onclick="submitPost()">Post</button></div>`);
  setTimeout(() => $('#cp_text').focus(), 50);
}
function pickBg(b, el) {
  S.composerBg = b;
  $$('#cp_sw .sw').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
  $('#cp_text').className = 'cp-text big ' + b;
}
async function submitPost() {
  const text = $('#cp_text').value.trim();
  const imgUrl = $('#cp_img').value.trim();
  const file = $('#cp_file').files[0];
  if (!text && !imgUrl && !file) { toast('Write something or add a photo first.'); return; }
  const btn = $('#cp_btn'); btn.disabled = true; btn.textContent = 'Posting...';
  try {
    let image_url = imgUrl || null;
    if (file) { btn.textContent = 'Uploading...'; image_url = await uploadImage(file); }
    await createPost({ text, image_url, bg: S.composerBg || null });
    closeModal(); window.scrollTo(0, 0); toast('Posted!');
  } catch (e) { err(e); btn.disabled = false; btn.textContent = 'Post'; }
}

/* ---------------- Profile ---------------- */
let PROFILE_TAB = 'posts';

async function profileHTML(uidv) {
  const { profile: u, posts, followers } = await getProfilePage(uidv);
  cachePosts(posts);
  S._profile = { u, posts, followers };
  S._profilePosts = posts;
  const mine = u.id === ME.id;
  const following = S.followingCache.includes(u.id);
  return `
  <div class="card profile-top">
    <div class="cover" ${u.cover_url ? `style="background-image:url('${esc(u.cover_url)}')"` : ''}>
      ${mine ? `<button class="cover-cam" onclick="document.getElementById('coverFile').click()" title="Edit cover photo">📷</button>
      <input type="file" id="coverFile" accept="image/*" style="display:none" onchange="doChangeCover(this)">` : ''}
    </div>
    <div class="profile-row">
      <div class="pfp-wrap">
        ${pav(u, 120)}
        ${mine ? `<button class="pfp-cam" onclick="document.getElementById('avatarFile').click()" title="Edit profile picture">📷</button>
        <input type="file" id="avatarFile" accept="image/*" style="display:none" onchange="doChangeAvatar(this)">` : ''}
      </div>
      <div class="profile-info"><h2>${esc(u.name)}</h2>
        ${u.thought
          ? `<div class="thought-bubble" ${mine ? 'onclick="editThought()" title="Edit thought"' : ''}>💭 ${esc(u.thought)}</div>`
          : (mine ? `<div class="thought-bubble empty" onclick="editThought()">+ Drop a thought...</div>` : '')}
        <div class="muted">${posts.length} posts · ${followers} followers</div>
      </div>
      <div class="profile-btns">
        ${mine
          ? `<button class="btn-primary" onclick="openStoryComposer()">⊕ Add to story</button>
             <button class="btn-ghost" onclick="editProfile()">✏️ Edit profile</button>`
          : `<button class="${following ? 'btn-ghost' : 'btn-primary'}" id="followBtn" onclick="toggleFollowUI('${u.id}')">${following ? '✓ Following' : '+ Follow'}</button>
             <button class="btn-ghost" onclick="toast('Messenger is decorative in this demo')">💬 Message</button>`}
      </div>
    </div>
    <div class="profile-tabs">
      ${['posts', 'about', 'photos', 'friends'].map(t =>
        `<button class="ptab ${PROFILE_TAB === t ? 'active' : ''}" onclick="setProfileTab('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
    </div>
  </div>
  <div id="profileTabContent">${await profileTabHTML()}</div>`;
}

async function setProfileTab(t) {
  PROFILE_TAB = t;
  $$('.ptab').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === t));
  const el = $('#profileTabContent');
  el.innerHTML = '<div class="card empty">Loading...</div>';
  try { el.innerHTML = await profileTabHTML(); }
  catch (e) { err(e); }
}

async function profileTabHTML() {
  const { u, posts } = S._profile;
  const mine = u.id === ME.id;
  if (PROFILE_TAB === 'about') return aboutHTML(u, mine);
  if (PROFILE_TAB === 'photos') return photosHTML(await getUserPhotos(u.id));
  if (PROFILE_TAB === 'friends') {
    const [fl, fg] = await Promise.all([getFollowers(u.id), getFollowing(u.id)]);
    return friendsTabHTML(fl, fg);
  }
  return `${mine ? `<div class="card"><div class="composer-top" onclick="openComposer()">${pav(ME, 40)}<div class="composer-fake">What's on your mind?</div></div></div>` : ''}
  <div class="card"><div class="posts-head"><h3>Posts</h3>
    <select id="postFilter" class="inp" style="width:auto;padding:8px 10px" onchange="applyPostFilter()">
      <option value="recent">Most recent</option><option value="top">Top posts</option>
    </select></div>
    <div id="profilePosts">${postsHTML(posts)}</div></div>`;
}

function applyPostFilter() {
  const v = $('#postFilter').value;
  const list = [...(S._profilePosts || [])];
  if (v === 'top') list.sort((a, b) => b.likeCount - a.likeCount);
  else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  cachePosts(list);
  $('#profilePosts').innerHTML = postsHTML(list);
}

function aboutHTML(u, mine) {
  const bday = u.birthday
    ? new Date(u.birthday + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;
  const rows = [
    ['🎂', 'Birthday', bday || '—'],
    ['📝', 'Bio', u.bio || '—'],
    ['📅', 'Joined', new Date(u.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })],
  ];
  return `<div class="card"><div class="posts-head"><h3>Personal details</h3>${mine ? `<button class="btn-ghost" onclick="editProfile()">✏️ Edit</button>` : ''}</div>
    ${rows.map(([i, l, v]) => `<div class="detail-row"><span class="detail-ico">${i}</span><div><div class="muted">${l}</div><div><b>${esc(v)}</b></div></div></div>`).join('')}</div>`;
}

function photosHTML(photos) {
  return `<div class="card"><div class="posts-head"><h3>Photos</h3><span class="muted">${photos.length}</span></div>
    ${photos.length
      ? `<div class="photo-grid">${photos.map(p => `<img src="${esc(p.image_url)}" loading="lazy" alt="" onclick="window.open('${esc(p.image_url)}','_blank')">`).join('')}</div>`
      : `<div class="muted">No photos yet.</div>`}</div>`;
}

function friendsTabHTML(followers, following) {
  const person = (u) => {
    const isMe = u.id === ME.id;
    const f = S.followingCache.includes(u.id);
    return `<div class="person" onclick="openProfile('${u.id}')" style="cursor:pointer">${pav(u, 64)}<b>${esc(u.name)}</b>
      <div class="muted">${esc(u.bio || '')}</div>
      ${isMe ? '' : `<button class="${f ? 'btn-ghost' : 'btn-primary'}" onclick="event.stopPropagation();toggleFollowUI2('${u.id}',this)">${f ? 'Following' : 'Follow'}</button>`}</div>`;
  };
  const grid = (list) => list.length ? `<div class="people-grid">${list.map(person).join('')}</div>` : `<div class="muted">Nothing here yet.</div>`;
  return `<div class="card"><h3>Followers · ${followers.length}</h3>${grid(followers)}</div>
          <div class="card"><h3>Following · ${following.length}</h3>${grid(following)}</div>`;
}

/* profile photo / thought uploads */
async function doChangeCover(input) {
  const f = input.files[0]; if (!f) return;
  toast('Uploading cover photo...');
  try {
    const url = await uploadToMedia(f, 'cover');
    await updateProfile({ cover_url: url });
    renderView(); toast('Cover photo updated!');
  } catch (e) { err(e); }
}
async function doChangeAvatar(input) {
  const f = input.files[0]; if (!f) return;
  toast('Uploading profile picture...');
  try {
    const url = await uploadToMedia(f, 'avatar');
    await updateProfile({ avatar_url: url });
    renderApp(); toast('Profile picture updated!');
  } catch (e) { err(e); }
}
function editThought() {
  openModal(`<h3>Drop a thought</h3>
    <input id="th_val" class="inp" maxlength="120" placeholder="Share a quick thought..." value="${esc(ME.thought || '')}">
    <div class="modal-actions"><button class="btn-ghost" onclick="saveThought(true)">Remove</button>
    <button class="btn-primary" onclick="saveThought(false)">Save</button></div>`);
  setTimeout(() => $('#th_val').focus(), 50);
}
async function saveThought(remove) {
  try {
    await updateProfile({ thought: remove ? '' : $('#th_val').value.trim().slice(0, 120) });
    closeModal(); renderView(); toast(remove ? 'Thought removed.' : 'Thought updated!');
  } catch (e) { err(e); }
}
async function toggleFollowUI(uidv) {
  try {
    const nowFollowing = await toggleFollow(uidv);
    S.followingCache = await followingIds();
    const b = $('#followBtn');
    if (b) { b.className = nowFollowing ? 'btn-ghost' : 'btn-primary'; b.innerHTML = nowFollowing ? '✓ Following' : '+ Follow'; }
  } catch (e) { err(e); }
}
function editProfile() {
  openModal(`<h3>Edit profile</h3>
    <label class="lbl">Name</label>
    <input id="ep_name" class="inp" value="${esc(ME.name)}">
    <label class="lbl">Bio</label>
    <input id="ep_bio" class="inp" placeholder="Bio" value="${esc(ME.bio || '')}">
    <label class="lbl">Birthday</label>
    <input id="ep_bday" class="inp" type="date" value="${esc(ME.birthday || '')}">
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="saveProfile()">Save</button></div>`);
}
async function saveProfile() {
  const name = $('#ep_name').value.trim();
  if (!name) { toast('Name is required.'); return; }
  try {
    await updateProfile({ name, bio: $('#ep_bio').value.trim(), birthday: $('#ep_bday').value || null });
    closeModal(); renderApp(); toast('Profile updated.');
  } catch (e) { err(e); }
}

/* ---------------- Friends / Search ---------------- */
async function friendsHTML() {
  const others = await getUsersList();
  return `<div class="card"><h3>People you may know</h3><div class="people-grid">
    ${others.map(u => {
      const f = S.followingCache.includes(u.id);
      return `<div class="person">${pav(u, 64)}<b>${esc(u.name)}</b>
        <div class="muted">${esc(u.bio || '')}</div>
        <button class="${f ? 'btn-ghost' : 'btn-primary'}" onclick="toggleFollowUI2('${u.id}',this)">${f ? 'Following' : 'Follow'}</button></div>`;
    }).join('') || '<div class="muted">No other users yet — invite friends!</div>'}
  </div></div>`;
}
async function toggleFollowUI2(uidv, btn) {
  try {
    const nowFollowing = await toggleFollow(uidv);
    S.followingCache = await followingIds();
    btn.className = nowFollowing ? 'btn-ghost' : 'btn-primary';
    btn.textContent = nowFollowing ? 'Following' : 'Follow';
  } catch (e) { err(e); }
}
async function searchHTML() {
  const { users, posts } = await searchAll(S.query);
  cachePosts(posts);
  return `<div class="card"><h3>Results for "${esc(S.query)}"</h3>
    ${users.length ? `<div class="side-title">People</div>` + users.map(u =>
      `<button class="contact" onclick="openProfile('${u.id}')">${pav(u, 40)}<span><b>${esc(u.name)}</b><br><span class="muted">${esc(u.bio || '')}</span></span></button>`).join('') : ''}
    ${posts.length ? `<div class="side-title" style="margin-top:12px">Posts</div></div><div style="margin-top:14px">${postsHTML(posts)}</div>`
                   : (users.length ? '</div>' : `</div><div class="card empty" style="margin-top:14px">No results found.</div>`)}
  `;
}

/* ---------------- Notifications ---------------- */
async function toggleNotif(e) {
  e.stopPropagation();
  const dd = $('#dropdown');
  if (S.openMenu === 'notif') { dd.innerHTML = ''; S.openMenu = null; return; }
  S.openMenu = 'notif';
  const r = e.currentTarget.getBoundingClientRect();
  let items = [];
  try { items = await getNotifications(); } catch (e2) { console.error(e2); }
  const icons = { like: '👍', comment: '💬', follow: '👥' };
  dd.innerHTML = `<div class="menu notif-menu" style="top:${r.bottom + 6}px;right:${Math.max(8, window.innerWidth - r.right - 200)}px">
    <div class="notif-head"><b>Notifications</b>
      <button class="mini" style="float:right" onclick="markAllRead(event)">Mark all read</button></div>
    ${items.length ? items.map(n => `
      <div class="notif ${n.read ? '' : 'unread'}">${pav(n.actor, 40)}
        <div>${icons[n.type] || '🔔'} <b>${esc(n.actor.name)}</b> ${esc((n.message || '').replace(n.actor.name, '').trim()) || n.type}
        <div class="muted">${timeAgo(n.created_at)}</div></div>
      </div>`).join('') : '<div class="notif muted">No notifications yet.</div>'}
  </div>`;
  markNotifsRead().then(refreshNotifBadge).catch(() => {});
}
async function markAllRead(e) {
  e.stopPropagation();
  await markNotifsRead(); refreshNotifBadge();
  $('#dropdown').innerHTML = ''; S.openMenu = null; toast('All caught up!');
}

/* ---------------- Maintenance ---------------- */
function renderMaintenance() {
  const st = S.settings || { site_name: 'FaceClone' };
  document.getElementById('root').innerHTML = `
    <div class="maint"><div class="brand-big">${esc(st.site_name)}</div>
    <h2>We'll be back soon 🛠️</h2><p class="muted">The site is under maintenance. Please check back later.</p>
    <div class="auth-link"><a href="admin.html">Admin login</a></div></div>`;
}

document.addEventListener('DOMContentLoaded', boot);
