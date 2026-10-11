/* ============================================================
   FaceClone — Admin Panel
   Demo-grade auth: client-side only. For a production site this
   needs a real backend. Default login: admin@faceclone.local
   ============================================================ */
seedDB();

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
let TAB = 'dashboard';
let userQuery = '';

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
function isAuthed() { return sessionStorage.getItem('fbclone_admin') === '1'; }
function adminUser() { return userById(DB.get('admin_uid', '')); }

/* ---------------- Login ---------------- */
function renderLogin() {
  const st = getSettings();
  $('#root').innerHTML = `
  <div class="a-login-wrap">
    <div class="a-login-card">
      <div class="a-brand">${esc(st.siteName)} <span>Admin</span></div>
      <p class="muted">Sign in to manage your community</p>
      <input id="a_email" class="inp" type="email" placeholder="Admin email" autocomplete="username">
      <input id="a_pass" class="inp" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')doAdminLogin()" autocomplete="current-password">
      <button class="btn-primary" onclick="doAdminLogin()">Log in</button>
      <div class="demo-note">Default: <b>admin@faceclone.local</b> / <b>${esc(st.adminPass || 'admin123')}</b><br>
      (Admin users promoted in the Users tab can also log in with their own password.)</div>
      <div class="auth-link"><a href="index.html">← Back to site</a></div>
    </div>
  </div>`;
}
function doAdminLogin() {
  const email = $('#a_email').value.trim().toLowerCase();
  const pass = $('#a_pass').value;
  const st = getSettings();
  if (email === 'admin@faceclone.local' && pass === (st.adminPass || 'admin123')) {
    sessionStorage.setItem('fbclone_admin', '1'); DB.set('admin_uid', '');
    renderPanel(); return;
  }
  const u = getUsers().find(x => x.email.toLowerCase() === email && x.password === pass && x.isAdmin && !x.banned);
  if (u) {
    sessionStorage.setItem('fbclone_admin', '1'); DB.set('admin_uid', u.id);
    renderPanel(); return;
  }
  toast('Invalid admin credentials.');
}
function adminLogout() {
  sessionStorage.removeItem('fbclone_admin');
  renderLogin();
}

/* ---------------- Shell ---------------- */
const TABS = [
  ['dashboard', '📊 Dashboard'], ['users', '👥 Users'], ['posts', '📰 Posts'],
  ['reports', '🚩 Reports'], ['settings', '⚙️ Settings'],
];
function renderPanel() {
  document.title = 'Admin — ' + getSettings().siteName;
  $('#root').innerHTML = `
  <div class="a-shell">
    <aside class="a-side">
      <div class="a-brand">${esc(getSettings().siteName)} <span>Admin</span></div>
      <nav>${TABS.map(([id, label]) =>
        `<button class="a-nav ${TAB === id ? 'active' : ''}" onclick="goTab('${id}')">${label}
         ${id === 'reports' && openReports() ? `<span class="a-pill">${openReports()}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="a-side-foot">
        <button class="a-nav" onclick="location.href='index.html'">🌐 View site</button>
        <button class="a-nav" onclick="adminLogout()">🚪 Log out</button>
      </div>
    </aside>
    <div class="a-main">
      <div class="a-top"><h2>${TABS.find(t => t[0] === TAB)[1]}</h2>
        <div class="a-admin">${avatarHTML(adminUser() ? adminUser().name : 'Admin', 32)}<span>${esc(adminUser() ? adminUser().name : 'Super Admin')}</span></div>
      </div>
      <div class="a-content" id="a_content"></div>
    </div>
  </div>`;
  renderTab();
}
function goTab(id) { TAB = id; renderPanel(); }
function openReports() { return getReports().filter(r => r.status === 'open').length; }

/* ---------------- Dashboard ---------------- */
function renderTab() {
  const c = $('#a_content');
  if (TAB === 'dashboard') c.innerHTML = dashHTML();
  else if (TAB === 'users') c.innerHTML = usersHTML();
  else if (TAB === 'posts') c.innerHTML = postsHTML();
  else if (TAB === 'reports') c.innerHTML = reportsHTML();
  else if (TAB === 'settings') c.innerHTML = settingsHTML();
  if (TAB === 'dashboard') drawChart();
}
function dashHTML() {
  const users = getUsers(), posts = getPosts();
  const stats = [
    ['👥', users.length, 'Total users'],
    ['📰', posts.length, 'Total posts'],
    ['💬', totalComments(), 'Comments'],
    ['👍', totalLikes(), 'Likes'],
    ['🚩', openReports(), 'Open reports'],
    ['🚫', users.filter(u => u.banned).length, 'Banned users'],
  ];
  const recent = [...posts].sort((a, b) => b.ts - a.ts).slice(0, 5);
  return `
  <div class="stat-grid">${stats.map(([ico, n, label]) =>
    `<div class="stat"><div class="stat-ico">${ico}</div><div class="stat-n">${n}</div><div class="stat-l">${label}</div></div>`).join('')}
  </div>
  <div class="a-row">
    <div class="a-card grow"><h3>Posts — last 7 days</h3><canvas id="chart" width="520" height="220"></canvas></div>
    <div class="a-card grow"><h3>Recent posts</h3>
      ${recent.map(p => { const a = userById(p.authorId); return `
        <div class="recent-row">${avatarHTML(a ? a.name : '?', 32)}
          <div><b>${esc(a ? a.name : '?')}</b><div class="muted">${esc((p.text || '(image post)').slice(0, 70))} · ${timeAgo(p.ts)}</div></div>
        </div>`; }).join('') || '<div class="muted">No posts.</div>'}
    </div>
  </div>`;
}
function drawChart() {
  const cv = $('#chart'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, pad = 34;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    days.push(d);
  }
  const counts = days.map(d => {
    const s = d.getTime(), e = s + 864e5;
    return getPosts().filter(p => p.ts >= s && p.ts < e).length;
  });
  const max = Math.max(...counts, 1);
  ctx.clearRect(0, 0, W, H);
  const bw = (W - pad * 2) / 7;
  days.forEach((d, i) => {
    const h = (H - pad * 2 - 20) * (counts[i] / max);
    const x = pad + i * bw + bw * 0.2, y = H - pad - h;
    ctx.fillStyle = '#1877F2';
    ctx.beginPath(); ctx.roundRect(x, y, bw * 0.6, h, 4); ctx.fill();
    ctx.fillStyle = '#65676B'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.toLocaleDateString(undefined, { weekday: 'short' }), x + bw * 0.3, H - pad + 14);
    if (counts[i]) ctx.fillText(counts[i], x + bw * 0.3, y - 6);
  });
}

/* ---------------- Users ---------------- */
function usersHTML() {
  const q = userQuery.toLowerCase();
  const users = getUsers().filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  return `
  <div class="a-card">
    <div class="a-toolbar">
      <input class="inp" style="max-width:280px" placeholder="Search users..." value="${esc(userQuery)}"
        oninput="userQuery=this.value;refreshUsersTable()">
      <span class="muted">${users.length} users</span>
    </div>
    <div class="tbl-wrap"><table class="tbl" id="usersTbl"><thead><tr>
      <th>User</th><th>Email</th><th>Joined</th><th>Posts</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>${usersRows(users)}</tbody></table></div>
  </div>`;
}
function usersRows(users) {
  return users.map(u => {
    const pc = getPosts().filter(p => p.authorId === u.id).length;
    return `<tr>
      <td><div class="cell-user">${avatarHTML(u.name, 32)}<b>${esc(u.name)}</b>${u.isAdmin ? ' <span class="tag admin-tag">ADMIN</span>' : ''}</div></td>
      <td class="muted">${esc(u.email)}</td>
      <td class="muted">${new Date(u.joined).toLocaleDateString()}</td>
      <td>${pc}</td>
      <td>${u.banned ? '<span class="tag ban-tag">BANNED</span>' : '<span class="tag ok-tag">ACTIVE</span>'}</td>
      <td class="actions">
        <button class="mini" onclick="toggleBan('${u.id}')">${u.banned ? 'Unban' : 'Ban'}</button>
        <button class="mini" onclick="toggleAdmin('${u.id}')">${u.isAdmin ? 'Demote' : 'Make admin'}</button>
        <button class="mini danger" onclick="deleteUser('${u.id}')">Delete</button>
      </td></tr>`;
  }).join('');
}
function refreshUsersTable() {
  const q = userQuery.toLowerCase();
  const users = getUsers().filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  $('#usersTbl tbody').innerHTML = usersRows(users);
}
function toggleBan(id) {
  const users = getUsers(); const u = users.find(x => x.id === id);
  u.banned = !u.banned; saveUsers(users); renderTab();
  toast(u.banned ? u.name + ' banned.' : u.name + ' unbanned.');
}
function toggleAdmin(id) {
  const users = getUsers(); const u = users.find(x => x.id === id);
  if (u.banned) { toast('Unban the user first.'); return; }
  u.isAdmin = !u.isAdmin; saveUsers(users); renderTab();
  toast(u.isAdmin ? u.name + ' is now an admin.' : u.name + ' demoted.');
}
function deleteUser(id) {
  const u = userById(id);
  if (!confirm(`Delete ${u.name} and all their posts?`)) return;
  saveUsers(getUsers().filter(x => x.id !== id));
  savePosts(getPosts().filter(p => p.authorId !== id));
  renderTab(); toast('User deleted.');
}

/* ---------------- Posts ---------------- */
function postsHTML() {
  const posts = [...getPosts()].sort((a, b) => b.ts - a.ts);
  return `<div class="a-card"><div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th>Post</th><th>Author</th><th>Likes</th><th>Comments</th><th>Date</th><th>Actions</th>
  </tr></thead><tbody>
  ${posts.map(p => { const a = userById(p.authorId); return `<tr>
    <td><div class="post-cell">${p.pinned ? '<span class="tag pin-tag2">PINNED</span> ' : ''}${esc((p.text || (p.image ? '[image]' : '[shared]')).slice(0, 80))}</div></td>
    <td><div class="cell-user">${avatarHTML(a ? a.name : '?', 28)}${esc(a ? a.name : '?')}</div></td>
    <td>${(p.likes || []).length}</td><td>${(p.comments || []).length}</td>
    <td class="muted">${fullDate(p.ts)}</td>
    <td class="actions">
      <button class="mini" onclick="togglePin('${p.id}')">${p.pinned ? 'Unpin' : 'Pin'}</button>
      <button class="mini danger" onclick="adminDeletePost('${p.id}')">Delete</button>
    </td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">No posts.</td></tr>'}
  </tbody></table></div></div>`;
}
function togglePin(id) {
  const ps = getPosts(); const p = ps.find(x => x.id === id);
  p.pinned = !p.pinned; savePosts(ps); renderTab();
  toast(p.pinned ? 'Post pinned to top of feed.' : 'Post unpinned.');
}
function adminDeletePost(id) {
  if (!confirm('Delete this post?')) return;
  savePosts(getPosts().filter(p => p.id !== id && p.sharedFrom !== id));
  const rs = getReports().map(r => r.postId === id ? { ...r, status: 'resolved' } : r);
  saveReports(rs); renderPanel(); toast('Post deleted.');
}

/* ---------------- Reports ---------------- */
function reportsHTML() {
  const rs = [...getReports()].sort((a, b) => b.ts - a.ts);
  return `<div class="a-card">
    ${rs.length ? rs.map(r => {
      const p = postById(r.postId); const rep = userById(r.reporterId); const a = p && userById(p.authorId);
      return `<div class="report ${r.status}">
        <div><b>${esc(rep ? rep.name : '?')}</b> reported ${a ? `<b>${esc(a.name)}</b>'s post` : 'a deleted post'}
          <span class="tag">${esc(r.reason)}</span>
          <div class="muted">${p ? '“' + esc((p.text || '[image post]').slice(0, 120)) + '”' : '(post deleted)'} · ${timeAgo(r.ts)}</div>
        </div>
        ${r.status === 'open' ? `<div class="actions">
          <button class="mini" onclick="resolveReport('${r.id}')">Dismiss</button>
          ${p ? `<button class="mini danger" onclick="reportDeletePost('${r.id}')">Delete post</button>
          <button class="mini danger" onclick="reportBanAuthor('${r.id}')">Ban author</button>` : ''}
        </div>` : '<span class="tag ok-tag">RESOLVED</span>'}
      </div>`;
    }).join('') : '<div class="muted">No reports. 🎉</div>'}
  </div>`;
}
function setReport(id, status) {
  saveReports(getReports().map(r => r.id === id ? { ...r, status } : r));
}
function resolveReport(id) { setReport(id, 'resolved'); renderTab(); toast('Report dismissed.'); }
function reportDeletePost(id) {
  const r = getReports().find(x => x.id === id);
  if (!confirm('Delete the reported post?')) return;
  savePosts(getPosts().filter(p => p.id !== r.postId && p.sharedFrom !== r.postId));
  setReport(id, 'resolved'); renderPanel(); toast('Post deleted.');
}
function reportBanAuthor(id) {
  const r = getReports().find(x => x.id === id);
  const p = postById(r.postId); if (!p) return;
  const users = getUsers(); const u = users.find(x => x.id === p.authorId);
  if (!confirm(`Ban ${u.name}?`)) return;
  u.banned = true; saveUsers(users);
  setReport(id, 'resolved'); renderPanel(); toast(u.name + ' banned.');
}

/* ---------------- Settings ---------------- */
function settingsHTML() {
  const st = getSettings();
  return `<div class="a-row">
  <div class="a-card grow"><h3>General</h3>
    <label class="lbl">Site name</label>
    <input id="s_name" class="inp" value="${esc(st.siteName)}">
    <label class="lbl">Tagline</label>
    <input id="s_tag" class="inp" value="${esc(st.tagline || '')}">
    <label class="check"><input type="checkbox" id="s_reg" ${st.regOpen ? 'checked' : ''}> Allow new registrations</label>
    <label class="check"><input type="checkbox" id="s_maint" ${st.maintenance ? 'checked' : ''}> Maintenance mode (visitors see a notice)</label>
    <button class="btn-primary" style="margin-top:12px" onclick="saveSiteSettings()">Save settings</button>
  </div>
  <div class="a-card grow"><h3>Security</h3>
    <label class="lbl">New super-admin password</label>
    <input id="s_pass" class="inp" type="password" placeholder="Leave blank to keep current">
    <button class="btn-ghost" onclick="changeAdminPass()">Change password</button>
    <h3 style="margin-top:24px">Danger zone</h3>
    <p class="muted">Reset all demo data (users, posts, reports) back to the original seed.</p>
    <button class="mini danger" onclick="resetData()">Reset demo data</button>
  </div></div>`;
}
function saveSiteSettings() {
  const st = getSettings();
  st.siteName = $('#s_name').value.trim() || 'FaceClone';
  st.tagline = $('#s_tag').value.trim();
  st.regOpen = $('#s_reg').checked;
  st.maintenance = $('#s_maint').checked;
  saveSettings(st); renderPanel(); toast('Settings saved.');
}
function changeAdminPass() {
  const v = $('#s_pass').value;
  if (!v) { toast('Enter a new password first.'); return; }
  const st = getSettings(); st.adminPass = v; saveSettings(st);
  $('#s_pass').value = ''; toast('Admin password changed.');
}
function resetData() {
  if (!confirm('Reset ALL data to the original demo seed?')) return;
  Object.keys(localStorage).filter(k => k.startsWith('fbclone_')).forEach(k => localStorage.removeItem(k));
  seedDB(); renderPanel(); toast('Demo data reset.');
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('admin-body');
  if (isAuthed()) renderPanel(); else renderLogin();
});
