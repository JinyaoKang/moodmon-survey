import { QUESTIONS, SCREEN_RULES, publicMeta } from '../lib/questions.js';

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const DEFAULT_PASSWORD = 'moodmon2026';
const MAX_BODY = 400 * 1024;

/* ------------------------------------------------------------------ utils */
function json(data, status = 200, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders || {}),
    },
  });
}

function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

function b64url(bytes) {
  const arr = new Uint8Array(bytes);
  let str = '';
  for (let i = 0; i < arr.length; i += 1) str += String.fromCharCode(arr[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function sessionSecret(env) {
  return env.SESSION_SECRET || ('moodmon-survey-fallback-' + (env.ADMIN_PASSWORD || DEFAULT_PASSWORD));
}

async function hmacKey(env) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function makeSession(env) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(payload));
  return payload + '.' + b64url(sig);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function stringsEqual(a, b) {
  const ae = new TextEncoder().encode(String(a));
  const be = new TextEncoder().encode(String(b));
  if (ae.length !== be.length) return false;
  return bytesEqual(ae, be);
}

async function isAdmin(request, env) {
  const token = getCookie(request, 'mm_admin');
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const expected = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(parts[0]));
    if (!bytesEqual(new Uint8Array(expected), fromB64url(parts[1]))) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    return Number(payload.exp) * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

function sessionCookie(env, token) {
  return `mm_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearCookie() {
  return 'mm_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/* --------------------------------------------------------- questionnaire */
function isAnswered(q, value) {
  if (q.type === 'multi') return Array.isArray(value) && value.length > 0;
  if (q.type === 'open') return typeof value === 'string';
  return typeof value === 'string' && q.options.some(o => o.v === value);
}

function cleanAnswers(input) {
  const clean = {};
  if (!input || typeof input !== 'object') return clean;
  for (const id of Object.keys(QUESTIONS)) {
    const q = QUESTIONS[id];
    const value = input[id];
    if (value === undefined || value === null) continue;
    if (q.type === 'multi') {
      if (!Array.isArray(value)) continue;
      const allowed = new Set(q.options.map(o => o.v));
      const arr = value.filter(v => typeof v === 'string' && allowed.has(v)).slice(0, q.maxSelect || 12);
      if (arr.length) clean[id] = arr;
    } else if (q.type === 'open') {
      if (typeof value === 'string') clean[id] = value.slice(0, q.maxLength || 300);
    } else if (typeof value === 'string' && q.options.some(o => o.v === value)) {
      clean[id] = value;
    }
  }
  return clean;
}

function validateComplete(answers) {
  const missing = [];
  for (const [id, q] of Object.entries(QUESTIONS)) {
    if (!q.required) continue;
    if (!isAnswered(q, answers[id])) missing.push(q.short);
  }
  return missing;
}

function sampleFlags(answers) {
  const flags = [];
  for (const rule of SCREEN_RULES) {
    const value = answers[rule.id];
    if (!rule.pass.includes(value)) flags.push(rule.reason);
  }
  if (answers.attn && answers.attn !== 'd') flags.push('注意力检测未通过');
  return flags;
}

function todayStr(d) {
  const date = d ? new Date(d) : new Date();
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

async function ipHash(request) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|moodmon-survey'));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/* ------------------------------------------------------------------ stats */
function parseRow(row) {
  let answers = {};
  try { answers = JSON.parse(row.answers || '{}'); } catch (e) { answers = {}; }
  return { ...row, answers };
}

function countOptions(rows, qid) {
  const q = QUESTIONS[qid];
  const counts = new Map(q.options.map(o => [o.v, 0]));
  for (const row of rows) {
    const v = row.answers[qid];
    if (q.type === 'multi') {
      if (Array.isArray(v)) v.forEach(x => { if (counts.has(x)) counts.set(x, counts.get(x) + 1); });
    } else if (counts.has(v)) {
      counts.set(v, counts.get(v) + 1);
    }
  }
  return q.options.map(o => ({ v: o.v, label: o.t, count: counts.get(o.v) || 0 }));
}

function buildStats(rows, scope) {
  const valid = rows.filter(r => r.status === 'valid');
  const reference = rows.filter(r => r.status === 'reference');
  const screened = rows.filter(r => r.status === 'screened_out');
  const base = scope === 'valid' ? valid : valid.concat(reference);
  const today = todayStr();

  const distributions = {};
  const frequency = {};
  const likert = {};
  for (const [id, q] of Object.entries(QUESTIONS)) {
    if (q.type === 'single' || q.type === 'multi') {
      distributions[id] = countOptions(base, id);
      continue;
    }
    if (q.type === 'frequency') {
      frequency[id] = countOptions(base, id);
      continue;
    }
    if (q.type !== 'likert') continue;
    const scoreMap = new Map(q.options.map(o => [o.v, o.score]));
    const dist = q.options.map(o => ({ v: o.v, label: o.t, count: 0 }));
    let sum = 0;
    let n = 0;
    for (const row of base) {
      const v = row.answers[id];
      const idx = q.options.findIndex(o => o.v === v);
      if (idx < 0) continue;
      dist[idx].count += 1;
      sum += scoreMap.get(v) || 0;
      n += 1;
    }
    likert[id] = {
      short: q.short,
      title: q.title,
      n,
      mean: n ? Math.round((sum / n) * 100) / 100 : 0,
      max: Math.max(...q.options.map(o => o.score || 0)),
      dist,
    };
  }

  const conditionMap = new Map();
  for (const row of reference) {
    for (const part of String(row.reason || '其他差异').split('；')) {
      const key = part.trim() || '其他差异';
      conditionMap.set(key, (conditionMap.get(key) || 0) + 1);
    }
  }
  const conditionReasons = Array.from(conditionMap, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const durations = base.map(r => Number(r.duration_sec) || 0).filter(x => x > 0);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const openAnswers = base
    .filter(r => (r.answers.o1 && r.answers.o1.trim()) || (r.answers.o2 && r.answers.o2.trim()))
    .map(r => ({ createdAt: r.created_at, o1: r.answers.o1 || '', o2: r.answers.o2 || '' }))
    .reverse();

  const recent = rows.slice(-6).reverse().map(r => ({
    createdAt: r.created_at,
    status: r.status,
    reason: r.reason || '',
    duration: Number(r.duration_sec) || 0,
  }));

  const todayBase = valid.concat(reference).filter(r => todayStr(r.created_at) === today);

  return {
    generatedAt: new Date().toISOString(),
    scope,
    total: rows.length,
    valid: valid.length,
    reference: reference.length,
    screenedOut: screened.length,
    todayValid: valid.filter(r => todayStr(r.created_at) === today).length,
    todayNew: todayBase.length,
    avgDuration,
    conditionReasons,
    distributions,
    frequency,
    likert,
    openAnswers,
    recent,
  };
}

/* -------------------------------------------------------------------- csv */
function csvEscape(value) {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsv(rows) {
  const qids = Object.keys(QUESTIONS);
  const headers = ['序号', '提交时间', '状态', '筛除原因', '填写时长(秒)']
    .concat(qids.map(id => QUESTIONS[id].short));
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((row, i) => {
    const cells = [
      i + 1,
      row.created_at,
      row.status === 'valid' ? '有效样本' : (row.status === 'reference' ? '参考样本' : '筛选未通过'),
      row.reason || '',
      Number(row.duration_sec) || 0,
    ];
    for (const id of qids) {
      const q = QUESTIONS[id];
      const v = row.answers[id];
      if (q.type === 'multi') {
        const labels = (Array.isArray(v) ? v : []).map(x => {
          const opt = q.options.find(o => o.v === x);
          return opt ? opt.t : x;
        });
        cells.push(labels.join('|'));
      } else if (q.type === 'open') {
        cells.push(v || '');
      } else {
        const opt = q.options.find(o => o.v === v);
        cells.push(opt ? opt.t : '');
      }
    }
    lines.push(cells.map(csvEscape).join(','));
  });
  return '\uFEFF' + lines.join('\r\n');
}

async function allRows(env) {
  const result = await env.DB.prepare('SELECT * FROM responses ORDER BY created_at ASC').all();
  return (result.results || []).map(parseRow);
}

/* ----------------------------------------------------------------- routes */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method || 'GET';
  const path = url.pathname.replace(/^\/api\/?/, '');

  if (!env.DB) {
    return json({ ok: false, message: 'D1 数据库未绑定：请在 Cloudflare Pages 设置中绑定 DB 后重新部署' }, 500);
  }

  try {
    if (method === 'GET' && path === 'health') {
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first();
      return json({ ok: true, at: new Date().toISOString(), n: row ? row.n : 0 });
    }

    if (method === 'GET' && path === 'questions') {
      return json(publicMeta(), 200, { 'Cache-Control': 'public, max-age=300' });
    }

    if (method === 'POST' && path === 'submit') {
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > MAX_BODY) return json({ ok: false, message: '提交内容过大' }, 413);
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, message: '提交格式错误' }, 400); }

      const answers = cleanAnswers(body.answers);
      if (body.consent !== true) return json({ ok: false, message: '请先阅读并同意调研说明' }, 400);
      const missing = validateComplete(answers);
      if (missing.length) {
        return json({ ok: false, message: '还有题目未完成：' + missing.slice(0, 3).join('、') }, 400);
      }

      const flags = sampleFlags(answers);
      const status = flags.length ? 'reference' : 'valid';
      const reason = flags.join('；');
      const duration = Math.max(0, Math.min(7200, Math.round(Number(body.duration) || 0)));
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const hash = await ipHash(request);

      await env.DB.prepare(
        'INSERT INTO responses (id, created_at, status, reason, answers, duration_sec, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, createdAt, status, reason, JSON.stringify(answers), duration, hash).run();

      return json({
        ok: true,
        status,
        reason,
        message: status === 'valid'
          ? '提交成功，谢谢你的参与！'
          : '提交成功，你的情况会作为参考样本，谢谢你的参与！',
      });
    }

    if (method === 'POST' && path === 'admin/login') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }
      const password = typeof body.password === 'string' ? body.password : '';
      const expected = String(env.ADMIN_PASSWORD || DEFAULT_PASSWORD);
      if (!stringsEqual(password, expected)) return json({ ok: false, message: '密码不正确' }, 401);
      const token = await makeSession(env);
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(env, token) });
    }

    if (method === 'POST' && path === 'admin/logout') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
    }

    if (method === 'GET' && path === 'admin/me') {
      if (!(await isAdmin(request, env))) return json({ ok: false }, 401);
      return json({ ok: true, user: 'admin' });
    }

    if (method === 'GET' && path === 'admin/stats') {
      if (!(await isAdmin(request, env))) return json({ ok: false, message: '请先登录' }, 401);
      const scope = url.searchParams.get('scope') === 'valid' ? 'valid' : 'all';
      const rows = await allRows(env);
      return json({ ok: true, stats: buildStats(rows, scope), meta: publicMeta() });
    }

    if (method === 'GET' && path === 'admin/export.csv') {
      if (!(await isAdmin(request, env))) return json({ ok: false, message: '请先登录' }, 401);
      const rows = await allRows(env);
      return new Response(buildCsv(rows), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="moodmon_survey_data.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return json({ ok: false, message: '接口不存在' }, 404);
  } catch (err) {
    return json({ ok: false, message: '服务器开小差了，请稍后再试', detail: String(err && err.message || err) }, 500);
  }
}
