'use strict';

/* ============================================================
   MOODMON 情绪调研 · H5 问卷前端
   ============================================================ */

const LS_KEY = 'moodmon_survey_v1';
const state = {
  meta: null,
  step: 0,          // 0 = 说明页，1..N = 题目页，N+1 = 完成
  answers: {},
  consent: false,
  startTime: 0,
  busy: false,
};
const qIndex = new Map();
const qMap = new Map();
let resumeCache = null;

const $screen = document.getElementById('screen');
const $topbar = document.getElementById('topbar');
const $bar = document.getElementById('progressBar');
const $stepLabel = document.getElementById('stepLabel');
const $toast = document.getElementById('toast');

/* ------------------------------------------------------------ utils */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let toastTimer = 0;
function toast(message, duration) {
  $toast.textContent = message;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), duration || 2600);
}

function saveProgress() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      answers: state.answers,
      step: state.step,
      consent: state.consent,
      startTime: state.startTime,
    }));
  } catch (e) { /* ignore */ }
}

function clearProgress() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved && saved.answers && Object.keys(saved.answers).length) return saved;
  } catch (e) { /* ignore */ }
  return null;
}

/* ------------------------------------------------------------ boot */
async function boot() {
  try {
    const res = await fetch('/api/questions', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad response');
    state.meta = await res.json();
    let n = 0;
    for (const sec of state.meta.sections) {
      for (const q of sec.questions) {
        n += 1;
        qIndex.set(q.id, n);
        qMap.set(q.id, q);
      }
    }
    resumeCache = loadProgress();
    render();
  } catch (e) {
    $screen.innerHTML = `
      <section class="result">
        <div class="result-icon bye">!</div>
        <h1>页面加载失败</h1>
        <p>请检查网络后刷新页面重试。</p>
        <div class="result-actions"><button class="btn btn-primary" onclick="location.reload()">刷新页面</button></div>
      </section>`;
  }
}

/* ------------------------------------------------------------ header */
function updateHeader() {
  const total = state.meta ? state.meta.sections.length : 7;
  $topbar.classList.remove('hidden');
  if (state.step === 0) {
    $bar.style.width = '0%';
    $stepLabel.textContent = '填写说明';
  } else if (state.step > total) {
    $bar.style.width = '100%';
    $stepLabel.textContent = '已完成';
  } else {
    $bar.style.width = ((state.step / total) * 100).toFixed(1) + '%';
    $stepLabel.textContent = `第 ${state.step} / ${total} 步`;
  }
}

/* ------------------------------------------------------------ intro */
function renderIntro() {
  const c = state.meta.consent;
  const resume = resumeCache && resumeCache.step >= 1 && resumeCache.step <= state.meta.sections.length
    ? `<button class="link-btn" data-continue>继续上次填写（第 ${resumeCache.step} 步）</button>` : '';
  $screen.innerHTML = `
    <section class="intro">
      <div class="hero-card">
        <span class="kicker"><i></i>${esc(c.brand)} · 前期用户调研</span>
        <h1 class="hero-title">情绪与潮玩<br><em>偏好调研</em></h1>
        <p class="hero-desc">${esc(c.intro)}</p>
        <div class="points">
          ${c.points.map(p => `<div class="point"><b>${esc(p.icon)}</b><span>${esc(p.text)}</span></div>`).join('')}
        </div>
        <div class="consent">
          <input type="checkbox" id="consentBox" ${state.consent ? 'checked' : ''}>
          <label for="consentBox">我已阅读并同意参与本次匿名调研</label>
        </div>
        <p class="privacy-text">${esc(c.privacy)}</p>
        <button class="btn btn-primary btn-block" id="startBtn" ${state.consent ? '' : 'disabled'}>开始填写</button>
        <div style="text-align:center;margin-top:8px">${resume}</div>
      </div>
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <p class="page-note">MOODMON 情绪调研 · 匿名填写 · 仅用于汇总分析</p>
    </section>`;
}

/* ------------------------------------------------------------ question */
function optionHTML(q, value) {
  if (q.type === 'multi') {
    const arr = Array.isArray(value) ? value : [];
    return `
      <div class="opts">
        ${q.options.map(o => `
          <button type="button" class="opt multi ${arr.includes(o.v) ? 'selected' : ''}"
            data-q="${q.id}" data-v="${o.v}" aria-pressed="${arr.includes(o.v)}">
            <span class="dot"></span><span>${esc(o.t)}</span>
          </button>`).join('')}
      </div>`;
  }
  return `
    <div class="opts">
      ${q.options.map(o => `
        <button type="button" class="opt ${value === o.v ? 'selected' : ''}"
          data-q="${q.id}" data-v="${o.v}" aria-pressed="${value === o.v}">
          <span class="dot"></span><span>${esc(o.t)}</span>
        </button>`).join('')}
    </div>`;
}

function pillsHTML(q, value) {
  const cls = q.type === 'frequency'
    ? 'pills frequency'
    : (q.options.length >= 5 ? 'pills scale5' : 'pills');
  return `<div class="${cls}">
    ${q.options.map(o => `
      <button type="button" class="pill ${value === o.v ? 'selected' : ''}"
        data-q="${q.id}" data-v="${o.v}" aria-pressed="${value === o.v}">${esc(o.t)}</button>`).join('')}
  </div>`;
}

function renderQuestion(q) {
  const num = qIndex.get(q.id);
  const value = state.answers[q.id];
  let body = '';
  if (q.type === 'single' || q.type === 'multi') body = optionHTML(q, value);
  else if (q.type === 'likert' || q.type === 'frequency') body = pillsHTML(q, value);
  else if (q.type === 'open') {
    body = `
      <div class="open-box">
        <textarea data-open="${q.id}" maxlength="${q.maxLength || 300}"
          placeholder="${esc(q.hint || '写点什么…')}">${esc(value || '')}</textarea>
        <div class="counter" data-counter="${q.id}">${(value || '').length} / ${q.maxLength || 300}</div>
      </div>`;
  }
  const hint = q.maxSelect ? `<p class="q-hint">最多选 ${q.maxSelect} 项</p>` : '';
  return `
    <div class="q-card ${q.type}" data-card="${q.id}">
      <div class="q-head">
        <span class="q-no">${num}</span>
        <p class="q-title">${esc(q.title)}</p>
      </div>
      ${hint}
      ${body}
    </div>`;
}

function renderPage() {
  const sec = state.meta.sections[state.step - 1];
  const total = state.meta.sections.length;
  $screen.innerHTML = `
    <section class="page">
      <div class="page-head">
        <span class="page-kicker">STEP ${String(state.step).padStart(2, '0')} / ${total}</span>
        <h1 class="page-title">${esc(sec.title)}</h1>
        <p class="page-desc">${esc(sec.desc)}</p>
      </div>
      ${sec.questions.map(renderQuestion).join('')}
      <div class="nav"><div class="nav-inner">
        <button class="btn btn-ghost" data-prev>上一步</button>
        <button class="btn btn-primary" data-next>${state.step === total ? '提交问卷' : '下一步'}</button>
      </div></div>
    </section>`;
}

/* ------------------------------------------------------------ render */
function render() {
  if (!state.meta) return;
  if (state.step === 0) renderIntro();
  else if (state.step <= state.meta.sections.length) renderPage();
  else renderDone();
  updateHeader();
}

/* ------------------------------------------------------------ answers */
function refreshOptionStates(qid) {
  const card = $screen.querySelector(`[data-card="${qid}"]`);
  if (!card) return;
  const q = qMap.get(qid);
  const value = state.answers[qid];
  if (q.type === 'multi') {
    const arr = Array.isArray(value) ? value : [];
    card.querySelectorAll('.opt').forEach(btn => {
      const on = arr.includes(btn.dataset.v);
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const wrap = card.querySelector('[data-other-wrap]');
    if (wrap) wrap.style.display = arr.includes('g') ? '' : 'none';
  } else {
    card.querySelectorAll('.opt, .pill').forEach(btn => {
      const on = btn.dataset.v === value;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }
  card.classList.remove('missing');
}

function pickOption(qid, v) {
  const q = qMap.get(qid);
  if (!q) return;
  if (q.type === 'multi') {
    const arr = Array.isArray(state.answers[qid]) ? state.answers[qid].slice() : [];
    const idx = arr.indexOf(v);
    if (idx >= 0) arr.splice(idx, 1);
    else {
      if (q.maxSelect && arr.length >= q.maxSelect) {
        toast(`最多选 ${q.maxSelect} 项，请先取消一个选项`);
        return;
      }
      arr.push(v);
    }
    if (!arr.length) delete state.answers[qid];
    else state.answers[qid] = arr;
  } else {
    state.answers[qid] = v;
  }
  refreshOptionStates(qid);
  saveProgress();
}

/* ------------------------------------------------------------ validate */
function sampleFlags() {
  const rules = state.meta.screenRules || [];
  const flags = [];
  for (const rule of rules) {
    const v = state.answers[rule.id];
    if (!rule.pass.includes(v)) flags.push(rule.reason);
  }
  return flags;
}

function validateStep() {
  const sec = state.meta.sections[state.step - 1];
  const missing = [];
  for (const q of sec.questions) {
    if (!q.required) continue;
    const v = state.answers[q.id];
    const ok = q.type === 'multi' ? (Array.isArray(v) && v.length > 0) : !!v;
    if (!ok) missing.push(q);
  }
  if (!missing.length) return true;
  missing.forEach(q => {
    const card = $screen.querySelector(`[data-card="${q.id}"]`);
    if (card) card.classList.add('missing');
  });
  toast(`还有 ${missing.length} 道题没有完成`);
  const first = $screen.querySelector(`[data-card="${missing[0].id}"]`);
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

/* ------------------------------------------------------------ navigation */
function goStep(next) {
  state.step = next;
  if (next >= 1 && !state.startTime) state.startTime = Date.now();
  saveProgress();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitSurvey() {
  if (state.busy) return;
  if (!validateStep()) return;
  state.busy = true;
  const btn = $screen.querySelector('[data-next]');
  if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }
  let lastErr = null;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (btn && attempt > 1) btn.textContent = `提交中…（重试 ${attempt}/3）`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            answers: state.answers,
            consent: state.consent,
            duration: state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0,
          }),
        });
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.message || '提交失败，请稍后再试');
        clearProgress();
        renderDone(data.status === 'reference');
        updateHeader();
        return;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
      }
    }
    const isTimeout = lastErr && lastErr.name === 'AbortError';
    toast(isTimeout
      ? '网络响应超时，答案已保存在本机；请检查网络后再点一次“提交问卷”'
      : '网络波动，提交失败；答案已保存在本机，请再点一次“提交问卷”', 4200);
    if (btn) { btn.disabled = false; btn.textContent = '提交问卷'; }
  } finally {
    state.busy = false;
  }
}

/* ------------------------------------------------------------ results */
function renderDone(reference) {
  state.step = state.meta.sections.length + 1;
  $screen.innerHTML = `
    <section class="result">
      <div class="result-icon ok">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h1>提交成功，谢谢你！</h1>
      ${reference ? `<div class="reason-tag">参考样本</div>` : ''}
      <p>${reference
        ? '你的回答已匿名记录，将作为参考样本使用。<br>每多一份真实的感受，MONLINGS 就多一分依据。'
        : '你的回答已被匿名记录。<br>每一份真实的感受，都会成为 MONLINGS 的一部分。'}</p>
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <p class="brand-line">MOODMON · 情绪可以被看见</p>
      <div class="result-actions">
        <button class="btn btn-ghost" data-close>完成</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------ events */
$screen.addEventListener('click', e => {
  const opt = e.target.closest('.opt');
  if (opt) { pickOption(opt.dataset.q, opt.dataset.v); return; }
  const pill = e.target.closest('.pill');
  if (pill) { pickOption(pill.dataset.q, pill.dataset.v); return; }
  if (e.target.closest('#startBtn')) {
    if (!state.consent) { toast('请先勾选同意参与调研'); return; }
    goStep(1);
    return;
  }
  if (e.target.closest('[data-continue]')) {
    if (!resumeCache) return;
    state.answers = Object.assign({}, resumeCache.answers);
    state.consent = true;
    state.startTime = resumeCache.startTime || Date.now();
    goStep(Math.min(Math.max(1, resumeCache.step), state.meta.sections.length));
    return;
  }
  if (e.target.closest('[data-prev]')) {
    if (state.step > 1) goStep(state.step - 1);
    else { state.step = 0; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    return;
  }
  if (e.target.closest('[data-next]')) {
    const total = state.meta.sections.length;
    if (state.step === 1) {
      if (!validateStep()) return;
      const flags = sampleFlags();
      if (flags.length) {
        toast('已记录：' + flags[0] + '，你的回答将作为参考样本');
      }
      goStep(2);
      return;
    }
    if (state.step < total) { if (validateStep()) goStep(state.step + 1); }
    else submitSurvey();
    return;
  }
  if (e.target.closest('[data-restart]')) {
    state.answers = {}; state.consent = false; state.startTime = 0; state.step = 0;
    clearProgress(); render();
    return;
  }
  if (e.target.closest('[data-close]')) {
    window.close();
    toast('感谢参与，可以关闭页面了');
  }
});

$screen.addEventListener('change', e => {
  if (e.target && e.target.id === 'consentBox') {
    state.consent = e.target.checked;
    const btn = document.getElementById('startBtn');
    if (btn) btn.disabled = !state.consent;
    saveProgress();
  }
});

$screen.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-other]')) {
    state.answers.q4_other = t.value.slice(0, 50);
    saveProgress();
  } else if (t.matches('[data-open]')) {
    const qid = t.dataset.open;
    const q = qMap.get(qid);
    const max = (q && q.maxLength) || 300;
    state.answers[qid] = t.value.slice(0, max);
    const counter = $screen.querySelector(`[data-counter="${qid}"]`);
    if (counter) counter.textContent = `${t.value.length} / ${max}`;
    saveProgress();
  }
});

boot();
