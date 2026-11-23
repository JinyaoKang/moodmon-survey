'use strict';

/* ============================================================
   MOODMON 调研后台 · 图表与交互
   ============================================================ */
const C = {
  coral: '#FF6F61', yellow: '#FFC857', mint: '#4ECDC4',
  lav: '#9B8AFB', blue: '#5B8DEF', pink: '#F49AC1',
  gray: '#B9B2CC', ink: '#23243D',
};
const PALETTE = [C.coral, C.yellow, C.mint, C.lav, C.blue, C.pink, C.gray, C.ink];
const FREQ_COLORS = ['#CFC7DC', '#FFD98E', '#9BBFF5', '#FFA79D', '#FF6F61'];
const FREQ_LABELS = ['从不', '偶尔', '有时', '经常', '几乎每天'];

const state = { stats: null, meta: null, qmap: new Map(), openTab: 'o1', scope: 'all', surveyUrl: '', timer: 0 };

const $loginView = document.getElementById('loginView');
const $dashView = document.getElementById('dashView');
const $loginForm = document.getElementById('loginForm');
const $password = document.getElementById('passwordInput');
const $loginError = document.getElementById('loginError');
const $toast = document.getElementById('toast');

/* ------------------------------------------------------------ utils */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtNum(n) { return Number(n || 0).toLocaleString('zh-CN'); }
function fmtMean(n) { return Number(n || 0).toFixed(2); }
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function timeText(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function durationText(sec) {
  const s = Number(sec) || 0;
  if (!s) return '—';
  if (s < 60) return s + ' 秒';
  return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
}
function emptyHTML(msg) { return `<div class="chart-empty">${esc(msg || '暂无数据')}</div>`; }

let toastTimer = 0;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2400);
}

/* ------------------------------------------------------------ api */
async function api(url, options) {
  const res = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  if (res.status === 401) { const err = new Error(data.message || '请先登录'); err.unauth = true; throw err; }
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

/* ------------------------------------------------------------ login */
function showLogin(message) {
  $dashView.hidden = true;
  $loginView.hidden = false;
  if (message) { $loginError.textContent = message; $loginError.hidden = false; }
  setTimeout(() => $password.focus(), 80);
}

function showDashboard() {
  $loginView.hidden = true;
  $dashView.hidden = false;
}

$loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  $loginError.hidden = true;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = '登录中…';
  try {
    await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $password.value }),
    });
    $password.value = '';
    showDashboard();
    await loadStats();
    startTimer();
  } catch (err) {
    $loginError.textContent = err.message === '密码不正确' ? '密码不正确，请重试' : '登录失败，请稍后再试';
    $loginError.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = '进入后台';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); } catch (e) { /* ignore */ }
  stopTimer();
  showLogin();
});

document.getElementById('refreshBtn').addEventListener('click', () => loadStats(true));

function startTimer() {
  stopTimer();
  state.timer = setInterval(() => {
    if (!$dashView.hidden && !document.hidden) loadStats(false);
  }, 20000);
}
function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = 0; } }

/* ------------------------------------------------------------ load */
async function loadStats(manual) {
  try {
    const data = await api('/api/admin/stats?scope=' + state.scope);
    state.stats = data.stats;
    state.meta = data.meta;
    state.qmap = new Map();
    for (const sec of data.meta.sections) for (const q of sec.questions) state.qmap.set(q.id, q);
    renderDashboard();
    if (manual) toast('数据已刷新');
  } catch (err) {
    if (err.unauth) { stopTimer(); showLogin('登录状态已过期，请重新登录'); return; }
    toast(err.message || '数据加载失败');
  }
}

/* ------------------------------------------------------------ kpi */
function renderKpis(s) {
  const items = [
    { label: '有效样本', value: fmtNum(s.valid), sub: '符合目标条件' },
    { label: '参考样本', value: fmtNum(s.reference), sub: '条件外样本' },
    { label: '总提交', value: fmtNum(s.total), sub: '有效 + 参考' },
    { label: '今日新增', value: fmtNum(s.todayNew), sub: '含参考样本' },
    { label: '平均填写时长', value: s.avgDuration ? durationText(s.avgDuration) : '—', sub: '当前统计范围' },
  ];
  document.getElementById('kpiRow').innerHTML = items.map(it => `
    <div class="kpi">
      <div class="kpi-label">${esc(it.label)}</div>
      <div class="kpi-value">${esc(it.value)}</div>
      <div class="kpi-sub">${esc(it.sub)}</div>
    </div>`).join('');
}

/* ------------------------------------------------------------ charts */
function hBar(hostId, items, opts) {
  const host = document.getElementById(hostId);
  const o = opts || {};
  const rows = (items || []).filter(Boolean);
  if (!rows.length) { host.innerHTML = emptyHTML(); return; }
  const W = Math.max(560, Math.round(host.clientWidth || 620));
  const L = o.labelWidth || 132, R = 52, rowH = o.rowH || 27, top = 6;
  const H = top * 2 + rows.length * rowH;
  const max = o.max || Math.max.apply(null, rows.map(r => Number(r.value) || 0).concat([1]));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const val = Number(r.value) || 0;
    const bw = Math.max(0, Math.min(1, val / max)) * (W - L - R);
    const color = r.color || o.color || C.coral;
    svg += `<text x="${L - 10}" y="${y + 15}" text-anchor="end" class="bar-label">${esc(truncate(String(r.label), o.labelChars || 11))}</text>`;
    svg += `<rect x="${L}" y="${y + 5}" width="${W - L - R}" height="13" rx="6.5" fill="#F4EEE7"/>`;
    if (bw > 0) svg += `<rect x="${L}" y="${y + 5}" width="${bw}" height="13" rx="6.5" fill="${color}"/>`;
    svg += `<text x="${L + (W - L - R) + 8}" y="${y + 15}" class="bar-value">${esc(o.format ? o.format(val) : fmtNum(val))}</text>`;
  });
  svg += '</svg>';
  host.innerHTML = svg;
}

function donut(hostId, items, opts) {
  const host = document.getElementById(hostId);
  const o = opts || {};
  const rows = (items || []).filter(r => Number(r.count || r.value) > 0);
  const total = (items || []).reduce((a, b) => a + Number(b.count || b.value || 0), 0);
  if (!rows.length || total <= 0) { host.innerHTML = emptyHTML(); return; }
  const size = 132, cx = size / 2, cy = size / 2, r = 50, sw = 15;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let arcs = '';
  const legend = [];
  rows.forEach((item, i) => {
    const value = Number(item.count || item.value || 0);
    const color = item.color || o.colors && o.colors[i] || PALETTE[i % PALETTE.length];
    const len = (value / total) * circ;
    arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
      stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    offset += len;
    legend.push(`
      <div class="legend-item">
        <i class="legend-dot" style="background:${color}"></i>
        <span class="legend-label">${esc(item.label || '')}</span>
        <span class="legend-num">${fmtNum(value)}</span>
        <span class="legend-pct">${Math.round((value / total) * 100)}%</span>
      </div>`);
  });
  host.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-svg">
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(o.aria || '')}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F4EEE7" stroke-width="${sw}"></circle>
          ${arcs}
          <text x="${cx}" y="${cy - 1}" text-anchor="middle" class="donut-center-main">${fmtNum(total)}</text>
          <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-center-sub">${esc(o.center || '样本')}</text>
        </svg>
      </div>
      <div class="legend">${legend.join('')}</div>
    </div>`;
}

function stackedFrequency(hostId) {
  const host = document.getElementById(hostId);
  const s = state.stats;
  const defs = [
    { id: 'f1', label: '孤独、无人倾诉' },
    { id: 'f2', label: '焦虑、紧绷' },
    { id: 'f3', label: '平静、放松' },
  ];
  const has = defs.some(d => s.frequency[d.id] && s.frequency[d.id].some(x => x.count > 0));
  if (!has) { host.innerHTML = emptyHTML(); return; }
  let html = '<div class="stack-list">';
  defs.forEach(d => {
    const items = s.frequency[d.id] || [];
    const total = items.reduce((a, b) => a + b.count, 0);
    let segs = '';
    items.forEach((it, i) => {
      if (!it.count) return;
      const pct = total ? (it.count / total) * 100 : 0;
      segs += `<i class="stack-seg" style="width:${pct.toFixed(2)}%;background:${FREQ_COLORS[i]}" title="${esc(it.label)} ${it.count} 人"></i>`;
    });
    html += `
      <div class="stack-row">
        <span class="stack-label">${esc(d.label)}</span>
        <div class="stack-track">${segs}</div>
        <span class="stack-total">n=${total}</span>
      </div>`;
  });
  html += '</div>';
  html += `<div class="stack-legend">
    ${FREQ_LABELS.map((l, i) => `<span class="legend-item"><i class="legend-dot" style="background:${FREQ_COLORS[i]}"></i><span class="legend-label">${l}</span></span>`).join('')}
  </div>`;
  host.innerHTML = html;
}

/* ------------------------------------------------------------ panels */
function renderStructure() {
  const d = state.stats.distributions;
  hBar('chartWork', d.s_work.map(x => ({ label: x.label, value: x.count })), {
    color: C.coral, format: v => v + ' 人', labelWidth: 150,
  });
  donut('chartDuration', d.s_duration.map(x => ({ label: x.label, count: x.count })), { center: '居住时长' });
  donut('chartLive', d.s_live.map(x => ({ label: x.label, count: x.count })), { center: '居住情况' });
}

function renderToy() {
  const d = state.stats.distributions;
  hBar('chartToyMotive', d.toy_motive.map(x => ({ label: x.label, value: x.count })), {
    color: C.mint, format: v => v + ' 人', labelWidth: 190,
  });
  donut('chartToyExp', d.toy_exp.map(x => ({ label: x.label, count: x.count })), { center: '潮玩接触' });
  donut('chartToyPrice', d.toy_price.map(x => ({ label: x.label, count: x.count })), { center: '可接受价格' });
}

function renderEmotion() {
  const d = state.stats.distributions;
  hBar('chartEmoTags', d.emo_multi.map(x => ({ label: x.label, value: x.count })), {
    color: C.coral, format: v => v + ' 人', labelWidth: 78, rowH: 27,
  });
  hBar('chartExprWay', d.expr_way.map(x => ({ label: x.label, value: x.count })), {
    color: C.yellow, format: v => v + ' 人', labelWidth: 180,
  });
  donut('chartWho', d.expr_who.map(x => ({ label: x.label, count: x.count })), { center: '倾诉方式' });
}

function renderAttitude() {
  const L = state.stats.likert;
  const ids = ['emo_impact', 'emo_accept', 'expr_self', 'expr_hide', 'role_buy'];
  hBar('chartAttitude', ids.map(id => ({ label: L[id].short, value: L[id].mean })), {
    color: C.lav, max: 5, format: v => v.toFixed(2), labelWidth: 170, rowH: 28,
  });
}

function renderRole() {
  const d = state.stats.distributions;
  hBar('chartRoleNeed', d.role_need.map(x => ({ label: x.label, value: x.count })), {
    color: C.coral, format: v => v + ' 人', labelWidth: 78, rowH: 27,
  });
  hBar('chartRoleAnimal', d.role_animal.map(x => ({ label: x.label, value: x.count })), {
    color: C.yellow, format: v => v + ' 人', labelWidth: 90,
  });
  hBar('chartRoleColor', d.role_color.map(x => ({ label: x.label, value: x.count })), {
    color: C.mint, format: v => v + ' 人', labelWidth: 110,
  });
  hBar('chartRoleShape', d.role_shape.map(x => ({ label: x.label, value: x.count })), {
    color: C.blue, format: v => v + ' 人', labelWidth: 120,
  });
  donut('chartRoleStory', d.role_story.map(x => ({ label: x.label, count: x.count })), { center: '故事风格' });
  donut('chartRoleSize', d.role_size.map(x => ({ label: x.label, count: x.count })), { center: '角色尺寸' });
}

function renderScreen() {
  const reasons = state.stats.conditionReasons || [];
  donut('chartScreen', reasons.map(r => ({ label: r.label, count: r.count })), {
    center: '参考样本',
    colors: [C.coral, C.yellow, C.lav, C.mint, C.blue, C.pink],
  });
}

/* ------------------------------------------------------------ cross */
const CROSS_GROUPS = [
  { id: 's_work', label: '工作年限' },
  { id: 's_live', label: '居住情况' },
  { id: 's_duration', label: '居住时长' },
  { id: 'toy_exp', label: '潮玩接触经历' },
  { id: 'f1', label: '孤独频率' },
];
const CROSS_METRICS = [
  { id: 'emo_impact', label: '情绪影响日常决定' },
  { id: 'emo_accept', label: '负面情绪需要表达' },
  { id: 'expr_self', label: '愿意让身边人知道情绪' },
  { id: 'expr_hide', label: '习惯藏起负面情绪' },
  { id: 'role_buy', label: '角色购买意愿' },
];

function initCrossControls() {
  const g = document.getElementById('crossGroup');
  const m = document.getElementById('crossMetric');
  g.innerHTML = CROSS_GROUPS.map(x => `<option value="${x.id}">${esc(x.label)}</option>`).join('');
  m.innerHTML = CROSS_METRICS.map(x => `<option value="${x.id}">${esc(x.label)}</option>`).join('');
  g.value = 's_work';
  m.value = 'role_buy';
  g.addEventListener('change', renderCross);
  m.addEventListener('change', renderCross);
}

function scoreOf(qid, letter) {
  const q = state.qmap.get(qid);
  if (!q || !q.options) return null;
  const opt = q.options.find(o => o.v === letter);
  if (!opt || !opt.score) return null;
  return opt.score;
}

function renderCross() {
  const groupId = document.getElementById('crossGroup').value;
  const metricId = document.getElementById('crossMetric').value;
  const groupQ = state.qmap.get(groupId);
  const metricQ = state.qmap.get(metricId);
  const valid = state.stats.validAnswers || [];
  const rows = groupQ.options.map(opt => {
    let sum = 0, n = 0;
    for (const row of valid) {
      if (row.answers[groupId] !== opt.v) continue;
      const score = scoreOf(metricId, row.answers[metricId]);
      if (score == null) continue;
      sum += score; n += 1;
    }
    return { label: opt.t, value: n ? sum / n : 0, n };
  }).filter(r => r.n > 0);
  hBar('chartCross', rows.map(r => ({ label: r.label + ' · ' + r.n, value: r.value })), {
    color: C.blue, max: 5, format: v => v.toFixed(2), labelWidth: 170, rowH: 28,
  });
  document.getElementById('crossNote').textContent =
    `指标：${metricQ ? metricQ.short : ''}（1—5 均值）；标签后的数字为该组有效样本量。`;
}

/* ------------------------------------------------------------ open answers */
function renderOpen() {
  const list = document.getElementById('openList');
  const s = state.stats;
  const items = (s.openAnswers || []).filter(a => (a[state.openTab] || '').trim());
  if (!items.length) {
    list.innerHTML = '<div class="open-empty">这个题目暂时还没有回答</div>';
  } else {
    list.innerHTML = items.map(a => `
      <div class="open-item">
        <div class="open-time">${timeText(a.createdAt)}</div>
        <p>${esc(a[state.openTab])}</p>
      </div>`).join('');
  }
  renderKeywords();
}

const STOP_CHARS = new Set('的了我你他她它在是有和就也很不都会说一个这那什么自己可以没有觉得有点比较非常真的就是然后因为所以但是还是而且如果可能已经现在时候事情东西感觉一点我们你们他们哪怎样这个那个'.split(''));
const STOP_WORDS = new Set(['一个', '自己', '没有', '觉得', '什么', '这个', '那个', '时候', '可以', '就是', '还是', '因为', '所以', '但是', '而且', '如果', '可能', '已经', '现在', '我们', '你们', '他们', '有点', '比较', '非常', '真的', '然后', '事情', '东西', '感觉', '一点', '喜欢', '希望']);

function renderKeywords() {
  const host = document.getElementById('keywords');
  const s = state.stats;
  const text = (s.openAnswers || []).map(a => a[state.openTab] || '').join(' ')
    .replace(/[\s，。！？、；：“”‘’（）()\[\]【】…—\-·,.!?;:]/g, '');
  const counts = new Map();
  for (let i = 0; i < text.length - 1; i++) {
    const bg = text.slice(i, i + 2);
    if (STOP_WORDS.has(bg)) continue;
    if (STOP_CHARS.has(bg[0]) || STOP_CHARS.has(bg[1])) continue;
    counts.set(bg, (counts.get(bg) || 0) + 1);
  }
  const top = Array.from(counts.entries()).filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  host.innerHTML = top.map(([word, n]) => `<span class="keyword">${esc(word)}<small>×${n}</small></span>`).join('');
}

/* ------------------------------------------------------------ recent */
function renderRecent() {
  const rows = state.stats.recent || [];
  const table = document.getElementById('recentTable');
  if (!rows.length) { table.innerHTML = '<tbody><tr><td class="chart-empty">暂无提交</td></tr></tbody>'; return; }
  const statusMap = {
    valid: ['有效样本', 'ok'],
    reference: ['参考样本', 'mid'],
    screened_out: ['未通过', 'bad'],
  };
  table.innerHTML = `
    <thead><tr><th>提交时间</th><th>状态</th><th>填写时长</th><th>样本差异原因</th></tr></thead>
    <tbody>${rows.map(r => {
      const meta = statusMap[r.status] || ['未知', 'bad'];
      return `
      <tr>
        <td>${timeText(r.createdAt)}</td>
        <td><span class="badge ${meta[1]}">${meta[0]}</span></td>
        <td>${durationText(r.duration)}</td>
        <td>${esc(r.reason || '—')}</td>
      </tr>`;
    }).join('')}</tbody>`;
}

/* ------------------------------------------------------------ dashboard */
function renderDashboard() {
  const s = state.stats;
  document.getElementById('updatedAt').textContent = '更新于 ' + timeText(s.generatedAt).slice(11);
  renderKpis(s);

  const empty = document.getElementById('emptyState');
  const grid = document.querySelector('.grid');
  const surveyUrl = state.surveyUrl || (location.origin + '/');
  document.getElementById('phoneUrl').textContent = surveyUrl.replace(/\/$/, '');
  document.getElementById('surveyLink').textContent = surveyUrl;

  let emptyTitle = '';
  let emptyDesc = '';
  if (s.total === 0) {
    emptyTitle = '还没有收到问卷';
    emptyDesc = '把下面的链接发到手机（同一 WiFi）填写，提交后这里会自动汇总数据。';
  } else if (s.scope === 'valid' && s.valid === 0) {
    emptyTitle = '暂无有效样本';
    emptyDesc = '当前只有参考样本，把右上角“统计范围”切换为“全部样本（含参考）”即可查看；也可以继续邀请符合条件的目标用户填写。';
  }

  if (emptyTitle) {
    empty.hidden = false;
    grid.style.display = 'none';
    empty.querySelector('h2').textContent = emptyTitle;
    empty.querySelector('p').textContent = emptyDesc;
  } else {
    empty.hidden = true;
    grid.style.display = '';
    renderStructure();
    renderToy();
    stackedFrequency('chartFreq');
    renderEmotion();
    renderAttitude();
    renderRole();
    renderScreen();
    renderCross();
    renderOpen();
    renderRecent();
  }
}

/* ------------------------------------------------------------ tabs & scope */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.openTab = tab.dataset.tab;
    renderOpen();
  });
});

document.getElementById('scopeSelect').addEventListener('change', e => {
  state.scope = e.target.value;
  loadStats();
});

/* ------------------------------------------------------------ boot */
async function loadNetworkInfo() {
  try {
    const info = await api('/api/info');
    state.surveyUrl = (info.urls && info.urls[0] && info.urls[0].url) || (location.origin + '/');
  } catch (e) {
    state.surveyUrl = location.origin + '/';
  }
  const el = document.getElementById('phoneUrl');
  if (el) el.textContent = state.surveyUrl.replace(/\/$/, '');
}

(async function boot() {
  initCrossControls();
  await loadNetworkInfo();
  try {
    const data = await api('/api/admin/stats?scope=' + state.scope);
    state.stats = data.stats;
    state.meta = data.meta;
    state.qmap = new Map();
    for (const sec of data.meta.sections) for (const q of sec.questions) state.qmap.set(q.id, q);
    showDashboard();
    renderDashboard();
    startTimer();
  } catch (err) {
    if (err.unauth) showLogin();
    else showLogin('后台加载失败，请刷新重试');
  }
})();
