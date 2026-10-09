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
        ctx.waitUntil(bump(env, 'view', undefined, request));
        return new Response(null, { status: 204 });
      }

      let m = path.match(/^\/api\/copy\/([a-z0-9-]{2,40})$/);
      if (m && method === 'POST') {
        ctx.waitUntil(bump(env, 'copy', m[1], request));
        return new Response(null, { status: 204 });
      }

      m = path.match(/^\/api\/code\/([a-z0-9-]{2,40})$/);
      if (m && method === 'GET') return await codeOf(env, ctx, m[1], request);

      if (path === '/') return await homePage(request, env);

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

async function bump(env, kind, scriptId, request) {
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

// Trang chủ có thẻ xem trước (Discord, Facebook, Zalo...): chèn thẻ meta theo hồ sơ hiện tại
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function homePage(request, env) {
  const res = await env.ASSETS.fetch(request);
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  try {
    const p = await getProfile(env);
    let accent = '#9370ff';
    try { const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first(); const a = r && JSON.parse(r.data).theme.accent; if (/^#[0-9a-f]{6}$/i.test(a || '')) accent = a; } catch (e) { /* mặc định */ }
    const title = p.name || 'NOIR';
    const desc = ([p.tagline, p.bio].filter(Boolean).join(' - ') || 'Trang cá nhân của ' + title).slice(0, 160);
    const ok = (u) => /^https:\/\//.test(u || '');
    const img = ok(p.banner_url) ? p.banner_url : ok(p.avatar_url) ? p.avatar_url : '';
    const m = (a, v) => '<meta ' + a + ' content="' + esc(v) + '">';
    const head = m('name="description"', desc) + m('property="og:title"', title) + m('property="og:description"', desc) +
      m('property="og:type"', 'website') + m('property="og:url"', new URL(request.url).origin + '/') + m('property="og:site_name"', title) +
      (img ? m('property="og:image"', img) + m('name="twitter:image"', img) : '') +
      m('name="twitter:card"', ok(p.banner_url) ? 'summary_large_image' : 'summary') + m('name="twitter:title"', title) + m('name="twitter:description"', desc);
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

async function publicSite(env) {
  const [t, s] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, kind FROM tabs ORDER BY sort, id'),
    env.DB.prepare('SELECT id, title, description, game, image_url, status, runs, copies, tab_id, updated_at FROM scripts WHERE published = 1 ORDER BY updated_at DESC'),
  ]);
  let settings = {};
  try { const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first(); settings = r ? JSON.parse(r.data) : {}; } catch (e) { /* chưa chạy migration 002 */ }
  return json(
    {
      settings,
      profile: await getProfile(env),
      tabs: t.results, links: await withDiscord(await getLinks(env)), scripts: s.results,
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
