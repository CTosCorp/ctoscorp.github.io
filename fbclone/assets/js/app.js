/* ============================================================
   FaceClone — main app
   ============================================================ */
seedDB();

const S = {
  user: null, view: 'home', profileId: null, query: '',
  dark: DB.get('dark', false), openMenu: null, composerBg: '',
  friendsOnly: false,
};

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
function openModal(html) {
  closeModal();
  const m = document.createElement('div');
  m.id = 'modal';
  m.innerHTML = `<div class="modal-back" onclick="closeModal()"></div><div class="modal-box">${html}</div>`;
  document.body.appendChild(m);
}

/* ---------------- Auth ---------------- */
function renderAuth(mode) {
  mode = mode || 'login';
  const st = getSettings();
  const demo = getUsers().slice(0, 3);
  document.body.classList.remove('app-body');
  document.getElementById('root').innerHTML = `
  <div class="auth-wrap">
    <div class="auth-left">
      <div class="brand-big">${esc(st.siteName)}</div>
      <p class="tagline">${esc(st.tagline || '')}</p>
      <div class="demo-box">
        <div class="demo-title">One-click demo login</div>
        <div class="demo-users">${demo.map(u => `
          <button class="demo-user" onclick="quickLogin('${u.id}')">
            ${avatarHTML(u.name, 40)}<span>${esc(u.name.split(' ')[0])}</span>
          </button>`).join('')}
        </div>
        <div class="demo-note">Demo password for all accounts: <b>password</b></div>
      </div>
    </div>
    <div class="auth-card">
      ${mode === 'login' ? `
        <input id="li_email" class="inp" type="email" placeholder="Email address" autocomplete="username">
        <input id="li_pass" class="inp" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')doLogin()" autocomplete="current-password">
        <button class="btn-primary" onclick="doLogin()">Log in</button>
        <div class="auth-link"><a href="#" onclick="event.preventDefault();toast('Password reset is disabled in demo')">Forgotten password?</a></div>
        <hr class="auth-hr">
        <button class="btn-green" onclick="renderAuth('signup')">Create new account</button>
      ` : `
        <div class="su-title">Sign Up</div>
        <div class="su-sub">It's quick and easy.</div>
        <input id="su_name" class="inp" placeholder="Full name">
        <input id="su_email" class="inp" type="email" placeholder="Email address">
        <input id="su_pass" class="inp" type="password" placeholder="New password" onkeydown="if(event.key==='Enter')doSignup()">
        <button class="btn-green" onclick="doSignup()">Sign Up</button>
        <div class="auth-link"><a href="#" onclick="event.preventDefault();renderAuth('login')">Already have an account?</a></div>
      `}
    </div>
  </div>
  <div class="auth-foot"><a href="admin.html">Admin Panel</a> · FaceClone demo — data is stored in your browser only</div>`;
}
function quickLogin(id) {
  const u = userById(id);
  if (!u) return;
  if (u.banned) { toast('This account has been banned.'); return; }
  DB.set('session', { userId: id });
  S.user = u; renderApp();
}
function doLogin() {
  const email = $('#li_email').value.trim().toLowerCase();
  const pass = $('#li_pass').value;
  const u = getUsers().find(x => x.email.toLowerCase() === email && x.password === pass);
  if (!u) { toast('Wrong email or password.'); return; }
  if (u.banned) { toast('This account has been banned.'); return; }
  DB.set('session', { userId: u.id });
  S.user = u; renderApp(); toast('Welcome back, ' + u.name.split(' ')[0] + '!');
}
function doSignup() {
  if (!getSettings().regOpen) { toast('Registrations are currently closed.'); return; }
  const name = $('#su_name').value.trim(), email = $('#su_email').value.trim(), pass = $('#su_pass').value;
  if (!name || !email || !pass) { toast('Please fill in all fields.'); return; }
  if (getUsers().some(x => x.email.toLowerCase() === email.toLowerCase())) { toast('Email already registered.'); return; }
  const users = getUsers();
  const u = { id: uid('u'), name, email, password: pass, bio: '', joined: Date.now(), banned: false, isAdmin: false, following: [] };
  users.push(u); saveUsers(users);
  DB.set('session', { userId: u.id });
  S.user = u; renderApp(); toast('Account created. Welcome!');
}
function logout() {
  DB.del('session'); S.user = null; S.view = 'home';
  renderAuth();
}

/* ---------------- App shell ---------------- */
function renderApp() {
  document.body.classList.add('app-body');
  document.body.classList.toggle('dark', S.dark);
  const st = getSettings();
  document.title = st.siteName;
  document.getElementById('root').innerHTML = `
  <header class="topbar">
    <div class="tb-left">
      <div class="logo" onclick="goHome()">${esc(st.siteName[0] || 'F')}</div>
      <div class="search-box">
        <span class="search-ico">⌕</span>
        <input id="q" placeholder="Search ${esc(st.siteName)}" value="${esc(S.query)}"
          onkeydown="if(event.key==='Enter')doSearch(this.value)">
      </div>
    </div>
    <nav class="tb-center">
      <button class="tb-tab ${S.view === 'home' ? 'active' : ''}" onclick="goHome()" title="Home">⌂</button>
      <button class="tb-tab" onclick="toast('Watch is decorative in this demo')" title="Video">▶</button>
      <button class="tb-tab" onclick="toast('Marketplace is decorative in this demo')" title="Marketplace">▦</button>
      <button class="tb-tab" onclick="showFriends()" title="Friends">👥</button>
    </nav>
    <div class="tb-right">
      <button class="tb-ico" onclick="toast('Messenger is decorative in this demo')" title="Messenger">✉<span class="badge">3</span></button>
      <button class="tb-ico" onclick="toggleNotif(event)" title="Notifications">🔔<span class="badge" id="notifBadge">${notifCount()}</span></button>
      <button class="tb-avatar" onclick="toggleMenu(event,'profile')">${avatarHTML(S.user.name, 36)}</button>
    </div>
  </header>
  <div id="dropdown"></div>
  <div class="layout">
    <aside class="side left">${leftNavHTML()}</aside>
    <main class="feed" id="feed"></main>
    <aside class="side right">${rightHTML()}</aside>
  </div>
  <div class="foot-link"><a href="admin.html">Admin Panel</a></div>`;
  renderView();
  if (!window._fcClickBound) { document.addEventListener('click', closeDropdowns); window._fcClickBound = true; }
}
function closeDropdowns(e) {
  if (!e.target.closest('#dropdown') && !e.target.closest('.tb-ico') && !e.target.closest('.tb-avatar') && !e.target.closest('.post-menu-btn'))
    $('#dropdown').innerHTML = '';
}
function goHome() { S.view = 'home'; S.profileId = null; S.query = ''; renderApp(); }
function doSearch(v) { S.query = v.trim(); S.view = 'search'; renderApp(); }
function showFriends() { S.view = 'friends'; renderApp(); }
function openProfile(id) { S.view = 'profile'; S.profileId = id; renderApp(); window.scrollTo(0, 0); }

function renderView() {
  const f = $('#feed');
  if (S.view === 'profile') f.innerHTML = profileHTML(S.profileId);
  else if (S.view === 'friends') f.innerHTML = friendsHTML();
  else if (S.view === 'search') f.innerHTML = searchHTML();
  else f.innerHTML = homeHTML();
  const q = $('#q'); if (q && S.query) q.value = S.query;
}

/* ---------------- Left / right sidebars ---------------- */
function leftNavHTML() {
  const items = [
    ['me', S.user.name, 'profile'], ['👥', 'Friends', 'friends'], ['🕘', 'Memories', 'x'],
    ['🔖', 'Saved', 'x'], ['👪', 'Groups', 'x'], ['▶', 'Video', 'x'],
    ['🏪', 'Marketplace', 'x'], ['📰', 'Feeds', 'x'], ['📅', 'Events', 'x'],
  ];
  return items.map(([ico, label, act]) => `
    <button class="nav-item" onclick="${act === 'profile' ? `openProfile('${S.user.id}')` : act === 'friends' ? 'showFriends()' : `toast('${label} is decorative in this demo')`}">
      ${act === 'profile' ? avatarHTML(S.user.name, 32) : `<span class="nav-ico">${ico}</span>`}
      <span>${esc(label)}</span>
    </button>`).join('');
}
function rightHTML() {
  const others = getUsers().filter(u => u.id !== S.user.id && !u.banned);
  return `
    <div class="side-sec"><div class="side-title">Sponsored</div>
      <div class="spon"><div class="spon-img g1"></div><div><b>Daraz 11.11 Sale</b><div class="muted">daraz.com.bd</div></div></div>
      <div class="spon"><div class="spon-img g2"></div><div><b>Learn coding free</b><div class="muted">freecodecamp.org</div></div></div>
    </div>
    <hr>
    <div class="side-sec"><div class="side-title">Contacts</div>
      ${others.map(u => `
        <button class="contact" onclick="toast('Chat is decorative in this demo')">
          <span class="contact-av">${avatarHTML(u.name, 32)}<span class="dot"></span></span>
          <span>${esc(u.name)}</span>
        </button>`).join('')}
    </div>`;
}

/* ---------------- Home feed ---------------- */
function homeHTML() {
  return storiesHTML() + composerHTML() + `<div id="posts">${postsHTML(feedPosts())}</div>`;
}
function feedPosts() {
  const ps = getPosts().filter(p => { const a = userById(p.authorId); return a && !a.banned; });
  ps.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || b.ts - a.ts);
  return ps;
}
const STORY_GRADS = ['sg1', 'sg2', 'sg3', 'sg4'];
function storiesHTML() {
  const others = getUsers().filter(u => u.id !== S.user.id && !u.banned).slice(0, 4);
  return `<div class="stories">
    <div class="story create" onclick="toast('Stories are decorative in this demo')">
      <div class="story-top">${avatarHTML(S.user.name, 64)}</div>
      <div class="story-plus">+</div><div class="story-label">Create story</div>
    </div>
    ${others.map((u, i) => `
    <div class="story ${STORY_GRADS[i % 4]}" onclick="toast('Stories are decorative in this demo')">
      <div class="story-av">${avatarHTML(u.name, 36)}</div>
      <div class="story-label">${esc(u.name.split(' ')[0])}</div>
    </div>`).join('')}
  </div>`;
}
function composerHTML() {
  return `<div class="composer card">
    <div class="composer-top" onclick="openComposer()">
      ${avatarHTML(S.user.name, 40)}
      <div class="composer-fake">What's on your mind, ${esc(S.user.name.split(' ')[0])}?</div>
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
  const a = userById(p.authorId); if (!a) return '';
  const liked = (p.likes || []).includes(S.user.id);
  const comments = p.comments || [];
  const shared = p.sharedFrom ? postById(p.sharedFrom) : null;
  return `<article class="post card" id="post_${p.id}">
    <div class="post-head">
      <span onclick="openProfile('${a.id}')" class="clickable">${avatarHTML(a.name, 40)}</span>
      <div class="post-meta">
        <div class="post-name ${p.pinned ? 'pinned-name' : ''}" onclick="openProfile('${a.id}')">
          ${esc(a.name)} ${p.pinned ? '<span class="pin-tag">📌 Pinned</span>' : ''}</div>
        <div class="post-time">${timeAgo(p.ts)} · 🌐</div>
      </div>
      <button class="post-menu-btn" onclick="toggleMenu(event,'post_${p.id}')">⋯</button>
    </div>
    ${p.text ? (p.bg
      ? `<div class="post-bgtext ${p.bg}">${esc(p.text)}</div>`
      : `<div class="post-text">${esc(p.text)}</div>`) : ''}
    ${p.image ? `<img class="post-img" loading="lazy" src="${esc(p.image)}" onerror="this.style.display='none'">` : ''}
    ${shared ? `<div class="shared-box">${postHTML(shared)}</div>` : ''}
    <div class="post-counts">
      <span>👍❤️ ${(p.likes || []).length}</span>
      <span class="right-counts">${comments.length} comments · ${p.shares || 0} shares</span>
    </div>
    <hr>
    <div class="post-actions">
      <button class="${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')">👍 Like</button>
      <button onclick="focusComment('${p.id}')">💬 Comment</button>
      <button onclick="sharePost('${p.id}')">↗ Share</button>
    </div>
    <hr>
    <div class="comments" id="comments_${p.id}">
      ${comments.slice(-3).map(commentHTML).join('')}
      ${comments.length > 3 ? `<button class="more-c" onclick="showAllComments('${p.id}')">View all ${comments.length} comments</button>` : ''}
    </div>
    <div class="add-comment">
      ${avatarHTML(S.user.name, 32)}
      <input id="cin_${p.id}" placeholder="Write a comment..." onkeydown="if(event.key==='Enter')addComment('${p.id}')">
    </div>
  </article>`;
}
function commentHTML(c) {
  const a = userById(c.authorId); if (!a) return '';
  return `<div class="comment">
    ${avatarHTML(a.name, 32)}
    <div class="comment-body"><b>${esc(a.name)}</b><div>${esc(c.text)}</div></div>
  </div>`;
}
function showAllComments(pid) {
  const p = postById(pid); if (!p) return;
  $('#comments_' + pid).innerHTML = (p.comments || []).map(commentHTML).join('');
}
function focusComment(pid) { const i = $('#cin_' + pid); if (i) i.focus(); }

function toggleLike(pid) {
  const ps = getPosts(); const p = ps.find(x => x.id === pid); if (!p) return;
  p.likes = p.likes || [];
  const i = p.likes.indexOf(S.user.id);
  if (i >= 0) p.likes.splice(i, 1); else p.likes.push(S.user.id);
  savePosts(ps); refreshPosts();
}
function addComment(pid) {
  const inp = $('#cin_' + pid); const text = inp.value.trim(); if (!text) return;
  const ps = getPosts(); const p = ps.find(x => x.id === pid); if (!p) return;
  p.comments = p.comments || [];
  p.comments.push({ id: uid('c'), authorId: S.user.id, text, ts: Date.now() });
  savePosts(ps); refreshPosts();
  setTimeout(() => focusComment(pid), 50);
}
function sharePost(pid) {
  const ps = getPosts();
  const orig = ps.find(x => x.id === pid); if (!orig) return;
  orig.shares = (orig.shares || 0) + 1;
  ps.unshift({ id: uid('p'), authorId: S.user.id, text: '', ts: Date.now(), likes: [], comments: [], shares: 0, sharedFrom: pid, pinned: false });
  savePosts(ps); refreshPosts(); toast('Post shared to your timeline.');
}
function refreshPosts() {
  const el = $('#posts');
  if (el && S.view === 'home') el.innerHTML = postsHTML(feedPosts());
  else renderView();
}

/* Post ⋯ menu */
function toggleMenu(e, id) {
  e.stopPropagation();
  const dd = $('#dropdown');
  if (S.openMenu === id) { dd.innerHTML = ''; S.openMenu = null; return; }
  S.openMenu = id;
  const r = e.currentTarget.getBoundingClientRect();
  let html = '';
  if (id === 'profile') {
    html = `<div class="menu" style="top:${r.bottom + 6}px;right:${window.innerWidth - r.right}px">
      <button onclick="openProfile('${S.user.id}')">${avatarHTML(S.user.name, 32)}<span><b>${esc(S.user.name)}</b><br><span class="muted">See your profile</span></span></button>
      <hr>
      <button onclick="toggleDark()">🌙 Dark mode: ${S.dark ? 'On' : 'Off'}</button>
      ${S.user.isAdmin ? `<button onclick="location.href='admin.html'">🛠️ Admin Panel</button>` : ''}
      <button onclick="logout()">🚪 Log out</button>
    </div>`;
  } else if (id.startsWith('post_')) {
    const pid = id.slice(5); const p = postById(pid);
    const mine = p && p.authorId === S.user.id;
    html = `<div class="menu" style="top:${r.bottom + 4}px;right:${window.innerWidth - r.right}px;min-width:200px">
      ${mine ? `<button onclick="deletePost('${pid}')">🗑️ Delete post</button>` : ''}
      <button onclick="openReport('${pid}')">🚩 Report post</button>
      <button onclick="toast('Saved to your items')">🔖 Save post</button>
      <button onclick="toast('Link copied (demo)')">🔗 Copy link</button>
    </div>`;
  }
  dd.innerHTML = html;
}
function toggleDark() { S.dark = !S.dark; DB.set('dark', S.dark); renderApp(); }
function deletePost(pid) {
  if (!confirm('Delete this post?')) return;
  savePosts(getPosts().filter(p => p.id !== pid && p.sharedFrom !== pid));
  $('#dropdown').innerHTML = ''; S.openMenu = null;
  refreshPosts(); toast('Post deleted.');
}
function openReport(pid) {
  $('#dropdown').innerHTML = ''; S.openMenu = null;
  const reasons = ['Spam', 'Harassment', 'Hate speech', 'False information', 'Nudity', 'Something else'];
  openModal(`<h3>Report post</h3><p class="muted">Why are you reporting this?</p>
    ${reasons.map((r, i) => `<label class="radio"><input type="radio" name="rr" value="${r}" ${i === 0 ? 'checked' : ''}> ${r}</label>`).join('')}
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="submitReport('${pid}')">Submit report</button></div>`);
}
function submitReport(pid) {
  const reason = ($('input[name=rr]:checked') || {}).value || 'Other';
  const rs = getReports();
  rs.unshift({ id: uid('r'), postId: pid, reporterId: S.user.id, reason, ts: Date.now(), status: 'open' });
  saveReports(rs); closeModal(); toast('Thanks — our admins will review this.');
}

/* ---------------- Composer ---------------- */
const BG_SWATCHES = ['', 'bg-blue', 'bg-purple', 'bg-green', 'bg-orange', 'bg-teal', 'bg-pink'];
function openComposer() {
  S.composerBg = '';
  openModal(`<h3>Create post</h3>
    <div class="composer-user">${avatarHTML(S.user.name, 40)}<div><b>${esc(S.user.name)}</b><div class="muted">🌐 Public</div></div></div>
    <textarea id="cp_text" class="cp-text" placeholder="What's on your mind, ${esc(S.user.name.split(' ')[0])}?" rows="4"></textarea>
    <div class="swatches" id="cp_sw">${BG_SWATCHES.map(b => `<button class="sw ${b} ${b === '' ? 'sw-none sel' : ''}" onclick="pickBg('${b}',this)"></button>`).join('')}</div>
    <input id="cp_img" class="inp" placeholder="Image URL (optional)">
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="submitPost()">Post</button></div>`);
  setTimeout(() => $('#cp_text').focus(), 50);
}
function pickBg(b, el) {
  S.composerBg = b;
  $$('#cp_sw .sw').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
  $('#cp_text').className = 'cp-text big ' + b;
}
function submitPost() {
  const text = $('#cp_text').value.trim();
  const img = $('#cp_img').value.trim();
  if (!text && !img) { toast('Write something first.'); return; }
  const ps = getPosts();
  ps.unshift({ id: uid('p'), authorId: S.user.id, text, image: img || null, bg: S.composerBg || null, ts: Date.now(), likes: [], comments: [], shares: 0, pinned: false });
  savePosts(ps); closeModal(); refreshPosts(); window.scrollTo(0, 0); toast('Posted!');
}

/* ---------------- Profile ---------------- */
function profileHTML(uidv) {
  const u = userById(uidv); if (!u) return `<div class="card empty">User not found.</div>`;
  const mine = u.id === S.user.id;
  const following = (S.user.following || []).includes(u.id);
  const ups = feedPosts().filter(p => p.authorId === u.id);
  return `
  <div class="card profile-top">
    <div class="cover"></div>
    <div class="profile-row">
      ${avatarHTML(u.name, 120)}
      <div class="profile-info"><h2>${esc(u.name)}</h2>
        <div class="muted">${esc(u.bio || '')}</div>
        <div class="muted">${ups.length} posts · Joined ${new Date(u.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      </div>
      ${mine
        ? `<button class="btn-ghost" onclick="editProfile()">✏️ Edit profile</button>`
        : `<button class="${following ? 'btn-ghost' : 'btn-primary'}" onclick="toggleFollow('${u.id}')">${following ? '✓ Following' : '+ Follow'}</button>`}
    </div>
  </div>
  <div id="posts">${postsHTML(ups)}</div>`;
}
function toggleFollow(uidv) {
  const users = getUsers(); const meU = users.find(x => x.id === S.user.id);
  meU.following = meU.following || [];
  const i = meU.following.indexOf(uidv);
  if (i >= 0) meU.following.splice(i, 1); else meU.following.push(uidv);
  saveUsers(users); S.user = meU; renderView();
}
function editProfile() {
  openModal(`<h3>Edit profile</h3>
    <input id="ep_bio" class="inp" placeholder="Bio" value="${esc(S.user.bio || '')}">
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="saveProfile()">Save</button></div>`);
}
function saveProfile() {
  const users = getUsers(); const meU = users.find(x => x.id === S.user.id);
  meU.bio = $('#ep_bio').value.trim(); saveUsers(users); S.user = meU;
  closeModal(); renderView(); toast('Profile updated.');
}

/* ---------------- Friends / Search ---------------- */
function friendsHTML() {
  const others = getUsers().filter(u => u.id !== S.user.id && !u.banned);
  return `<div class="card"><h3>People you may know</h3><div class="people-grid">
    ${others.map(u => {
      const f = (S.user.following || []).includes(u.id);
      return `<div class="person">${avatarHTML(u.name, 64)}<b>${esc(u.name)}</b>
        <div class="muted">${esc(u.bio || '')}</div>
        <button class="${f ? 'btn-ghost' : 'btn-primary'}" onclick="toggleFollow('${u.id}');renderView()">${f ? 'Following' : 'Follow'}</button></div>`;
    }).join('')}
  </div></div>`;
}
function searchHTML() {
  const q = S.query.toLowerCase();
  const us = getUsers().filter(u => !u.banned && u.name.toLowerCase().includes(q));
  const ps = feedPosts().filter(p => (p.text || '').toLowerCase().includes(q));
  return `<div class="card"><h3>Results for "${esc(S.query)}"</h3>
    ${us.length ? `<div class="side-title">People</div>` + us.map(u =>
      `<button class="contact" onclick="openProfile('${u.id}')">${avatarHTML(u.name, 40)}<span><b>${esc(u.name)}</b><br><span class="muted">${esc(u.bio || '')}</span></span></button>`).join('') : ''}
    ${ps.length ? `<div class="side-title" style="margin-top:12px">Posts</div>` : ''}
  </div>${ps.length ? postsHTML(ps) : (us.length ? '' : `<div class="card empty">No results found.</div>`)}`;
}

/* ---------------- Notifications ---------------- */
function notifCount() {
  const mine = getPosts().filter(p => p.authorId === S.user.id);
  let n = 0;
  mine.forEach(p => { n += (p.comments || []).filter(c => c.authorId !== S.user.id).length; n += Math.min((p.likes || []).length, 3); });
  return Math.min(n, 9);
}
function toggleNotif(e) {
  e.stopPropagation();
  const dd = $('#dropdown');
  if (S.openMenu === 'notif') { dd.innerHTML = ''; S.openMenu = null; return; }
  S.openMenu = 'notif';
  const r = e.currentTarget.getBoundingClientRect();
  const items = [];
  getPosts().filter(p => p.authorId === S.user.id).forEach(p => {
    (p.comments || []).slice(-4).forEach(c => {
      const a = userById(c.authorId);
      if (a && a.id !== S.user.id) items.push({ ts: c.ts, html: `${avatarHTML(a.name, 40)}<div><b>${esc(a.name)}</b> commented: "${esc(c.text.slice(0, 60))}"<div class="muted">${timeAgo(c.ts)}</div></div>` });
    });
    (p.likes || []).slice(0, 2).forEach(lid => {
      const a = userById(lid);
      if (a && a.id !== S.user.id) items.push({ ts: p.ts, html: `${avatarHTML(a.name, 40)}<div><b>${esc(a.name)}</b> liked your post.<div class="muted">${timeAgo(p.ts)}</div></div>` });
    });
  });
  items.sort((a, b) => b.ts - a.ts);
  dd.innerHTML = `<div class="menu notif-menu" style="top:${r.bottom + 6}px;right:${Math.max(8, window.innerWidth - r.right - 200)}px">
    <div class="notif-head"><b>Notifications</b></div>
    ${items.length ? items.slice(0, 10).map(i => `<div class="notif">${i.html}</div>`).join('') : '<div class="notif muted">No new notifications.</div>'}
  </div>`;
}

/* ---------------- Maintenance ---------------- */
function renderMaintenance() {
  const st = getSettings();
  document.getElementById('root').innerHTML = `
    <div class="maint"><div class="brand-big">${esc(st.siteName)}</div>
    <h2>We'll be back soon 🛠️</h2><p class="muted">The site is under maintenance. Please check back later.</p></div>`;
}

document.addEventListener('DOMContentLoaded', init);
