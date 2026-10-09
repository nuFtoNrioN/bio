// BIO worker: trang công khai + API đọc + raw script + đếm thống kê.
// Không có bất kỳ route ghi dữ liệu admin nào ở đây.
const TZ_OFFSET_HOURS = 7; // múi giờ chia thống kê theo ngày (phải giống bên dash)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === '/api/site' && method === 'GET') return await publicSite(env);

      if (path === '/api/hit' && method === 'POST') {
        let ref = '';
        try { ref = String((await request.json()).ref || ''); } catch (e) { /* không có nguồn */ }
        ctx.waitUntil(bump(env, 'view', undefined, request, ref));
        return new Response(null, { status: 204 });
      }

      let m = path.match(/^\/api\/copy\/([a-z0-9-]{2,40})$/);
      if (m && method === 'POST') {
        ctx.waitUntil(bump(env, 'copy', m[1], request));
        return new Response(null, { status: 204 });
      }

      m = path.match(/^\/api\/preview\/([a-z0-9-]{2,40})$/);
      if (m && method === 'GET') return await previewOf(env, m[1]);

      m = path.match(/^\/api\/code\/([a-z0-9-]{2,40})$/);
      if (m && method === 'GET') return await codeOf(env, ctx, m[1], request);

      const sm = path.match(/^\/s\/([a-z0-9-]{2,40})$/);
      if (path === '/' || sm) return await homePage(request, env, sm ? sm[1] : undefined);

      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      return json({ error: 'Server error' }, 500);
    }
  },
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

function today() {
  return new Date(Date.now() + TZ_OFFSET_HOURS * 3600e3).toISOString().slice(0, 10);
}

// Chống spam số liệu: mỗi IP (đã băm, đổi mỗi ngày) chỉ được tính tối đa N lần/ngày cho mỗi loại.
// Không chặn truy cập, chỉ không cộng thêm vào số liệu.
async function allow(env, request, kind, ref, limit) {
  const day = today();
  const ip = (request && request.headers.get('CF-Connecting-IP')) || 'x';
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + day)));
  const who = [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    const r = await env.DB.prepare('INSERT INTO rate_limits (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n')
      .bind(day + '|' + kind + '|' + (ref || '') + '|' + who, day).first();
    return r.n <= limit;
  } catch (e) { return true; } // chưa chạy migration 005 thì không chặn
}

function refHost(ref, request) {
  try { const h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase().slice(0, 60); return !h || h === new URL(request.url).hostname ? 'direct' : h; } catch (e) { return 'direct'; }
}

async function bump(env, kind, scriptId, request, ref) {
  if (!(await allow(env, request, kind, scriptId, { view: 3, copy: 5, run: 40 }[kind]))) return;
  if (kind === 'view' && Math.random() < 0.02) {
    try { await env.DB.prepare('DELETE FROM rate_limits WHERE day < ?').bind(new Date(Date.now() + TZ_OFFSET_HOURS * 3600e3 - 3 * 864e5).toISOString().slice(0, 10)).run(); } catch (e) { /* bỏ qua */ }
  }
  const stmts = [
    env.DB.prepare(
      'INSERT INTO daily_stats (day, kind, count) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1'
    ).bind(today(), kind),
  ];
  if (scriptId && kind === 'copy') stmts.push(env.DB.prepare('UPDATE scripts SET copies = copies + 1 WHERE id = ?').bind(scriptId));
  if (scriptId && kind === 'run') stmts.push(env.DB.prepare('UPDATE scripts SET runs = runs + 1 WHERE id = ?').bind(scriptId));
  try { await env.DB.batch(stmts); } catch (e) { console.error('bump', e); }
  try { // thống kê chi tiết; bỏ qua nếu chưa chạy migration 007
    const day = today(), ex = [];
    if (scriptId && (kind === 'copy' || kind === 'run')) ex.push(env.DB.prepare('INSERT INTO script_stats (day, script_id, kind, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, script_id, kind) DO UPDATE SET count = count + 1').bind(day, scriptId, kind));
    if (kind === 'view') {
      const up = 'INSERT INTO visit_stats (day, dim, value, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, dim, value) DO UPDATE SET count = count + 1';
      const ua = (request && request.headers.get('User-Agent')) || '';
      ex.push(env.DB.prepare(up).bind(day, 'country', (request && request.cf && request.cf.country) || 'XX'));
      ex.push(env.DB.prepare(up).bind(day, 'device', /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'));
      ex.push(env.DB.prepare(up).bind(day, 'ref', refHost(ref, request)));
    }
    if (ex.length) await env.DB.batch(ex);
  } catch (e) { /* bỏ qua */ }
}

async function getProfile(env) {
  let row;
  try { row = await env.DB.prepare('SELECT name, bio, avatar_url, extra FROM profile WHERE id = 1').first(); }
  catch (e) { row = await env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1').first(); }
  if (!row) return { name: 'NOIR', bio: '', avatar_url: '' };
  let ex = {}; try { ex = JSON.parse(row.extra || '{}'); } catch (e) { /* bỏ qua */ }
  return { ...ex, name: row.name, bio: row.bio, avatar_url: row.avatar_url };
}

async function getLinks(env) {
  try { return (await env.DB.prepare('SELECT label, url, icon, tab_id, note FROM links ORDER BY sort, id').all()).results; }
  catch (e) { return (await env.DB.prepare('SELECT label, url, icon, tab_id FROM links ORDER BY sort, id').all()).results; }
}

// Thông tin Discord trực tiếp: lấy từ link mời máy chủ (discord.gg/xxxx), cache khoảng 10 phút
function inviteCode(u) {
  try {
    const x = new URL(u), h = x.hostname.replace(/^www\./, '');
    let c = '';
    if (h === 'discord.gg') c = x.pathname.split('/')[1] || '';
    else if (h === 'discord.com' || h === 'discordapp.com') { const p = x.pathname.split('/'); if (p[1] === 'invite') c = p[2] || ''; }
    return /^[A-Za-z0-9-]{2,32}$/.test(c) ? c : '';
  } catch (e) { return ''; }
}

async function withDiscord(links) {
  let n = 0;
  return Promise.all(links.map(async (l) => {
    const code = inviteCode(l.url);
    if (!code || n++ >= 3) return l;
    try {
      const r = await fetch('https://discord.com/api/v10/invites/' + code + '?with_counts=true', { cf: { cacheTtl: 600, cacheEverything: true }, signal: AbortSignal.timeout(2500) });
      if (!r.ok) return l;
      const j = await r.json();
      if (!j.guild) return l;
      const g = j.guild;
      return { ...l, info: { name: g.name, icon: g.icon ? 'https://cdn.discordapp.com/icons/' + g.id + '/' + g.icon + '.png?size=96' : '', members: j.approximate_member_count || 0, online: j.approximate_presence_count || 0 } };
    } catch (e) { return l; }
  }));
}

// Trang chủ và trang từng script có thẻ xem trước (Discord, Facebook, Zalo...): chèn thẻ meta theo dữ liệu hiện tại
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function homePage(request, env, sid) {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new Request(url.origin + '/', request));
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  try {
    const p = await getProfile(env);
    let accent = '#9370ff';
    try { const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first(); const a = r && JSON.parse(r.data).theme.accent; if (/^#[0-9a-f]{6}$/i.test(a || '')) accent = a; } catch (e) { /* mặc định */ }
    const ok = (u) => /^https:\/\//.test(u || '');
    const site = p.name || 'NOIR';
    let title = site, path = '/';
    let desc = ([p.tagline, p.bio].filter(Boolean).join(' - ') || 'Trang cá nhân của ' + site).slice(0, 160);
    let img = ok(p.banner_url) ? p.banner_url : ok(p.avatar_url) ? p.avatar_url : '';
    let big = ok(p.banner_url);
    if (sid) {
      const s = await env.DB.prepare('SELECT title, description, game, image_url FROM scripts WHERE id = ? AND published = 1').bind(sid).first();
      if (s) {
        title = s.title + ' | ' + site; path = '/s/' + sid;
        desc = (s.description || s.game || desc).slice(0, 160);
        if (ok(s.image_url)) { img = s.image_url; big = true; }
      }
    }
    const m = (a, v) => '<meta ' + a + ' content="' + esc(v) + '">';
    const head = m('name="description"', desc) + m('property="og:title"', title) + m('property="og:description"', desc) +
      m('property="og:type"', 'website') + m('property="og:url"', url.origin + path) + m('property="og:site_name"', site) +
      (img ? m('property="og:image"', img) + m('name="twitter:image"', img) : '') +
      m('name="twitter:card"', big ? 'summary_large_image' : 'summary') + m('name="twitter:title"', title) + m('name="twitter:description"', desc);
    const out = new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(title); } })
      .on('meta[name="theme-color"]', { element(e) { e.setAttribute('content', accent); } })
      .on('head', { element(e) { e.append(head, { html: true }); } })
      .transform(res);
    const h = new Headers(out.headers);
    h.set('Cache-Control', 'public, max-age=120');
    return new Response(out.body, { status: out.status, headers: h });
  } catch (e) { return res; }
}

async function getScripts(env) {
  try { return (await env.DB.prepare('SELECT id, title, description, game, image_url, status, runs, copies, tab_id, updated_at, version, changelog FROM scripts WHERE published = 1 ORDER BY sort, updated_at DESC').all()).results; }
  catch (e) { return (await env.DB.prepare('SELECT id, title, description, game, image_url, status, runs, copies, tab_id, updated_at FROM scripts WHERE published = 1 ORDER BY updated_at DESC').all()).results; }
}

// Xem trước vài dòng đầu của code (không tính là lượt copy)
async function previewOf(env, id) {
  const row = await env.DB.prepare('SELECT code FROM scripts WHERE id = ? AND published = 1').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  const text = row.code.split('\n').slice(0, 14).map((l) => l.slice(0, 160)).join('\n');
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-Content-Type-Options': 'nosniff' } });
}

async function publicSite(env) {
  const t = await env.DB.prepare('SELECT id, name, kind FROM tabs ORDER BY sort, id').all();
  let settings = {};
  try { const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first(); settings = r ? JSON.parse(r.data) : {}; } catch (e) { /* chưa chạy migration 002 */ }
  return json(
    {
      settings,
      profile: await getProfile(env),
      tabs: t.results, links: await withDiscord(await getLinks(env)), scripts: await getScripts(env),
      raw_url: (env.RAW_URL || '').replace(/\/$/, ''),
    },
    200,
    { 'Cache-Control': 'public, max-age=60' }
  );
}

// Nút "Copy code": trả code của script đã công khai, tính 1 lượt copy
async function codeOf(env, ctx, id, request) {
  const row = await env.DB.prepare('SELECT code FROM scripts WHERE id = ? AND published = 1').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  ctx.waitUntil(bump(env, 'copy', id, request));
  return new Response(row.code, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
