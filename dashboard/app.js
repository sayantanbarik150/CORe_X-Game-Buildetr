/* Beatnest Load Lab — 100% client-side.
 * No backend, no credentials, GET/HEAD only.
 */
'use strict';

const SITE = 'https://beatnest.pages.dev';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fmtMs = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);
const fmtBytes = (n) => {
  if (n == null || Number.isNaN(+n)) return '—';
  const b = +n;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[clamp(idx, 0, sorted.length - 1)];
}

function cacheBust(url) {
  return `${url}${url.includes('?') ? '&' : '?'}_lb=${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Load test                                                          */
/* ------------------------------------------------------------------ */

const state = {
  running: false,
  runAbort: null,
  timer: null,
  chartTimer: null,
  start: 0,
  duration: 0,
  concurrency: 0,
  maxReq: 0,
  sent: 0,
  total: 0,
  ok: 0,
  errors: 0,
  throttled: 0,
  statuses: {},
  errTypes: {},
  durations: [],
  samples: [],
  target: '/',
  runId: '',
  logLines: [],
  lastSampleAt: 0,
  lastSampleTotal: 0,
};

const PRESETS = {
  smoke: { concurrency: 1, duration: 10, maxReq: 10 },
  safe: { concurrency: 10, duration: 30, maxReq: 900 },
  standard: { concurrency: 25, duration: 45, maxReq: 1800 },
  stress: { concurrency: 40, duration: 60, maxReq: 3000 },
};

function setPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  $('#concurrency').value = p.concurrency;
  $('#duration').value = p.duration;
  $('#maxReq').value = p.maxReq;
  syncLabels();
  $$('.preset').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
}

function syncLabels() {
  const c = +$('#concurrency').value;
  const d = +$('#duration').value;
  const m = +$('#maxReq').value;
  $('#concVal').textContent = c;
  $('#durVal').textContent = `${d}s`;
  $('#maxVal').textContent = m;
}

function addLog(line) {
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  state.logLines.push(`[${stamp}] ${line}`);
  if (state.logLines.length > 220) state.logLines.shift();
  const log = $('#log');
  log.textContent = state.logLines.slice(-80).join('\n');
  log.scrollTop = log.scrollHeight;
}

function resetTest() {
  state.running = false;
  state.runAbort = null;
  if (state.timer) clearInterval(state.timer);
  if (state.chartTimer) clearInterval(state.chartTimer);
  state.timer = null;
  state.chartTimer = null;
  state.start = 0;
  state.sent = 0;
  state.total = 0;
  state.ok = 0;
  state.errors = 0;
  state.throttled = 0;
  state.statuses = {};
  state.errTypes = {};
  state.durations = [];
  state.samples = [];
  state.logLines = [];
  state.runId = `run${Date.now().toString(36)}`;
  state.lastSampleAt = 0;
  state.lastSampleTotal = 0;
  $('#bar').style.width = '0%';
  $('#log').textContent = '';
  $('#logCount').textContent = '';
  $('#verdict').hidden = true;
  $('#verdict').className = 'verdict';
  $('#verdict').innerHTML = '';
  ['sReq', 'sRps', 'sP50', 'sP95', 'sP99'].forEach((id) => ($(`#${id}`).textContent = id === 'sReq' ? '0' : '—'));
  $('#sOk').textContent = '—';
  $('#sErr').textContent = '0';
  drawChart();
}

function pickTarget(n) {
  if (state.target !== 'mixed') return state.target;
  const modes = ['/', '/admin', '/manifest.json'];
  return modes[n % modes.length];
}

async function worker() {
  while (state.running) {
    const elapsed = (performance.now() - state.start) / 1000;
    if (elapsed >= state.duration || state.sent >= state.maxReq) break;
    const n = state.sent++;
    const path = pickTarget(n);
    const url = cacheBust(SITE + path);
    const started = performance.now();
    let status = 0;
    let error = '';
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort('timeout'), 12000);
    const onRunAbort = () => ctrl.abort('stopped');
    if (state.runAbort) state.runAbort.signal.addEventListener('abort', onRunAbort, { once: true });

    try {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal: ctrl.signal,
        headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      });
      status = res.status;
      // Do not download the body: protects mobile data and keeps pressure on TTFB.
      try {
        if (res.body) await res.body.cancel();
      } catch (_) {
        /* body already consumed or unavailable */
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        error = state.running ? 'timeout' : 'stopped';
      } else {
        error = (err && err.message) || 'network error';
      }
    } finally {
      clearTimeout(timeout);
      if (state.runAbort) state.runAbort.signal.removeEventListener('abort', onRunAbort);
    }

    const ms = performance.now() - started;
    if (error === 'stopped') break;
    record(ms, status, error);
  }
}

function record(ms, status, error) {
  state.total += 1;
  state.durations.push(ms);
  if (error) {
    state.errors += 1;
    state.errTypes[error] = (state.errTypes[error] || 0) + 1;
    if (state.errors <= 25) addLog(`ERR ${error} · ${Math.round(ms)}ms · status ${status || '—'}`);
  } else if (status >= 200 && status < 400) {
    state.ok += 1;
  } else if (status === 429 || status === 403 || status === 503) {
    state.throttled += 1;
    state.errors += 1;
    const key = `HTTP ${status}`;
    state.errTypes[key] = (state.errTypes[key] || 0) + 1;
    if (state.errors <= 25) addLog(`${key} · ${Math.round(ms)}ms — throttled/blocked?`);
  } else {
    state.errors += 1;
    const key = `HTTP ${status}`;
    state.errTypes[key] = (state.errTypes[key] || 0) + 1;
    if (state.errors <= 25) addLog(`${key} · ${Math.round(ms)}ms`);
  }
  state.statuses[status] = (state.statuses[status] || 0) + 1;
  updateStats();
}

function updateStats() {
  const sorted = [...state.durations].sort((a, b) => a - b);
  const elapsed = state.start ? (performance.now() - state.start) / 1000 : 0;
  const rps = elapsed > 0 ? state.total / elapsed : 0;
  const okRate = pct(state.ok, state.total);

  $('#sReq').textContent = state.total.toLocaleString('en-US');
  $('#sRps').textContent = rps.toFixed(1);
  $('#sOk').textContent = state.total ? `${okRate.toFixed(1)}%` : '—';
  $('#sP50').textContent = state.total ? fmtMs(percentile(sorted, 50)) : '—';
  $('#sP95').textContent = state.total ? fmtMs(percentile(sorted, 95)) : '—';
  $('#sP99').textContent = state.total ? fmtMs(percentile(sorted, 99)) : '—';
  $('#sErr').textContent = state.errors.toLocaleString('en-US');

  const okEl = $('#sOk');
  okEl.className = '';
  if (state.total) okEl.classList.add(okRate >= 99.5 ? 'good' : okRate >= 95 ? 'warn' : 'bad');
  const p95El = $('#sP95');
  const p95 = percentile(sorted, 95);
  p95El.className = '';
  if (state.total) p95El.classList.add(p95 < 800 ? 'good' : p95 < 1800 ? 'warn' : 'bad');
  $('#sErr').className = state.errors === 0 ? 'good' : state.errors < state.total * 0.02 ? 'warn' : 'bad';

  const progress = Math.max(
    state.duration ? Math.min(1, elapsed / state.duration) : 0,
    state.maxReq ? Math.min(1, state.total / state.maxReq) : 0
  );
  $('#bar').style.width = `${progress * 100}%`;
}

function tick() {
  if (!state.running) return;
  updateStats();

  const elapsed = (performance.now() - state.start) / 1000;
  if (elapsed - state.lastSampleAt >= 0.5) {
    const deltaReq = state.total - state.lastSampleTotal;
    const deltaT = elapsed - state.lastSampleAt;
    state.samples.push({ t: elapsed, rps: deltaT > 0 ? deltaReq / deltaT : 0 });
    if (state.samples.length > 160) state.samples.shift();
    state.lastSampleAt = elapsed;
    state.lastSampleTotal = state.total;
    drawChart();
  }
}

function drawChart() {
  const canvas = $('#chart');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 800;
  const cssH = canvas.clientHeight || 160;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 38, r: 10, t: 10, b: 20 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = '10px ui-monospace, monospace';

  const maxRps = Math.max(10, ...state.samples.map((s) => s.rps));

  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + w, y);
    ctx.stroke();
    const val = maxRps - (maxRps * i) / 4;
    ctx.fillText(val.toFixed(0), 4, y + 3);
  }

  const maxT = Math.max(state.duration || 10, state.samples.length ? state.samples[state.samples.length - 1].t : 10);
  ctx.fillText('0s', pad.l, cssH - 4);
  ctx.fillText(`${maxT.toFixed(0)}s`, pad.l + w - 18, cssH - 4);

  if (state.samples.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('টেস্ট শুরু করলে এখানে RPS গ্রাফ দেখা যাবে', pad.l + 8, pad.t + h / 2);
    return;
  }

  const points = state.samples.map((s) => ({
    x: pad.l + (Math.min(s.t, maxT) / maxT) * w,
    y: pad.t + h - (Math.min(s.rps, maxRps) / maxRps) * h,
  }));

  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + h);
  grad.addColorStop(0, 'rgba(167,139,250,0.34)');
  grad.addColorStop(1, 'rgba(167,139,250,0.01)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.t + h);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, pad.t + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = '#c4b5fd';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = '#f9a8d4';
  ctx.fill();
}

function verdictText() {
  const sorted = [...state.durations].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  const okRate = pct(state.ok, state.total);
  const elapsed = state.start ? (performance.now() - state.start) / 1000 : 0;
  const rps = elapsed ? state.total / elapsed : 0;

  let cls = 'warn';
  let title = 'সতর্কতা';
  let body = '';

  if (!state.total) {
    return { cls: 'warn', html: '<b>কোনো রিকোয়েস্ট সম্পন্ন হয়নি।</b> নেটওয়ার্ক/CORS সমস্যা হতে পারে।' };
  }

  if (okRate >= 99.5 && p95 < 800) {
    cls = 'good';
    title = 'চমৎকার — এই কনকারেন্সিতে সাইট স্থির';
  } else if (okRate >= 99 && p95 < 1500) {
    cls = 'good';
    title = 'ভালো — বড় কোনো সমস্যা ধরা পড়েনি';
  } else if (okRate >= 95) {
    cls = 'warn';
    title = 'সতর্ক — কিছু রিকোয়েস্ট ব্যর্থ/ধীর';
  } else {
    cls = 'bad';
    title = 'ঝুঁকি — সাইট এই কনকারেন্সি সামলাতে পারছে না';
  }

  const statusList = Object.entries(state.statuses)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s}×${n}`)
    .join(', ');
  const errList = Object.entries(state.errTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${k}: ${n}`)
    .join(' · ');

  body = `মোট <b>${state.total.toLocaleString('en-US')}</b> রিকোয়েস্ট, <b>${rps.toFixed(1)}</b> RPS, success <b>${okRate.toFixed(
    1
  )}%</b>, p95 <b>${fmtMs(p95)}</b>.`;
  if (statusList) body += ` স্ট্যাটাস: ${statusList}.`;
  if (errList) body += ` ত্রুটি: ${errList}.`;
  if (state.throttled) body += ` <span class="muted">(429/403 মানে Cloudflare bot protection-ও হতে পারে; কম concurrency-তে আবার চেষ্টা করুন।)</span>`;
  body += ` <span class="muted">এটি শুধু HTML পেজ লোডের ফল — মিউজিক API নয়।</span>`;

  return { cls, html: `<b>${title}</b><br />${body}` };
}

function finishTest(reason = 'done') {
  if (!state.running && reason !== 'done') return;
  state.running = false;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  if (state.runAbort) state.runAbort.abort();
  updateStats();
  drawChart();

  const v = verdictText();
  const box = $('#verdict');
  box.hidden = false;
  box.className = `verdict ${v.cls}`;
  box.innerHTML = v.html;

  addLog(`টেস্ট শেষ (${reason}) — ${state.total} req, ${state.errors} error, ${state.throttled} throttled`);
  $('#logCount').textContent = `(${state.logLines.length} lines)`;
  $('#startBtn').disabled = false;
  $('#stopBtn').disabled = true;
  $('#runState').textContent = reason === 'stopped' ? 'থামানো হয়েছে' : 'শেষ';
  $('#runState').classList.remove('live');
}

async function startTest() {
  if (state.running) return;
  syncLabels();
  const concurrency = +$('#concurrency').value;
  const duration = +$('#duration').value;
  const maxReq = +$('#maxReq').value;
  const target = $('#target').value;

  resetTest();
  state.running = true;
  state.duration = duration;
  state.concurrency = concurrency;
  state.maxReq = maxReq;
  state.target = target;
  state.start = performance.now();
  state.runAbort = new AbortController();

  $('#startBtn').disabled = true;
  $('#stopBtn').disabled = false;
  $('#runState').textContent = 'চলছে…';
  $('#runState').classList.add('live');
  addLog(`শুরু: ${concurrency} concurrency · ${duration}s · max ${maxReq} req · target ${target}`);
  addLog('শুধু GET; body ডাউনলোড বন্ধ; কোনো ফর্ম/লগইন নয়।');

  state.timer = setInterval(tick, 200);
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.allSettled(workers);
  if (state.running) finishTest('done');
}

function stopTest() {
  if (!state.running) return;
  finishTest('stopped');
}

/* ------------------------------------------------------------------ */
/* Page audit                                                         */
/* ------------------------------------------------------------------ */

const AUDIT_HOST_ALLOW = /(pages\.dev|w3\.org|schema\.org|react\.dev|nextjs\.org|gstatic\.com|cloudflare\.com|cloudflareinsights\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|www\.google\.com|accounts\.google\.com)/i;

async function fetchText(url, timeout = 15000) {
  const res = await fetchWithTimeout(url, { cache: 'no-store', credentials: 'omit', redirect: 'follow' }, timeout);
  const text = await res.text();
  return { res, text };
}

async function headInfo(url) {
  const t0 = performance.now();
  const target = cacheBust(url);
  try {
    let res = await fetchWithTimeout(target, { method: 'HEAD', cache: 'no-store', credentials: 'omit', redirect: 'follow' }, 12000);
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(target, { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow' }, 12000);
      try { if (res.body) await res.body.cancel(); } catch (_) {}
    }
    return {
      status: res.status,
      ms: performance.now() - t0,
      cache: res.headers.get('cache-control') || '—',
      len: res.headers.get('content-length'),
      type: res.headers.get('content-type') || '—',
      error: '',
    };
  } catch (err) {
    return { status: 0, ms: performance.now() - t0, cache: '—', len: null, type: '—', error: (err && err.message) || 'fetch failed' };
  }
}

function textOf(doc, sel) {
  const el = doc.querySelector(sel);
  return el ? (el.getAttribute('content') || el.getAttribute('href') || '').trim() : '';
}

function collectHosts(text) {
  const out = new Set();
  const re = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;
  let m;
  while ((m = re.exec(text))) {
    const host = m[1].toLowerCase();
    if (!AUDIT_HOST_ALLOW.test(host)) out.add(host);
  }
  return out;
}

async function runAudit() {
  const btn = $('#auditBtn');
  const stateEl = $('#auditState');
  btn.disabled = true;
  stateEl.textContent = 'অডিট চলছে…';
  stateEl.classList.add('live');
  $('#auditFindings').innerHTML = '';
  $('#auditSummary').hidden = true;
  $('#hosts').hidden = true;
  $('#auditTable tbody').innerHTML = '';

  const findings = [];
  const addFinding = (level, html) => findings.push({ level, html });

  try {
    const { res: homeRes, text: html } = await fetchText(cacheBust(`${SITE}/`));
    if (!homeRes.ok) throw new Error(`home ${homeRes.status}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const meta = {
      title: (doc.title || '').trim(),
      description: textOf(doc, 'meta[name="description"]'),
      canonical: textOf(doc, 'link[rel="canonical"]'),
      robots: textOf(doc, 'meta[name="robots"]'),
      ogImage: textOf(doc, 'meta[property="og:image"]'),
      theme: textOf(doc, 'meta[name="theme-color"]'),
      lang: doc.documentElement.getAttribute('lang') || '',
    };

    // Admin page metadata
    let adminRobots = '';
    let adminOk = false;
    try {
      const { res: ar, text: adminHtml } = await fetchText(cacheBust(`${SITE}/admin`));
      adminOk = ar.ok;
      const adoc = new DOMParser().parseFromString(adminHtml, 'text/html');
      adminRobots = textOf(adoc, 'meta[name="robots"]');
    } catch (_) {
      adminOk = false;
    }

    // Manifest + icon dimensions
    let manifest = null;
    let iconInfo = null;
    try {
      const { text } = await fetchText(cacheBust(`${SITE}/manifest.json`));
      manifest = JSON.parse(text);
      const png = (manifest.icons || []).find((i) => /\.png$/i.test(i.src || ''));
      if (png) {
        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = new URL(png.src, SITE).href;
        });
        iconInfo = { declared: png.sizes, ...(dims || {}) };
      }
    } catch (_) {
      manifest = null;
    }

    // Robots text
    let robotsText = '';
    try {
      const { text } = await fetchText(cacheBust(`${SITE}/robots.txt`));
      robotsText = text;
    } catch (_) {}

    // Resources to inspect
    const resources = [
      { name: '/', url: `${SITE}/`, kind: 'HTML' },
      { name: '/admin', url: `${SITE}/admin`, kind: 'HTML' },
      { name: '/manifest.json', url: `${SITE}/manifest.json`, kind: 'JSON' },
      { name: '/sw.js', url: `${SITE}/sw.js`, kind: 'JS' },
      { name: '/robots.txt', url: `${SITE}/robots.txt`, kind: 'TXT' },
      { name: '/sitemap.xml', url: `${SITE}/sitemap.xml`, kind: 'XML' },
      { name: '/beatnest-icon.png', url: `${SITE}/beatnest-icon.png`, kind: 'PNG' },
    ];

    const css = $$('link[rel="stylesheet"]', doc).map((l) => l.href).filter(Boolean);
    const scripts = $$('script[src]', doc).map((s) => s.src).filter(Boolean);
    const preloads = $$('link[rel="modulepreload"]', doc).map((l) => l.href).filter(Boolean);
    [...css.slice(0, 2), ...preloads.slice(0, 2), ...scripts.slice(0, 2)].forEach((u) => {
      if (!resources.some((r) => r.url === u)) {
        resources.push({ name: u.replace(SITE, ''), url: u, kind: u.endsWith('.css') ? 'CSS' : 'JS' });
      }
    });

    const rows = [];
    for (const r of resources) {
      const info = await headInfo(r.url);
      rows.push({ ...r, ...info });
    }

    // Render table
    const tbody = $('#auditTable tbody');
    tbody.innerHTML = rows
      .map((r) => {
        const cls = r.error ? 'bad' : r.status >= 200 && r.status < 400 ? 'ok' : r.status === 404 ? 'bad' : 'warn';
        const label = r.error ? 'ERR' : r.status;
        const note = r.error ? r.error : r.status === 404 ? 'পাওয়া যায়নি' : r.status === 200 ? '' : 'unexpected';
        return `<tr>
          <td><code>${escapeHtml(r.name)}</code><br /><span class="muted small">${r.kind}</span></td>
          <td><span class="tag ${cls}">${label}</span></td>
          <td>${fmtMs(r.ms)}</td>
          <td><code>${escapeHtml(String(r.cache))}</code></td>
          <td>${fmtBytes(r.len)}</td>
          <td>${escapeHtml(note)}</td>
        </tr>`;
      })
      .join('');

    // Summary cards
    $('#auditSummary').hidden = false;
    $('#auditSummary').innerHTML = [
      ['Title', meta.title || '—'],
      ['Description', meta.description ? (meta.description.length > 90 ? `${meta.description.slice(0, 90)}…` : meta.description) : 'নেই'],
      ['Canonical', meta.canonical || 'নেই'],
      ['OG image', meta.ogImage || 'নেই'],
      ['Language', meta.lang || '—'],
      ['Admin noindex', adminRobots ? adminRobots : 'নেই'],
    ]
      .map(([k, v]) => `<div class="sum-card"><span>${k}</span><b>${escapeHtml(String(v))}</b></div>`)
      .join('');

    // Findings
    const home = rows.find((r) => r.name === '/');
    const admin = rows.find((r) => r.name === '/admin');
    const sitemap = rows.find((r) => r.name === '/sitemap.xml');
    const icon = rows.find((r) => r.name === '/beatnest-icon.png');
    const staticRows = rows.filter((r) => /\.(js|css|png)(\?|$)/i.test(r.url) || r.url.includes('/_next/static/'));

    addFinding(home && home.status === 200 ? 'ok' : 'bad', home && home.status === 200 ? 'হোমপেজ <b>200 OK</b>' : `হোমপেজ ব্যর্থ (${home ? home.status : '—'})`);
    addFinding(admin && admin.status === 200 ? 'ok' : 'bad', `Admin পেজ ${admin ? admin.status : '—'} — ${adminOk ? 'পাবলিক লগইন পেজ' : 'পৌঁছানো যায়নি'}`);

    const badCache = staticRows.filter((r) => /max-age=0/i.test(r.cache || ''));
    addFinding(
      badCache.length ? 'bad' : 'ok',
      badCache.length
        ? `<b>${badCache.length}টি hashed asset-এ <code>max-age=0</code></b> — <code>immutable</code> caching দিন (JS/CSS/icon)`
        : 'Hashed asset-এ long-term cache আছে'
    );

    addFinding(
      sitemap && sitemap.status === 404 ? 'bad' : 'ok',
      sitemap && sitemap.status === 404 ? '<b>sitemap.xml নেই</b> (404) — Google index শুরু হবে না' : `sitemap.xml: ${sitemap ? sitemap.status : '—'}`
    );
    addFinding(
      /sitemap:/i.test(robotsText) ? 'ok' : 'warn',
      /sitemap:/i.test(robotsText) ? 'robots.txt-এ Sitemap আছে' : 'robots.txt-এ Sitemap directive নেই'
    );
    addFinding(meta.ogImage ? 'ok' : 'bad', meta.ogImage ? 'og:image আছে' : '<b>og:image নেই</b> — social share-এ প্রিভিউ আসবে না');
    addFinding(/noindex/i.test(adminRobots) ? 'ok' : 'bad', /noindex/i.test(adminRobots) ? 'Admin noindex করা' : '<b>Admin noindex নেই</b> — search-এ index হতে পারে');
    addFinding(
      iconInfo && iconInfo.w && iconInfo.h
        ? iconInfo.w === iconInfo.h
          ? 'ok'
          : 'warn'
        : 'warn',
      iconInfo && iconInfo.w
        ? `PWA icon: ${iconInfo.w}×${iconInfo.h}px, manifest-এ ডিক্লেয়ার ${iconInfo.declared}${iconInfo.w === iconInfo.h ? '' : ' — স্কয়ার নয়'}`
        : 'PWA icon dimension যাচাই করা যায়নি'
    );
    addFinding(
      meta.canonical && !meta.canonical.includes('pages.dev') ? 'ok' : 'warn',
      meta.canonical ? `Canonical: <code>${escapeHtml(meta.canonical)}</code>` : 'Canonical নেই'
    );
    addFinding('warn', 'HSTS/CSP/X-Frame-Options ব্রাউজার CORS-এ পড়া যায় না — <code>curl -I</code> দিয়ে যাচাই করুন');

    $('#auditFindings').innerHTML = findings
      .map((f) => `<div class="finding ${f.level}"><span class="ic">${f.level === 'ok' ? '✓' : f.level === 'warn' ? '!' : '✕'}</span><div>${f.html}</div></div>`)
      .join('');

    // Host scan
    const hosts = collectHosts(html);
    if ($('#deepScan').checked) {
      stateEl.textContent = 'JS স্ক্যান চলছে…';
      let budget = 4_000_000;
      const candidates = [...scripts, ...preloads].filter((u) => /\.js(\?|$)/.test(u)).slice(0, 5);
      // Next.js often references page chunks from the runtime; pull a few from the HTML text.
      const chunkMatches = [...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9._-]+\.js/g)].map((m) => new URL(m[0], SITE).href);
      for (const u of [...new Set([...candidates, ...chunkMatches])].slice(0, 6)) {
        if (budget <= 0) break;
        try {
          const res = await fetchWithTimeout(cacheBust(u), { cache: 'no-store', credentials: 'omit' }, 15000);
          const text = await res.text();
          budget -= text.length;
          collectHosts(text).forEach((h) => hosts.add(h));
        } catch (_) {}
      }
    }

    if (hosts.size) {
      $('#hosts').hidden = false;
      const sorted = [...hosts].sort();
      const apiish = (h) => /(api|supabase|firebase|audius|saavn|worker|vercel|render|railway|backend|auth)/i.test(h);
      $('#hosts').innerHTML = `<h4>Third-party host (${sorted.length})</h4><div class="host-list">${sorted
        .map((h) => `<span class="host ${apiish(h) ? 'api' : ''}">${escapeHtml(h)}</span>`)
        .join('')}</div>`;
    }

    stateEl.textContent = 'সম্পন্ন';
    stateEl.classList.remove('live');
  } catch (err) {
    stateEl.textContent = 'ব্যর্থ';
    stateEl.classList.remove('live');
    $('#auditFindings').innerHTML = `<div class="finding bad"><span class="ic">✕</span><div>অডিট ব্যর্থ: ${escapeHtml(
      (err && err.message) || 'unknown'
    )}. CORS/নেটওয়ার্ক ব্লক হতে পারে — সরাসরি সাইট খুলে DevTools দেখুন।</div></div>`;
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ------------------------------------------------------------------ */
/* API probe                                                          */
/* ------------------------------------------------------------------ */

async function checkApi() {
  const raw = $('#apiUrl').value.trim();
  const out = $('#apiResult');
  if (!/^https?:\/\//i.test(raw)) {
    out.hidden = false;
    out.innerHTML = '<div class="finding bad"><span class="ic">✕</span><div>সঠিক <code>https://…</code> URL দিন।</div></div>';
    return;
  }
  if (/\/(login|signin|sign-in|auth|password|token|session)\b/i.test(raw)) {
    out.hidden = false;
    out.innerHTML = '<div class="finding bad"><span class="ic">✕</span><div>লগইন/Auth endpoint টেস্ট করা হয় না। শুধু health/public GET endpoint দিন।</div></div>';
    return;
  }
  const btn = $('#apiBtn');
  btn.disabled = true;
  out.hidden = false;
  out.innerHTML = '<div class="muted">চলছে…</div>';

  const durations = [];
  const statuses = {};
  const errors = {};
  let ok = 0;
  let done = 0;
  const total = 20;
  const conc = 5;

  async function one() {
    while (done < total) {
      done += 1;
      const t0 = performance.now();
      try {
        const res = await fetchWithTimeout(cacheBust(raw), { cache: 'no-store', credentials: 'omit', redirect: 'follow' }, 12000);
        const ms = performance.now() - t0;
        durations.push(ms);
        statuses[res.status] = (statuses[res.status] || 0) + 1;
        if (res.status >= 200 && res.status < 400) ok += 1;
        try {
          if (res.body) await res.body.cancel();
        } catch (_) {}
      } catch (err) {
        durations.push(performance.now() - t0);
        const key = (err && err.name === 'AbortError') ? 'timeout' : 'network/CORS';
        errors[key] = (errors[key] || 0) + 1;
      }
    }
  }

  await Promise.allSettled(Array.from({ length: conc }, () => one()));
  const sorted = [...durations].sort((a, b) => a - b);
  const okRate = pct(ok, total);
  const errText = Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'নেই';
  const statusText = Object.entries(statuses).map(([k, v]) => `${k}×${v}`).join(', ') || '—';

  out.innerHTML = `
    <div class="stat"><span>Success</span><strong class="${okRate >= 99 ? 'good' : okRate >= 90 ? 'warn' : 'bad'}">${okRate.toFixed(0)}%</strong></div>
    <div class="stat"><span>p50</span><strong>${fmtMs(percentile(sorted, 50))}</strong></div>
    <div class="stat"><span>p95</span><strong>${fmtMs(percentile(sorted, 95))}</strong></div>
    <div class="stat"><span>Status</span><strong>${escapeHtml(statusText)}</strong></div>
    <div class="stat"><span>Errors</span><strong>${escapeHtml(errText)}</strong></div>
  `;
  btn.disabled = false;
}

/* ------------------------------------------------------------------ */
/* Wiring                                                             */
/* ------------------------------------------------------------------ */

function init() {
  syncLabels();
  $('#concurrency').addEventListener('input', () => {
    syncLabels();
    $$('.preset').forEach((b) => b.classList.remove('active'));
  });
  $('#duration').addEventListener('input', () => {
    syncLabels();
    $$('.preset').forEach((b) => b.classList.remove('active'));
  });
  $('#maxReq').addEventListener('input', () => {
    syncLabels();
    $$('.preset').forEach((b) => b.classList.remove('active'));
  });
  $$('.preset').forEach((b) => b.addEventListener('click', () => setPreset(b.dataset.preset)));
  $('#startBtn').addEventListener('click', startTest);
  $('#stopBtn').addEventListener('click', stopTest);
  $('#auditBtn').addEventListener('click', runAudit);
  $('#apiBtn').addEventListener('click', checkApi);
  $('#apiUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkApi();
  });

  window.addEventListener('resize', drawChart);
  drawChart();

  // Checklist persistence
  try {
    $$('#checklist input').forEach((cb) => {
      const key = `bn-lab-${cb.dataset.key}`;
      cb.checked = localStorage.getItem(key) === '1';
      cb.addEventListener('change', () => localStorage.setItem(key, cb.checked ? '1' : '0'));
    });
  } catch (_) {
    /* storage blocked — ignore */
  }
}

document.addEventListener('DOMContentLoaded', init);
