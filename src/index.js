const TZ_OFFSET_HOURS = 7;

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

      m = path.match(/^\/raw\/([a-z0-9-]{2,40})$/);
      if (m && (method === 'GET' || method === 'HEAD')) return await rawScript(env, ctx, m[1], method);

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
