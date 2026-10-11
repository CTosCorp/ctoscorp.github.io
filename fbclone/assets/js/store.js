/* ============================================================
   FaceClone — shared UI helpers (no storage; data is Supabase)
   ============================================================ */
const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function timeAgo(ts) {
  const t = new Date(ts).getTime();
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'Just now';
  const m = s / 60; if (m < 60) return Math.floor(m) + 'm';
  const h = m / 60; if (h < 24) return Math.floor(h) + 'h';
  const d = h / 24; if (d < 7) return Math.floor(d) + 'd';
  const w = d / 7; if (w < 5) return Math.floor(w) + 'w';
  return new Date(t).toLocaleDateString();
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
function avatarHTML(name, size, attrs, url) {
  size = size || 40;
  const dims = `width:${size}px;height:${size}px;`;
  const fs = Math.round(size * 0.38);
  // initials always rendered underneath; photo (if any) covers them,
  // and removes itself if it fails to load (revealing initials)
  const img = url
    ? `<img src="${esc(url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onerror="this.remove()">`
    : '';
  return `<div class="avatar" style="${dims}font-size:${fs}px;background:${avColor(name)}" ${attrs || ''}>` +
    `${esc(initials(name))}${img}</div>`;
}
// convenience: pass a profile object directly
function pav(profile, size, attrs) {
  profile = profile || {};
  return avatarHTML(profile.name, size, attrs, profile.avatar_url);
}
