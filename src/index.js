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
        let info = {};
        try { info = (await request.json()) || {}; } catch (e) { /* không có thông tin */ }
        ctx.waitUntil(bump(env, 'view', undefined, request, info));
        return new Response(null, { status: 204 });
      }

      let m = path.match(/^\/api\/open\/([a-z0-9-]{2,40})$/);
      if (m && method === 'POST') {
        ctx.waitUntil(bump(env, 'open', m[1], request));
        return new Response(null, { status: 204 });
      }

      m = path.match(/^\/api\/copy\/([a-z0-9-]{2,40})$/);
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
async function allow(env, request, kind, ref) {
  const day = today();
  const ip = (request && request.headers.get('CF-Connecting-IP')) || 'x';
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + day)));
  const who = [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    const r = await env.DB.prepare('INSERT INTO rate_limits (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n')
      .bind(day + '|' + kind + '|' + (ref || '') + '|' + who, day).first();
    return r.n; // số lần IP này đã gọi trong ngày
  } catch (e) { return 1; } // chưa chạy migration 005 thì không chặn
}



// ---- nhận diện nguồn truy cập, thiết bị, vị trí (chỉ lưu số đếm theo nhóm, không lưu IP) ----
const SRC = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch)$/, 'Facebook', 'social'],
  [/(^|\.)messenger\.com$/, 'Messenger', 'social'],
  [/(^|\.)instagram\.com$/, 'Instagram', 'social'],
  [/(^|\.)tiktok\.com$/, 'TikTok', 'social'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', 'social'],
  [/(^|\.)(discord\.com|discord\.gg|discordapp\.com)$/, 'Discord', 'social'],
  [/(^|\.)(zalo\.me|zaloapp\.com|zalo\.vn)$/, 'Zalo', 'social'],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'Telegram', 'social'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'X (Twitter)', 'social'],
  [/(^|\.)reddit\.com$/, 'Reddit', 'social'],
  [/(^|\.)github\.com$/, 'GitHub', 'other'],
  [/(^|\.)roblox\.com$/, 'Roblox', 'other'],
  [/(^|\.)google\.[a-z.]+$/, 'Google', 'search'],
  [/(^|\.)bing\.com$/, 'Bing', 'search'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo', 'search'],
  [/(^|\.)coccoc\.com$/, 'Cốc Cốc', 'search'],
  [/(^|\.)yahoo\.com$/, 'Yahoo', 'search'],
];

function sourceOf(info, request, ua) {
  const tag = String(info.tag || '').trim().slice(0, 40).replace(/[^\w\-. ]/g, '');
  if (tag) return ['Nhãn: ' + tag, 'tag'];
  let host = '';
  try { host = new URL(info.ref).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { /* không có */ }
  if (host && host !== new URL(request.url).hostname) {
    const m = SRC.find((r) => r[0].test(host));
    return m ? [m[1], m[2]] : [host.slice(0, 40), 'other'];
  }
  const app = /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook' : /Instagram/.test(ua) ? 'Instagram' : /Zalo/i.test(ua) ? 'Zalo' : /TikTok|musical_ly|Bytedance/.test(ua) ? 'TikTok' : /Discord/.test(ua) ? 'Discord' : '';
  return app ? [app + ' (trong ứng dụng)', 'social'] : ['Truy cập trực tiếp', 'direct'];
}

function parseUA(ua, info) {
  const pv = parseInt(String(info.pv || '').split('.')[0], 10) || 0;
  let os = 'Khác', m;
  if (/Android/.test(ua)) os = 'Android ' + (info.plat === 'Android' && pv ? pv : (m = ua.match(/Android (\d+)/)) ? m[1] : '');
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS ' + ((m = ua.match(/OS (\d+)/)) ? m[1] : '');
  else if (/Windows NT 10/.test(ua)) os = info.plat === 'Windows' && pv >= 13 ? 'Windows 11' : 'Windows 10';
  else if (/Windows/.test(ua)) os = 'Windows cũ';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const browser = /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook (trong ứng dụng)' : /Instagram/.test(ua) ? 'Instagram (trong ứng dụng)' : /Zalo/i.test(ua) ? 'Zalo (trong ứng dụng)'
    : /TikTok|musical_ly|Bytedance/.test(ua) ? 'TikTok (trong ứng dụng)' : /Discord/.test(ua) ? 'Discord (trong ứng dụng)' : /EdgA?\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CocCoc/i.test(ua) ? 'Cốc Cốc' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Khác';
  const type = /iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : /Mobi|Android|iPhone/.test(ua) ? 'mobile' : 'desktop';
  return { os: os.trim(), browser, type };
}

function phoneName(m) {
  const b = /^(SM-|SC-|SCG|GT-)/.test(m) ? 'Samsung' : /^Pixel/i.test(m) ? 'Google' : /^(Redmi|POCO|M\d{4}|2\d{6}[A-Z]{0,2}$)/i.test(m) ? 'Xiaomi'
    : /^(CPH|PH[A-Z]M|PG[A-Z]M)/.test(m) ? 'OPPO' : /^(V\d{4}|vivo)/i.test(m) ? 'vivo' : /^RMX/.test(m) ? 'realme' : /^(ASUS|ZS\d|AI\d)/i.test(m) ? 'ASUS' : /^(NE|ANA|ELS|LYA|JNY)-/.test(m) ? 'Huawei' : '';
  return b && !m.toLowerCase().startsWith(b.toLowerCase()) ? b + ' ' + m : m;
}

function modelOf(info, p) {
  if (p.type === 'desktop') return '';
  const m = String(info.model || '').trim().slice(0, 40);
  if (m && m !== 'K') return phoneName(m);
  if (p.os.startsWith('iOS') && /^\d{3,4}x\d{3,4}$/.test(info.scr || '')) return (p.type === 'tablet' ? 'iPad ' : 'iPhone ') + info.scr;
  return '';
}

const LIMITS = { view: 3, copy: 5, run: 40, open: 10 };

async function bump(env, kind, scriptId, request, info) {
  info = info || {};
  const n = await allow(env, request, kind, scriptId);
  if (n > LIMITS[kind]) return;
  if (kind === 'view' && Math.random() < 0.02) {
    try { await env.DB.prepare('DELETE FROM rate_limits WHERE day < ?').bind(new Date(Date.now() + TZ_OFFSET_HOURS * 3600e3 - 3 * 864e5).toISOString().slice(0, 10)).run(); } catch (e) { /* bỏ qua */ }
  }
  const day = today(), stmts = [];
  const dq = 'INSERT INTO daily_stats (day, kind, count) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1';
  if (kind !== 'open') stmts.push(env.DB.prepare(dq).bind(day, kind));
  if (kind === 'view' && n === 1) stmts.push(env.DB.prepare(dq).bind(day, 'uv')); // khách duy nhất trong ngày
  if (scriptId && kind === 'copy') stmts.push(env.DB.prepare('UPDATE scripts SET copies = copies + 1 WHERE id = ?').bind(scriptId));
  if (scriptId && kind === 'run') stmts.push(env.DB.prepare('UPDATE scripts SET runs = runs + 1 WHERE id = ?').bind(scriptId));
  try { if (stmts.length) await env.DB.batch(stmts); } catch (e) { console.error('bump', e); }
  try { // thống kê chi tiết; bỏ qua nếu chưa chạy migration 007
    const ex = [];
    if (scriptId && ['copy', 'run', 'open'].includes(kind)) ex.push(env.DB.prepare('INSERT INTO script_stats (day, script_id, kind, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, script_id, kind) DO UPDATE SET count = count + 1').bind(day, scriptId, kind));
    if (kind === 'view') {
      const up = 'INSERT INTO visit_stats (day, dim, value, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, dim, value) DO UPDATE SET count = count + 1';
      const add = (dim, v) => { if (v) ex.push(env.DB.prepare(up).bind(day, dim, String(v).slice(0, 60))); };
      const ua = (request && request.headers.get('User-Agent')) || '', cf = (request && request.cf) || {}, p = parseUA(ua, info), [src, grp] = sourceOf(info, request, ua);
      const cc = cf.country || 'XX';
      add('country', cc);
      add('city', cf.city || cf.region ? cc + '|' + (cf.city || cf.region) : '');
      add('device', p.type); add('os', p.os); add('browser', p.browser); add('model', modelOf(info, p));
      add('src', src); add('srcgrp', grp);
      add('hour', String(new Date(Date.now() + TZ_OFFSET_HOURS * 3600e3).getUTCHours()).padStart(2, '0'));
      add('visitor', info.ret ? 'ret' : 'new');
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
