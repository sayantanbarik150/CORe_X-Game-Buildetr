# Beatnest — রেডি-টু-পেস্ট ফিক্স

এই ফোল্ডারে যা আছে:

| ফাইল | কোথায় বসাবে |
|---|---|
| `_headers` | Next.js প্রজেক্টের `public/_headers` (build output-এ কপি হবে) |
| `robots.txt` | `public/robots.txt` |
| `sitemap.example.xml` | `public/sitemap.xml` (নাম বদলে `sitemap.xml` করুন) |

> ⚠️ CSP ভুল হলে সাইট ব্লক হতে পারে। প্রথমে staging/preview deployment-এ টেস্ট করুন, তারপর production।

---

## ১. `_headers` যোগ করা

**Next.js static export:**
```
public/_headers
```
`next build` করলে `out/_headers`-এ যাবে; Cloudflare Pages সেটি পড়বে।

**`@cloudflare/next-on-pages` / OpenNext:**
`public/_headers` রাখুন — build output-এ কপি হয়। নাহলে build output root-এ ম্যানুয়ালি রাখুন।

**যাচাই:**
```bash
curl -sI https://beatnest.pages.dev/_next/static/chunks/<hash>.js | grep -i cache-control
# expected: public, max-age=31536000, immutable

curl -sI https://beatnest.pages.dev/admin | grep -i x-robots-tag
# expected: noindex, nofollow
```

> `_headers` ফাইলে `/*` ব্লক সবার শেষে রাখবেন না — Cloudflare একই path-এর একাধিক rule merge করে; নির্দিষ্ট path আগে রাখা ভালো।

---

## ২. Sitemap + robots

1. `sitemap.example.xml` → `public/sitemap.xml`; `<loc>`-এ আপনার আসল ডোমেইন দিন।
2. `robots.txt` → `public/robots.txt`; Sitemap line-এ একই ডোমেইন।
3. Google Search Console → property add → `sitemap.xml` submit.
4. `/admin` sitemap-এ **কখনো** রাখবেন না।

---

## ৩. Admin-এ Cloudflare Access (গুরুত্বপূর্ণ)

**সত্যি কথা:** Cloudflare Access সরাসরি `*.pages.dev` হোস্টনেমে কাজ করে না — Access application আপনার নিজের Cloudflare zone-এর hostname-এ লাগে। তাই:

### ধাপ ০ — Custom domain
Pages project → **Custom domains** → `beatnest.app` / `beatnest.in` / আপনার ডোমেইন যোগ করুন। DNS Cloudflare-এ থাকতে হবে।

### ধাপ ১ — Zero Trust
1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Application name: `Beatnest Admin`.
3. Domain: `yourdomain.com` + path `admin*` (অথবা `admin.yourdomain.com`).
4. Session duration: `8 hours`.

### ধাপ ২ — Policy
- Action: **Allow**
- Include: **Emails** → আপনার admin email(গুলো), অথবা **Emails ending in** `@yourdomain.com`
- (ঐচ্ছিক) Require: **Country** = India, অথবা **IP ranges** = office/VPN
- Login method: Google (অথবা One-time PIN)

### ধাপ ৩ — যাচাই
Incognito-তে `https://yourdomain.com/admin` → Cloudflare login page আসবে। ইমেইল OTP/Google দিয়ে ঢুকলে তবেই অ্যাপ দেখাবে।

> Access শুধু প্রথম দরজা। **প্রতিটি admin API-তে server-side role check/RLS থাকতেই হবে** — UI লুকানো নিরাপত্তা নয়।

### Custom domain না থাকলে?
1. Admin-কে আলাদা প্রাইভেট ডেপ্লয়মেন্টে রাখুন (নতুন Pages project + Access + custom subdomain)।
2. API-তে rate limit + strong auth + RLS।
3. `/admin` path obscure করলেও সেটি নিরাপত্তা নয় — ধরে নিন যে কেউ খুঁজে পাবে।

---

## ৪. দ্রুত পরবর্তী ধাপ

```bash
# ১. হেডার ফিক্স deploy
# ২. যাচাই
bash loadtest/smoke.sh
# ৩. ব্রাউজার ল্যাব
cd dashboard && python3 -m http.server 8000 --bind 0.0.0.0
```

বিস্তারিত কারণ ও অগ্রাধিকার: [`../beatnest-audit-bn.md`](../beatnest-audit-bn.md)।
