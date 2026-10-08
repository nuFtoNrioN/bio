// NOIR Personal: Worker (API công khai + API admin + raw script)
const TZ_OFFSET_HOURS = 7; // múi giờ dùng để chia thống kê theo ngày
const STATUSES = ['working', 'patched', 'outdated'];
const ID_RE = /^[a-z0-9-]{2,40}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path.startsWith('/api/admin/')) return await admin(request, env, url);

      if (path === '/api/site' && method === 'GET') return await publicSite(env);

      if (path === '/api/hit' && method === 'POST') {
        ctx.waitUntil(bump(env, 'view'));
        return new Response(null, { status: 204 });
      }

      let m = path.match(/^\/api\/copy\/([a-z0-9-]{2,40})$/);
      if (m && method === 'POST') {
        ctx.waitUntil(bump(env, 'copy', m[1]));
        return new Response(null, { status: 204 });
      }

      m = path.match(/^\/raw\/([a-z0-9-]{2,40})$/);
      if (m && (method === 'GET' || method === 'HEAD')) return await rawScript(env, ctx, m[1], method);

      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      return json({ error: 'Server error' }, 500);
    }
  },
};

// ---------- helpers ----------
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

function today(offsetDays = 0) {
  const t = Date.now() + TZ_OFFSET_HOURS * 3600e3 + offsetDays * 86400e3;
  return new Date(t).toISOString().slice(0, 10);
}

async function bump(env, kind, scriptId) {
  const stmts = [
    env.DB.prepare(
      'INSERT INTO daily_stats (day, kind, count) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1'
    ).bind(today(), kind),
  ];
  if (scriptId && kind === 'copy') stmts.push(env.DB.prepare('UPDATE scripts SET copies = copies + 1 WHERE id = ?').bind(scriptId));
  if (scriptId && kind === 'run') stmts.push(env.DB.prepare('UPDATE scripts SET runs = runs + 1 WHERE id = ?').bind(scriptId));
  try { await env.DB.batch(stmts); } catch (e) { console.error('bump', e); }
}

// ---------- public ----------
async function publicSite(env) {
  const [p, l, s] = await env.DB.batch([
    env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1'),
    env.DB.prepare('SELECT label, url, icon FROM links ORDER BY sort, id'),
    env.DB.prepare('SELECT id, title, description, game, status, runs, updated_at FROM scripts WHERE published = 1 ORDER BY updated_at DESC'),
  ]);
  return json(
    { profile: p.results[0] || { name: 'NOIR', bio: '', avatar_url: '' }, links: l.results, scripts: s.results },
    200,
    { 'Cache-Control': 'public, max-age=60' }
  );
}

async function rawScript(env, ctx, id, method) {
  const row = await env.DB.prepare('SELECT code FROM scripts WHERE id = ? AND published = 1').bind(id).first();
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!row) return new Response('-- Script không tồn tại hoặc chưa công khai', { status: 404, headers });
  if (method === 'GET') ctx.waitUntil(bump(env, 'run', id));
  return new Response(method === 'HEAD' ? null : row.code, { headers });
}

// ---------- admin auth ----------
const b64uBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const b64uJson = (s) => JSON.parse(new TextDecoder().decode(b64uBytes(s)));

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function verifyAccessJwt(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const team = (env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!token || !team || !env.ACCESS_AUD) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const header = b64uJson(h);
  const payload = b64uJson(p);
  if (header.alg !== 'RS256') return null;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) return null;
  const jwk = (await res.json()).keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.exp <= now || payload.iss !== `https://${team}` || !aud.includes(env.ACCESS_AUD)) return null;
  if (env.ADMIN_EMAIL && (payload.email || '').toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return null;
  return payload.email || 'admin';
}

// Trả về định danh admin, hoặc null nếu KHÔNG hợp lệ (đóng mặc định)
async function authenticate(request, env) {
  if (env.DEV_ADMIN_BYPASS === '1') return 'dev@local';
  try {
    const viaAccess = await verifyAccessJwt(request, env);
    if (viaAccess) return viaAccess;
  } catch (e) { console.error('access', e); }
  const auth = request.headers.get('Authorization') || '';
  if (env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 32 && auth.startsWith('Bearer ')) {
    if (await safeEqual(auth.slice(7), env.ADMIN_TOKEN)) return 'token';
  }
  return null;
}

// ---------- admin API ----------
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const httpsUrl = (v) => {
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > 400000) throw new HttpError(413, 'Dữ liệu quá lớn');
  try { return await request.json(); } catch { throw new HttpError(400, 'JSON không hợp lệ'); }
}

async function admin(request, env, url) {
  const who = await authenticate(request, env);
  if (!who) return json({ error: 'Unauthorized' }, 401);
  const method = request.method;
  if (method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== url.origin) return json({ error: 'Bad origin' }, 403);
  }
  const path = url.pathname.slice('/api/admin'.length);

  try {
    if (path === '/me' && method === 'GET') return json({ who });

    if (path === '/data' && method === 'GET') {
      const [p, l, s] = await env.DB.batch([
        env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1'),
        env.DB.prepare('SELECT label, url, icon FROM links ORDER BY sort, id'),
        env.DB.prepare('SELECT * FROM scripts ORDER BY updated_at DESC'),
      ]);
      return json({ profile: p.results[0], links: l.results, scripts: s.results });
    }

    if (path === '/stats' && method === 'GET') {
      const since = today(-29);
      const { results } = await env.DB.prepare('SELECT day, kind, count FROM daily_stats WHERE day >= ? ORDER BY day').bind(since).all();
      return json({ since, today: today(), rows: results });
    }

    if (path === '/profile' && method === 'PUT') {
      const b = await readJson(request);
      const name = str(b.name, 60) || 'NOIR';
      const avatar = b.avatar_url ? httpsUrl(str(b.avatar_url, 500)) : '';
      if (avatar === null) throw new HttpError(400, 'Avatar phải là link https');
      await env.DB.prepare(
        'INSERT INTO profile (id, name, bio, avatar_url) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, bio = excluded.bio, avatar_url = excluded.avatar_url'
      ).bind(name, str(b.bio, 500), avatar).run();
      return json({ ok: true });
    }

    if (path === '/links' && method === 'PUT') {
      const b = await readJson(request);
      if (!Array.isArray(b.links) || b.links.length > 20) throw new HttpError(400, 'Tối đa 20 link');
      const stmts = [env.DB.prepare('DELETE FROM links')];
      b.links.forEach((x, i) => {
        const label = str(x.label, 40);
        const u = httpsUrl(str(x.url, 500));
        if (!label || !u) throw new HttpError(400, `Link #${i + 1}: cần tên và URL https hợp lệ`);
        stmts.push(env.DB.prepare('INSERT INTO links (label, url, icon, sort) VALUES (?, ?, ?, ?)').bind(label, u, str(x.icon, 8), i));
      });
      await env.DB.batch(stmts);
      return json({ ok: true });
    }

    if (path === '/scripts' && method === 'POST') {
      const b = await readJson(request);
      const f = scriptFields(b);
      const id = str(b.id, 40);
      if (!ID_RE.test(id)) throw new HttpError(400, 'ID chỉ gồm a-z, 0-9, dấu gạch ngang (2-40 ký tự)');
      const now = Date.now();
      try {
        await env.DB.prepare(
          'INSERT INTO scripts (id, title, description, game, status, code, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, f.title, f.description, f.game, f.status, f.code, f.published, now, now).run();
      } catch (e) {
        if (String(e).includes('UNIQUE')) throw new HttpError(409, 'ID này đã tồn tại');
        throw e;
      }
      return json({ ok: true, id });
    }

    const m = path.match(/^\/scripts\/([a-z0-9-]{2,40})$/);
    if (m && method === 'PUT') {
      const f = scriptFields(await readJson(request));
      const r = await env.DB.prepare(
        'UPDATE scripts SET title = ?, description = ?, game = ?, status = ?, code = ?, published = ?, updated_at = ? WHERE id = ?'
      ).bind(f.title, f.description, f.game, f.status, f.code, f.published, Date.now(), m[1]).run();
      if (!r.meta.changes) throw new HttpError(404, 'Không tìm thấy script');
      return json({ ok: true });
    }
    if (m && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM scripts WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    throw e;
  }
}

function scriptFields(b) {
  const title = str(b.title, 80);
  const code = typeof b.code === 'string' ? b.code : '';
  if (!title) throw new HttpError(400, 'Thiếu tiêu đề');
  if (!code.trim()) throw new HttpError(400, 'Thiếu code');
  if (code.length > 200000) throw new HttpError(400, 'Code quá dài (tối đa 200.000 ký tự)');
  const status = STATUSES.includes(b.status) ? b.status : 'working';
  return { title, code, status, description: str(b.description, 500), game: str(b.game, 80), published: b.published ? 1 : 0 };
}
