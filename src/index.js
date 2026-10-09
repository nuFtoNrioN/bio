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
        ctx.waitUntil(bump(env, 'view'));
        return new Response(null, { status: 204 });
      }

      let m = path.match(/^\/api\/copy\/([a-z0-9-]{2,40})$/);
      if (m && method === 'POST') {
        ctx.waitUntil(bump(env, 'copy', m[1]));
        return new Response(null, { status: 204 });
      }

      m = path.match(/^\/api\/code\/([a-z0-9-]{2,40})$/);
      if (m && method === 'GET') return await codeOf(env, ctx, m[1]);

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

async function getProfile(env) {
  let row;
  try { row = await env.DB.prepare('SELECT name, bio, avatar_url, extra FROM profile WHERE id = 1').first(); }
  catch (e) { row = await env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1').first(); }
  if (!row) return { name: 'NOIR', bio: '', avatar_url: '' };
  let ex = {}; try { ex = JSON.parse(row.extra || '{}'); } catch (e) { /* bỏ qua */ }
  return { ...ex, name: row.name, bio: row.bio, avatar_url: row.avatar_url };
}

async function publicSite(env) {
  const [t, l, s] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, kind FROM tabs ORDER BY sort, id'),
    env.DB.prepare('SELECT label, url, icon, tab_id FROM links ORDER BY sort, id'),
    env.DB.prepare('SELECT id, title, description, game, image_url, status, runs, copies, tab_id, updated_at FROM scripts WHERE published = 1 ORDER BY updated_at DESC'),
  ]);
  let settings = {};
  try { const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first(); settings = r ? JSON.parse(r.data) : {}; } catch (e) { /* chưa chạy migration 002 */ }
  return json(
    {
      settings,
      profile: await getProfile(env),
      tabs: t.results, links: l.results, scripts: s.results,
      raw_url: (env.RAW_URL || '').replace(/\/$/, ''),
    },
    200,
    { 'Cache-Control': 'public, max-age=60' }
  );
}

// Nút "Copy code": trả code của script đã công khai, tính 1 lượt copy
async function codeOf(env, ctx, id) {
  const row = await env.DB.prepare('SELECT code FROM scripts WHERE id = ? AND published = 1').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  ctx.waitUntil(bump(env, 'copy', id));
  return new Response(row.code, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
