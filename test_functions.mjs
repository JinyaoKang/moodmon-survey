import { pathToFileURL } from 'node:url';
import path from 'node:path';

const modPath = pathToFileURL(path.resolve('functions/api/[[path]].js')).href;
const { onRequest } = await import(modPath);

class MockDB {
  constructor() { this.rows = []; }
  prepare(sql) {
    const self = this;
    return {
      bind(...args) {
        return {
          async run() {
            if (/INSERT INTO responses/i.test(sql)) {
              const [id, created_at, status, reason, answers, duration_sec, ip_hash] = args;
              self.rows.push({ id, created_at, status, reason, answers, duration_sec, ip_hash });
              return { success: true };
            }
            return { success: true };
          },
        };
      },
      async all() {
        if (/SELECT \* FROM responses/i.test(sql)) return { results: self.rows.slice() };
        return { results: [] };
      },
      async first() {
        if (/COUNT\(\*\)/i.test(sql)) return { n: self.rows.length };
        return null;
      },
    };
  }
}

function makeEnv() {
  return { DB: new MockDB(), ADMIN_PASSWORD: 'test-pass', SESSION_SECRET: 'test-secret' };
}

function req(url, init) {
  return new Request('https://moodmon-survey.pages.dev' + url, init);
}

function buildAnswers(meta, overrides = {}) {
  const out = {};
  for (const sec of meta.sections) {
    for (const q of sec.questions) {
      if (q.type === 'open') { out[q.id] = ''; continue; }
      if (q.type === 'multi') { out[q.id] = q.options.slice(0, 2).map(o => o.v); continue; }
      let v = q.options[0].v;
      if (q.id === 's_age') v = 'c';
      else if (q.id === 's_grad') v = 'a';
      else if (q.id === 's_work') v = 'b';
      else if (q.id === 's_duration') v = 'b';
      else if (q.id === 's_live') v = 'b';
      else if (q.id === 'attn') v = 'd';
      else if (q.type === 'likert' || q.type === 'frequency') v = 'c';
      out[q.id] = v;
    }
  }
  return { ...out, ...overrides };
}

const env = makeEnv();
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
  if (!ok) failures += 1;
}

const health = await onRequest({ request: req('/api/health'), env });
check('health', health.status === 200, String(health.status));

const qres = await onRequest({ request: req('/api/questions'), env });
const meta = await qres.json();
check('questions', qres.status === 200 && meta.sections.length === 6 && meta.sections.flatMap(s => s.questions).length === 29, `${meta.sections && meta.sections.length}`);

const answers = buildAnswers(meta);
const submit = await onRequest({
  request: req('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify({ consent: true, duration: 75, answers }),
  }),
  env,
});
const submitBody = await submit.json();
check('submit valid', submit.status === 200 && submitBody.ok && submitBody.status === 'valid', JSON.stringify(submitBody).slice(0, 120));

const referenceAnswers = buildAnswers(meta, { s_age: 'a' });
const submit2 = await onRequest({
  request: req('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.5' },
    body: JSON.stringify({ consent: true, duration: 60, answers: referenceAnswers }),
  }),
  env,
});
const submit2Body = await submit2.json();
check('submit reference', submit2.status === 200 && submit2Body.status === 'reference' && submit2Body.reason.includes('年龄'), JSON.stringify(submit2Body).slice(0, 120));

const loginWrong = await onRequest({
  request: req('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) }),
  env,
});
check('login wrong rejected', loginWrong.status === 401, String(loginWrong.status));

const login = await onRequest({
  request: req('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-pass' }) }),
  env,
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
check('login ok + cookie', login.status === 200 && cookie.startsWith('mm_admin='), cookie.slice(0, 24));

const statsRes = await onRequest({ request: req('/api/admin/stats?scope=all', { headers: { Cookie: cookie } }), env });
const statsBody = await statsRes.json();
check('stats', statsRes.status === 200 && statsBody.ok && statsBody.stats.total === 2,
  statsRes.status + ' total=' + (statsBody.stats && statsBody.stats.total));

const statsNoAuth = await onRequest({ request: req('/api/admin/stats?scope=all'), env });
check('stats unauthorized', statsNoAuth.status === 401, String(statsNoAuth.status));

const csvRes = await onRequest({ request: req('/api/admin/export.csv', { headers: { Cookie: cookie } }), env });
const csv = await csvRes.text();
check('csv export', csvRes.status === 200 && csv.includes('提交时间') && csv.split('\n').length >= 3, String(csvRes.status));

const meRes = await onRequest({ request: req('/api/admin/me', { headers: { Cookie: cookie } }), env });
const me = await meRes.json();
check('admin me', meRes.status === 200 && me.ok === true, JSON.stringify(me));

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nALL FUNCTIONS TESTS PASSED');
