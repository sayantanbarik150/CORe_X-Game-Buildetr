// Beatnest — নিরাপদ k6 লোড টেস্ট
// ------------------------------------------------------------
// ব্যবহার:
//   k6 run loadtest/k6-beatnest.js
//   BASE_URL=https://beatnest.pages.dev RATE=20 k6 run loadtest/k6-beatnest.js
//   BASE_URL=https://beatnest.pages.dev TARGET=/admin RATE=2 k6 run loadtest/k6-beatnest.js
//
// SITE/API-এর owner হিসেবে চালান। production-এ peak time-এ চালাবেন না।
// ডিফল্ট খুব হালকা (২ → ১০ rps) — প্রথমে smoke, তারপর ramp।
// ------------------------------------------------------------

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'https://beatnest.pages.dev').replace(/\/+$/, '');
const TARGET = __ENV.TARGET || '/';
const RATE = Math.max(1, Number(__ENV.RATE || 10)); // peak requests / second
const HOLD = __ENV.DURATION || '2m';
const CACHE_BUST = (__ENV.CACHE_BUST || 'true') !== 'false';

const throttled = new Rate('beatnest_throttled');
const status5xx = new Rate('beatnest_5xx');
const ttfb = new Trend('beatnest_ttfb_ms', true);

const preVus = Math.max(20, Math.ceil(RATE * 3));
const maxVus = Math.max(60, Math.ceil(RATE * 12));

export const options = {
  discardResponseBodies: true,
  scenarios: {
    static_pages: {
      executor: 'ramping-arrival-rate',
      startRate: Math.max(1, Math.round(RATE * 0.2)),
      timeUnit: '1s',
      preAllocatedVUs: preVus,
      maxVUs: maxVus,
      stages: [
        { target: Math.max(1, Math.round(RATE * 0.2)), duration: '20s' },
        { target: RATE, duration: '40s' },
        { target: RATE, duration: HOLD },
        { target: 0, duration: '20s' },
      ],
      tags: { scenario: 'static_pages', target: TARGET },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% failure
    http_req_duration: ['p(95)<1500', 'p(99)<4000'],
    beatnest_5xx: ['rate<0.005'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const path = TARGET.startsWith('/') ? TARGET : `/${TARGET}`;
  const url = CACHE_BUST
    ? `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}_k6=${__VU}-${__ITER}-${Date.now()}`
    : `${BASE_URL}${path}`;

  const res = http.get(url, {
    responseType: 'none', // body ডাউনলোড করি না — কম ব্যান্ডউইথ
    redirects: 5,
    timeout: '15s',
    tags: { target: path },
  });

  const ok = check(res, {
    'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    'no 429/403 throttle': (r) => r.status !== 429 && r.status !== 403,
    'response < 5s': (r) => r.timings.duration < 5000,
  });

  throttled.add(res.status === 429 || res.status === 403);
  status5xx.add(res.status >= 500);
  ttfb.add(res.timings.waiting);

  if (!ok && __ITER < 5) {
    console.warn(`[beatnest] ${res.status} ${res.url} — ${Math.round(res.timings.duration)}ms`);
  }
}

export function handleSummary(data) {
  const m = data.metrics;
  const line = (name, value) => `${name.padEnd(26)} ${value}`;
  return {
    stdout: [
      '',
      'Beatnest — k6 summary',
      '---------------------',
      line('target', `${BASE_URL}${TARGET}`),
      line('requests', m.http_reqs ? m.http_reqs.values.count : 0),
      line('rps (avg)', m.http_reqs ? m.http_reqs.values.rate.toFixed(2) : 0),
      line('failed', m.http_req_failed ? `${(m.http_req_failed.values.rate * 100).toFixed(2)}%` : '—'),
      line('p95', m.http_req_duration ? `${m.http_req_duration.values['p(95)'].toFixed(0)} ms` : '—'),
      line('p99', m.http_req_duration ? `${m.http_req_duration.values['p(99)'].toFixed(0)} ms` : '—'),
      line('429/403', m.beatnest_throttled ? `${(m.beatnest_throttled.values.rate * 100).toFixed(2)}%` : '—'),
      line('5xx', m.beatnest_5xx ? `${(m.beatnest_5xx.values.rate * 100).toFixed(2)}%` : '—'),
      '',
      'মনে রাখবেন: এটি শুধু পেজ/asset লোড। মিউজিক API-র জন্য আলাদা টেস্ট চালান।',
      '',
    ].join('\n'),
  };
}
