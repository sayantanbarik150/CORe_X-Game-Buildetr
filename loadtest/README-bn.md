# Beatnest — লোড টেস্ট কিট

দুটি টুল আছে:

| ফাইল | কী করে | কখন |
|---|---|---|
| `smoke.sh` | ৭টি পেজ/asset, cache ও security headers, latency — ৩০ সেকেন্ডে | প্রতিদিন / deploy-এর পরে |
| `k6-beatnest.js` | ramp-arrival load test, p95/p99, 429/5xx মেট্রিক | লঞ্চের আগে, staging-এ |

> **নিয়ম:** শুধু নিজের সাইটে চালান। Production-এ peak time-এ নয়। প্রথমে `RATE=5`, তারপর ধীরে বাড়ান। API/auth-এর জন্য আলাদা টেস্ট করুন — এই কিট শুধু পেজ/asset মাপে।

---

## ১. Smoke test

```bash
bash loadtest/smoke.sh
```

আউটপুটে প্রতিটি চেকের `PASS / WARN / FAIL` দেখাবে। `FAIL` থাকলে exit code `1` — CI-তে ব্যবহার করা যায়।

```bash
SITE=https://your-staging.pages.dev bash loadtest/smoke.sh
```

**বর্তমানে যা চেক করে:**
- `/`, `/admin`, `/manifest.json`, `/sw.js`, `/robots.txt`, `/sitemap.xml`, PWA icon
- HTML title, JS entry chunk
- HTML/JS `Cache-Control` (immutable কি না)
- HSTS, CSP, X-Frame-Options, Permissions-Policy
- Admin `noindex`, `og:image`, robots-এ Sitemap
- ৫টি রিকোয়েস্টের গড় latency

---

## ২. k6 লোড টেস্ট

### ইনস্টল
```bash
# macOS
brew install k6

# Ubuntu/Debian (k6 repo)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6

# Windows (winget)
winget install k6.k6
```

### ধাপে ধাপে

**ধাপ ১ — smoke (২ rps, ৩০ সেকেন্ড)**
```bash
BASE_URL=https://beatnest.pages.dev RATE=2 DURATION=30s k6 run loadtest/k6-beatnest.js
```

**ধাপ ২ — ছোট ramp (১০ rps, ২ মিনিট hold)**
```bash
BASE_URL=https://beatnest.pages.dev RATE=10 DURATION=2m k6 run loadtest/k6-beatnest.js
```

**ধাপ ৩ — বড় ramp (২৫–৫০ rps) — শুধু staging বা কম ট্রাফিকে**
```bash
BASE_URL=https://beatnest.pages.dev RATE=25 DURATION=3m k6 run loadtest/k6-beatnest.js
```

**Admin শুধু পেজ লোড (login নয়):**
```bash
BASE_URL=https://beatnest.pages.dev TARGET=/admin RATE=2 DURATION=60s k6 run loadtest/k6-beatnest.js
```

**API health (আপনার backend):**
```bash
BASE_URL=https://your-api.example.com TARGET=/health RATE=20 DURATION=2m k6 run loadtest/k6-beatnest.js
```

### Environment variables
| Variable | ডিফল্ট | কাজ |
|---|---|---|
| `BASE_URL` | `https://beatnest.pages.dev` | টার্গেট origin |
| `TARGET` | `/` | path (যেমন `/admin`, `/manifest.json`, `/health`) |
| `RATE` | `10` | peak requests/second |
| `DURATION` | `2m` | peak hold সময় |
| `CACHE_BUST` | `true` | প্রতিটি রিকোয়েস্টে unique query (uncached HTML) |

### ফলাফল কীভাবে পড়বেন
- `http_req_failed < 1%` → ভালো।
- `beatnest_throttled` (429/403) > 0.5% → API/edge rate limit; concurrency কমিয়ে দেখুন।
- `p(95) > 1500ms` → HTML/edge ধীর; cache/edge locale দেখুন।
- `beatnest_5xx > 0.5%` → backend সমস্যা।
- **RPS বাড়লেও p95 না বাড়লে** capacity ভালো; RPS plateau + p95 বাড়লে saturation।

### নিরাপত্তা
- শুধু `GET`; `responseType: 'none'` — বড় body ডাউনলোড হয় না।
- কোনো login, form, payment বা admin mutation নেই।
- `TARGET=/admin` শুধু পেজ লোড করে; credentials পাঠায় না।

---

## ৩. CI (ঐচ্ছিক)

`.github/workflows/beatnest-smoke.yml` প্রতিদিন ০৩:১৭ UTC-তে smoke চালায় এবং আর্টিফ্যাক্ট রাখে। চালু করতে:
1. GitHub → Settings → Actions → General → Allow all actions.
2. Actions ট্যাব → **Beatnest smoke** → Run workflow.

লোড টেস্ট CI-তে নেই — সেটি ম্যানুয়ালি, staging-এ চালানোই নিরাপদ।
