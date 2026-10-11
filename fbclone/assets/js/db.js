/* ============================================================
   FaceClone — Supabase data layer (db.js)
   Requires: config.js (SUPABASE_URL / KEY) + supabase-js UMD.
   All realtime subscriptions go through onTable().
   ============================================================ */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let ME = null; // current user's profiles row

/* ---------------- Auth ---------------- */
async function bootSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) ME = await fetchMyProfile();
  sb.auth.onAuthStateChange(async (_ev, s) => {
    if (s) { ME = await fetchMyProfile(); }
    else ME = null;
  });
  return ME;
}
async function fetchMyProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  return data || null;
}
async function signUp(name, email, password) {
  const { error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw error;
  for (let i = 0; i < 10; i++) {           // wait for profile trigger
    await new Promise(r => setTimeout(r, 500));
    ME = await fetchMyProfile();
    if (ME) break;
  }
  if (!ME) throw new Error('Profile not created yet — try logging in.');
  return ME;
}
async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  ME = await fetchMyProfile();
  if (ME && ME.banned) { await sb.auth.signOut(); ME = null; throw new Error('This account has been banned.'); }
  return ME;
}
async function signOut() { await sb.auth.signOut(); ME = null; }

/* ---------------- Posts ---------------- */
async function getFeed(limit = 60) {
  const { data: posts, error } = await sb.from('posts').select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts(posts || []);
}

async function hydratePosts(posts) {
  if (!posts.length) return [];
  const ids = posts.map(p => p.id);
  const authorIds = [...new Set(posts.map(p => p.author_id))];
  const sharedIds = [...new Set(posts.map(p => p.shared_from).filter(Boolean))];
  const [profsR, likesR, commentsR, sharedR] = await Promise.all([
    sb.from('profiles').select('id,name,bio,banned,avatar_url').in('id', authorIds),
    sb.from('likes').select('post_id,user_id').in('post_id', ids),
    sb.from('comments').select('id,post_id,text,created_at,author_id').in('post_id', ids).order('created_at', { ascending: true }),
    sharedIds.length ? sb.from('posts').select('*').in('id', sharedIds) : Promise.resolve({ data: [] }),
  ]);
  const profs = profsR.data || [], likes = likesR.data || [],
        comments = commentsR.data || [], shared = sharedR.data || [];
  const pmap = Object.fromEntries(profs.map(p => [p.id, p]));
  const cAuthorIds = [...new Set(comments.map(c => c.author_id))];
  let cmap = {};
  if (cAuthorIds.length) {
    const { data: cprofs } = await sb.from('profiles').select('id,name,avatar_url').in('id', cAuthorIds);
    cmap = Object.fromEntries((cprofs || []).map(p => [p.id, p]));
  }
  const sharedMap = {};
  for (const s of shared) {
    let sa = pmap[s.author_id];
    if (!sa) {
      const r = await sb.from('profiles').select('id,name,bio,banned,avatar_url').eq('id', s.author_id).single();
      sa = r.data;
    }
    sharedMap[s.id] = { ...s, author: sa || { name: '?', banned: false } };
  }
  return posts.map(p => ({
    ...p,
    author: pmap[p.author_id] || { name: '?', banned: false },
    likeCount: likes.filter(l => l.post_id === p.id).length,
    likedByMe: !!ME && likes.some(l => l.post_id === p.id && l.user_id === ME.id),
    comments: comments.filter(c => c.post_id === p.id)
      .map(c => ({ ...c, author: cmap[c.author_id] || { name: '?' } })),
    shared: p.shared_from ? (sharedMap[p.shared_from] || null) : null,
  }));
}

async function createPost({ text, image_url, bg, shared_from }) {
  const { data, error } = await sb.from('posts').insert({
    author_id: ME.id, text: text || '', image_url: image_url || null,
    bg: bg || null, shared_from: shared_from || null,
  }).select().single();
  if (error) throw error;
  return data;
}
async function deletePost(id) {
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) throw error;
}
async function setPinned(id, pinned) {
  const { error } = await sb.from('posts').update({ pinned }).eq('id', id);
  if (error) throw error;
}
async function toggleLike(post) {
  if (post.likedByMe) {
    const { error } = await sb.from('likes').delete().eq('post_id', post.id).eq('user_id', ME.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('likes').insert({ post_id: post.id, user_id: ME.id });
    if (error) throw error;
    if (post.author_id !== ME.id)
      await notify(post.author_id, 'like', post.id, `${ME.name} liked your post.`);
  }
}
async function addComment(post, text) {
  const { data, error } = await sb.from('comments')
    .insert({ post_id: post.id, author_id: ME.id, text }).select().single();
  if (error) throw error;
  if (post.author_id !== ME.id)
    await notify(post.author_id, 'comment', post.id, `${ME.name} commented: "${text.slice(0, 60)}"`);
  return data;
}

/* ---------------- Social ---------------- */
async function toggleFollow(targetId) {
  const { data } = await sb.from('follows')
    .select('*').eq('follower_id', ME.id).eq('following_id', targetId);
  if (data && data.length) {
    await sb.from('follows').delete().eq('follower_id', ME.id).eq('following_id', targetId);
    return false;
  }
  const { error } = await sb.from('follows').insert({ follower_id: ME.id, following_id: targetId });
  if (error) throw error;
  await notify(targetId, 'follow', null, `${ME.name} started following you.`);
  return true;
}
async function followingIds() {
  const { data } = await sb.from('follows').select('following_id').eq('follower_id', ME.id);
  return (data || []).map(f => f.following_id);
}
async function getUsersList(query = '') {
  let q = sb.from('profiles').select('id,name,bio,avatar_url,created_at,banned,is_admin')
    .eq('banned', false).neq('id', ME.id).order('created_at', { ascending: false }).limit(60);
  if (query) q = q.ilike('name', `%${query}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
async function getProfilePage(id) {
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  const { data: posts } = await sb.from('posts').select('*').eq('author_id', id)
    .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(40);
  const hydrated = await hydratePosts(posts || []);
  const { count: followers } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id);
  return { profile, posts: hydrated, followers: followers || 0 };
}
async function updateBio(bio) {
  const { error } = await sb.from('profiles').update({ bio }).eq('id', ME.id);
  if (error) throw error;
  ME.bio = bio;
}
async function searchAll(q) {
  const [u, p] = await Promise.all([
    sb.from('profiles').select('id,name,bio,avatar_url').eq('banned', false).ilike('name', `%${q}%`).limit(20),
    sb.from('posts').select('*').ilike('text', `%${q}%`).order('created_at', { ascending: false }).limit(30),
  ]);
  return { users: u.data || [], posts: await hydratePosts(p.data || []) };
}

/* ---------------- Reports / notifications ---------------- */
async function reportPost(post_id, reason) {
  const { error } = await sb.from('reports').insert({ post_id, reporter_id: ME.id, reason });
  if (error) throw error;
}
async function notify(user_id, type, post_id, message) {
  await sb.from('notifications').insert({ user_id, actor_id: ME.id, type, post_id, message });
}
async function getNotifications(limit = 20) {
  const { data, error } = await sb.from('notifications').select('*')
    .eq('user_id', ME.id).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  const actorIds = [...new Set((data || []).map(n => n.actor_id).filter(Boolean))];
  let amap = {};
  if (actorIds.length) {
    const { data: actors } = await sb.from('profiles').select('id,name,avatar_url').in('id', actorIds);
    amap = Object.fromEntries((actors || []).map(a => [a.id, a]));
  }
  return (data || []).map(n => ({ ...n, actor: amap[n.actor_id] || { name: 'Someone' } }));
}
async function unreadNotifCount() {
  const { count } = await sb.from('notifications').select('*', { count: 'exact', head: true })
    .eq('user_id', ME.id).eq('read', false);
  return count || 0;
}
async function markNotifsRead() {
  await sb.from('notifications').update({ read: true }).eq('user_id', ME.id).eq('read', false);
}

/* ---------------- Storage ---------------- */
async function uploadImage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').slice(0, 5);
  const path = `${ME.id}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { upsert: false });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/* ---------------- Settings ---------------- */
async function getSettings() {
  const { data } = await sb.from('settings').select('*').eq('id', 1).single();
  return data || { site_name: 'FaceClone' };
}
async function saveSettings(patch) {
  const { error } = await sb.from('settings').update(patch).eq('id', 1);
  if (error) throw error;
}

/* ---------------- Admin ---------------- */
async function adminGetUsers() {
  const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const { data: posts } = await sb.from('posts').select('author_id');
  const counts = {};
  (posts || []).forEach(p => { counts[p.author_id] = (counts[p.author_id] || 0) + 1; });
  return (users || []).map(u => ({ ...u, postCount: counts[u.id] || 0 }));
}
async function adminSetUser(id, patch) {
  const { error } = await sb.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}
async function adminWipeUser(id) {
  // delete all posts (cascades comments/likes), then ban the profile
  const { error: e1 } = await sb.from('posts').delete().eq('author_id', id);
  if (e1) throw e1;
  const { error: e2 } = await sb.from('profiles').update({ banned: true, is_admin: false }).eq('id', id);
  if (e2) throw e2;
}
async function adminGetPosts() {
  const { data: posts, error } = await sb.from('posts').select('*')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const hydrated = await hydratePosts(posts || []);
  return hydrated;
}
async function adminGetReports() {
  const { data: reps, error } = await sb.from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const ids = [...new Set([
    ...(reps || []).map(r => r.reporter_id).filter(Boolean),
  ])];
  const postIds = [...new Set((reps || []).map(r => r.post_id).filter(Boolean))];
  const [usersR, postsR] = await Promise.all([
    ids.length ? sb.from('profiles').select('id,name').in('id', ids) : Promise.resolve({ data: [] }),
    postIds.length ? sb.from('posts').select('id,text,author_id').in('id', postIds) : Promise.resolve({ data: [] }),
  ]);
  const umap = Object.fromEntries((usersR.data || []).map(u => [u.id, u]));
  const auIds = [...new Set((postsR.data || []).map(p => p.author_id))];
  let aumap = {};
  if (auIds.length) {
    const { data: aus } = await sb.from('profiles').select('id,name').in('id', auIds);
    aumap = Object.fromEntries((aus || []).map(u => [u.id, u]));
  }
  const pmap = Object.fromEntries((postsR.data || []).map(p => [p.id, { ...p, author: aumap[p.author_id] || { name: '?' } }]));
  return (reps || []).map(r => ({
    ...r,
    reporter: umap[r.reporter_id] || { name: '?' },
    post: r.post_id ? (pmap[r.post_id] || null) : null,
  }));
}
async function adminResolveReport(id, status) {
  const { error } = await sb.from('reports').update({ status }).eq('id', id);
  if (error) throw error;
}
async function adminStats() {
  const [u, p, c, l, r] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('posts').select('*', { count: 'exact', head: true }),
    sb.from('comments').select('*', { count: 'exact', head: true }),
    sb.from('likes').select('*', { count: 'exact', head: true }),
    sb.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);
  return { users: u.count || 0, posts: p.count || 0, comments: c.count || 0, likes: l.count || 0, openReports: r.count || 0 };
}
async function adminPostsPerDay() {
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
  const { data } = await sb.from('posts').select('created_at').gte('created_at', since.toISOString());
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0, key: d.toDateString() });
  }
  (data || []).forEach(p => {
    const k = new Date(p.created_at).toDateString();
    const d = days.find(x => x.key === k);
    if (d) d.count++;
  });
  return days;
}
async function seedDemoPosts() {
  const pic = (s, w, h) => `https://picsum.photos/seed/${s}/${w || 640}/${h || 360}`;
  const demo = [
    { text: "Sunset at Cox's Bazar never disappoints 🌅", image_url: pic('fc-cox'), bg: null },
    { text: 'Shipped my first open-source project today. 200 stars overnight! 🚀', image_url: null, bg: 'bg-blue' },
    { text: 'Homemade biryani night 🍚 Recipe in comments 👇', image_url: pic('fc-biryani'), bg: null },
    { text: 'Bangladesh wins by 6 wickets! What a chase!! 🏏🔥', image_url: null, bg: 'bg-green' },
    { text: 'Golden hour hits different in the village 🌾', image_url: pic('fc-village'), bg: null },
    { text: 'Monday motivation: small steps every day 💪', image_url: null, bg: 'bg-orange' },
    { text: 'TIL: honey never spoils. 3000-year-old honey found in Egyptian tombs — still edible 🍯', image_url: null, bg: 'bg-teal' },
    { text: 'Morning mist over the tea gardens 🍃', image_url: pic('fc-tea'), bg: null },
  ];
  for (const d of demo) {
    // eslint-disable-next-line no-await-in-loop
    await sb.from('posts').insert({ author_id: ME.id, ...d });
  }
}

/* ---------------- Profile extras ---------------- */
async function uploadToMedia(file, folder) {
  const ext = (file.name.split('.').pop() || 'jpg').slice(0, 5);
  const path = `${ME.id}/${folder}_${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { upsert: false });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
async function updateProfile(patch) {
  const { error } = await sb.from('profiles').update(patch).eq('id', ME.id);
  if (error) throw error;
  Object.assign(ME, patch);
}
async function getUserPhotos(uid) {
  const { data, error } = await sb.from('posts').select('id,image_url,created_at')
    .eq('author_id', uid).not('image_url', 'is', null)
    .order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  return data || [];
}
async function getFollowers(uid) {
  const { data } = await sb.from('follows').select('follower_id').eq('following_id', uid);
  const ids = (data || []).map(f => f.follower_id);
  if (!ids.length) return [];
  const { data: profs } = await sb.from('profiles').select('id,name,bio,avatar_url').in('id', ids);
  return profs || [];
}
async function getFollowing(uid) {
  const { data } = await sb.from('follows').select('following_id').eq('follower_id', uid);
  const ids = (data || []).map(f => f.following_id);
  if (!ids.length) return [];
  const { data: profs } = await sb.from('profiles').select('id,name,bio,avatar_url').in('id', ids);
  return profs || [];
}

/* ---------------- Stories ---------------- */
async function getStories() {
  const { data, error } = await sb.from('stories').select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  const authorIds = [...new Set((data || []).map(s => s.author_id))];
  let amap = {};
  if (authorIds.length) {
    const { data: profs } = await sb.from('profiles').select('id,name,avatar_url').in('id', authorIds);
    amap = Object.fromEntries((profs || []).map(p => [p.id, p]));
  }
  return (data || []).map(s => ({ ...s, author: amap[s.author_id] || { name: '?' } }));
}
async function createStory({ image_url, text, bg }) {
  const { data, error } = await sb.from('stories').insert({
    author_id: ME.id, image_url: image_url || null, text: text || '', bg: bg || null,
  }).select().single();
  if (error) throw error;
  return data;
}
async function deleteStory(id) {
  const { error } = await sb.from('stories').delete().eq('id', id);
  if (error) throw error;
}
async function cleanupMyStories() {
  try {
    await sb.from('stories').delete()
      .lt('expires_at', new Date().toISOString()).eq('author_id', ME.id);
  } catch (e) { /* ignore */ }
}

/* ---------------- Realtime ---------------- */
function onTable(table, cb, filter) {
  const ch = sb.channel('rt-' + table + '-' + Math.random().toString(36).slice(2, 8));
  const cfg = { event: '*', schema: 'public', table };
  if (filter) cfg.filter = filter;
  ch.on('postgres_changes', cfg, cb).subscribe();
  return ch;
}
function debounce(fn, ms) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}
