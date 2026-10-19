# Beatnest — Website ও Admin Panel অডিট

**অডিটের তারিখ:** ১৯ অক্টোবর ২০২৬, ১২:৪৪–১২:৫২ IST (০৭:১৪–০৭:২২ UTC)  
**সাইট:** <https://beatnest.pages.dev> · **Admin:** <https://beatnest.pages.dev/admin>  
**অডিটের ধরন:** বাইরে থেকে ব্ল্যাক-বক্স পরীক্ষা (কোনো লগইন, পাসওয়ার্ড বা ডেটাবেস অ্যাক্সেস ছাড়া)

---

## ০. এক নজরে (TL;DR)

| প্রশ্ন | উত্তর |
|---|---|
| সাইট **এখন** আপ কি? | **হ্যাঁ।** ২০টি গ্লোবাল নোডের মধ্যে ১৯টি থেকে `200 OK`, ০.০৭–০.৮৭ সেকেন্ড। ভারতের Mumbai **০.৩৪৬ সে**, Rajpura **০.৫১৯ সে** — দুটোই `200`। গ্লোবাল আউটেজ নেই। |
| আজ ১০০–৫০০ concurrent ইউজার নিতে পারবে? | **হ্যাঁ, ফ্রন্টএন্ড নিতে পারবে।** Cloudflare Pages-এ স্ট্যাটিক রিকোয়েস্ট ও ব্যান্ডউইথ আনলিমিটেড। |
| ১,০০০+ concurrent? | **শুধু ফ্রন্টএন্ড ঠিক থাকবে; আসল ডেটা API, auth ও অডিও CDN-এ চাপ পড়বে।** |
| ইউজার "সাইট লোড হচ্ছে না" বলছে কেন? | সবচেয়ে সম্ভাব্য কারণ: **গানের ডেটা client-side API থেকে আসে**। API slow/blocked/429 হলে পেজের সেকশনগুলো `(0 picks)` / `(0 tracks)` দেখায় — সাইট ভাঙা মনে হয়। |
| Admin প্যানেল কি নিরাপদ? | **এখনই ঝুঁকি আছে।** প্যানেল পাবলিক, `noindex` নেই, edge gate নেই, security headers নেই। OAuth allowlist শুধু ক্লায়েন্টে হলে বাইপাসযোগ্য। |
| SEO? | **প্রায় শূন্য।** sitemap নেই, Google-এ index নেই, `og:image` নেই, canonical `pages.dev`; আর **`beatnest.com` আপনার নয় — HugeDomains-এ বিক্রির জন্য**। |
| আমার রায় | ফ্রন্টএন্ড **A-** (হোস্টিং), কিন্তু **API নির্ভরতা, caching, SEO ও admin security-তে বড় ফাঁক**। লঞ্চের আগে নিচের P0 লিস্ট করুন। |

> **সবচেয়ে গুরুত্বপূর্ণ কথা:** Cloudflare আপনার সাইটের ট্রাফিক সামলাতে পারবে। কিন্তু আপনার গানগুলো JioSaavn/Audius-এর মতো তৃতীয় পক্ষের API/CDN থেকে আসে। ওই API-গুলোই আজ বা কালকে আগে ভাঙবে — Cloudflare নয়।

---

## ১. কী টেস্ট করেছি, কী পারিনি

### করেছি
- HTTP status, response headers, TLS, HTTP/2/3, DNS (IPv4 + IPv6) — একাধিক স্বাধীন টুল দিয়ে।
- ৬টি ও ২০টি গ্লোবাল নোড এবং ভারতের Mumbai/Rajpura থেকে রিয়েল রিকোয়েস্ট (check-host.net)।
- রেন্ডার করা পেজ ও **JavaScript ছাড়া raw HTML** — দুটোই তুলনা করেছি।
- `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml`, PWA icon, JS/CSS chunk headers।
- `/admin` পেজের meta, robots directive, security headers।
- Google index-এ দৃশ্যমানতা (search query) এবং ব্র্যান্ড/ডোমেইন যাচাই।

### পারিনি (সীমাবদ্ধতা)
- **হাজার হাজার রিকোয়েস্টের সার্ভার-সাইড লোড টেস্ট** — এই স্যান্ডবক্স থেকে সরাসরি ইন্টারনেটে অ্যাক্সেস সীমিত; তাই `k6` চালানো যায়নি। এর বদলে **আপনার ব্রাউজার থেকে চলার মতো একটি সেফ লোড-টেস্ট ড্যাশবোর্ড** বানিয়েছি (`dashboard/`)।
- **লগইন, API, ডেটাবেস, payment** — ক্রেডেনশিয়াল নেই; অনুমতি ছাড়া লগইন চেষ্টা করাও ঠিক নয়।
- **সোর্স কোড** — GitHub রিপোতে Beatnest-এর কোড নেই (শুধু README)। তাই API-এর ভেতরের capacity অনুমাননির্ভর।
- **ভারতের বাসা/মোবাইল ISP** — check-host-এর Mumbai/Rajpura ডেটাসেন্টার নোড OK; তবে Jio/Airtel/Vi-এর মোবাইল রুট আলাদা হতে পারে। আপনার ব্রাউজার টেস্টই আসল ছবি দেবে।

---

## ২. সাইটের বর্তমান অবস্থা — প্রমাণসহ

### ২.১ হোস্টিং, DNS ও এজ

| বিষয় | ফলাফল | রায় |
|---|---|---|
| হোস্ট | Cloudflare Pages (`server: cloudflare`) | ✅ ভালো |
| IPv4 | `172.66.47.161`, `172.66.44.95` (Cloudflare, changing) | ✅ |
| IPv6 | `2606:4700:310c::ac42:2fa1`, `…2c5f` | ✅ |
| TLS | TLS 1.3, X25519MLKEM768; সার্টিফিকেট ১৬ অক্টো ২০২৬ – ১৪ জানু ২০২৭ | ✅ |
| HTTP/3 | `alt-svc: h3=":443"` | ✅ |
| Edge | `cdn-cgi/trace` → `colo=IAD`, `http/2`, `tls=TLSv1.3` | ✅ |
| ৬ নোড চেক | ৬/৬ OK, ০.১৭৬–০.৮৬৬ সে | ✅ |
| ২০ নোড চেক | ১৯/২০ OK, ০.০৬৬–০.৮৬৬ সে; শুধু মস্কো নোড ব্যর্থ | ⚠️ (রাশিয়া রিজিওনাল নেটওয়ার্ক ইস্যু, সাইট ডাউন নয়) |
| ভারত (Mumbai / Rajpura) | ২/২ OK — **০.৩৪৬ সে / ০.৫১৯ সে** | ✅ |
| Cloudflare Pages ফ্রি লিমিট | স্ট্যাটিক রিকোয়েস্ট + ব্যান্ডউইথ **আনলিমিটেড**; ৫০০ বিল্ড/মাস; ২০,০০০ ফাইল; ২৫ MiB/ফাইল | ✅ |

> **মানে:** সাইটের ফ্রন্টএন্ড আজ হাজার হাজার কনকারেন্ট ইউজার নিতে পারবে। Cloudflare-এর এজকেই আসল সীমা ধরা হবে না।

### ২.২ Response headers (মূল পেজ ও admin একই)

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=0, must-revalidate
Content-Encoding: br
Server: cloudflare
Access-Control-Allow-Origin: *
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

**নেই:** `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options` / `frame-ancestors`, `Permissions-Policy`.

**সমস্যা:**
- `Cache-Control: max-age=0` **hashed JS/CSS/icon-এও** প্রযোজ্য। মানে প্রতিবার ভিজিটে ব্রাউজার আবার revalidate করে। First load-এ বড় পার্থক্য না করলেও repeat visit ও মোবাইলে অপ্রয়োজনীয় round-trip হয়।
- `Access-Control-Allow-Origin: *` HTML response-এও আছে — দরকার নেই; শুধু API/asset-এ দরকার।
- CSP না থাকায় XSS হলে টোকেন/সেশন চুরির ঝুঁকি বেশি; admin-এ clickjacking-ও সম্ভব।

### ২.৩ পেজের ভেতরে কী আছে

- Spotlight: Tohaj – Long Drive (Audius / Radio Juicy)
- ১২টি "Recommended For You" (JioSaavn কভার, Arijit Singh প্রভৃতি)
- ১৩টি Mood/Vibe radio কার্ড
- ১৫টি "Trending Releases" (Audius)
- Mood selector (Auto/Romantic/Sad/Gym…), Google sign-in, likes/downloads, PWA

**কভার ইমেজ:** ২৮টি, বেশিরভাগ `c.saavncdn.com` ও Audius CDN থেকে সরাসরি `480×480`/`500×500` সাইজে। responsive `srcset` বা `150/300px` ভ্যারিয়েন্টের প্রমাণ নেই।  
**অনুমানিত first-load:** ছবি ১.৫–২.৫ MB + JS ~৬০০ KB (uncompressed, ১৭ chunks) + CSS + fonts ≈ **২–৩ MB**। 4G-তে ২–৩ সে, দুর্বল 3G-তে ১২–১৮ সে।

### ২.৪ সবচেয়ে বড় আবিষ্কার: ডেটা client-side

JavaScript ছাড়া raw HTML-এ দেখা যায়:

```
## Recommended For You
(0 picks)
...
## Trending Releases
(0 tracks)
```

শুধু layout, mood chip, radio কার্ড আসে; **গান/Spotlight/Recommended আসে ব্রাউজার থেকে API কল করার পরে**। মাইক্রোলিংক/রেন্ডার করা পেজে গান দেখা যায়, কারণ সেখানে JS চলে।

**পরিণতি:**
1. ধীর বা ব্লকড API-তে ইউজার প্রথম কয়েক সেকেন্ড খালি সেকশন দেখে → "সাইট কাজ করছে না"।
2. Googlebot-এর মতো crawler JS চালালেও ডেটা লোড হতে সময় নেয়/নাও হতে পারে → SEO দুর্বল।
3. প্রথম paint দ্রুত, কিন্তু **LCP ও CLS** খারাপ: ১২টি কার্ড হঠাৎ ঢুকে layout নাড়ায়।

### ২.৫ PWA

| আইটেম | অবস্থা |
|---|---|
| `manifest.json` | ✅ নাম, description, theme `#08080d`, standalone |
| Icon | ⚠️ `beatnest-icon.png` আসলে **৩৮৬×৩৫০**, অথচ manifest-এ ১৯২×১৯২ ও ৫১২×৫১২ দাবি; ফাইল **১৩৯ KB** |
| `sw.js` | ✅ custom: navigation network-first, static stale-while-revalidate, API/range bypass |
| Cache name | `beatnest-pwa-v1` — deploy-এ version bump না হলে পুরোনো shell আটকে থাকতে পারে |
| Offline | ✅ fallback message আছে |

**ফিক্স:** ১৯২, ৫১২ (ও ১০২৪) স্কয়ার PNG, `purpose: any` ও আলাদা `maskable` আইকন; ৩০–৫০ KB-এর নিচে নামান; `sw.js`-এ build hash দিয়ে cache version বদলান।

### ২.৬ SEO, ব্র্যান্ড ও ডোমেইন

| চেক | ফলাফল | রায় |
|---|---|---|
| `sitemap.xml` | **404** | ❌ |
| `robots.txt` | ২০০, কিন্তু শুধু content-signal কমেন্ট; `User-agent`, `Allow`, `Sitemap` নেই | ⚠️ |
| Google index (`site:beatnest.pages.dev`) | কোনো ফলাফল নেই | ❌ |
| `<title>` | "Beatnest — Your Music. Your Nest." | ✅ |
| Description | আছে (streaming/ad-free) | ✅ |
| Canonical | `https://beatnest.pages.dev/` | ⚠️ custom domain থাকলে বদলাতে হবে |
| `og:image` | **নেই** | ❌ শেয়ারে প্রিভিউ আসবে না |
| Meta `url` | `https://beatnest.com/` | ❌ ভুল |
| `beatnest.com` | **HugeDomains-এ বিক্রির জন্য** (302 → hugedomains.com) | ❌ ব্র্যান্ড ঝুঁকি |
| Brand collision | BeatNest music school (US), BeatNest Studio, beatnest-website.netlify.app | ⚠️ |

**মানে:** এখনই Google থেকে অর্গানিক ইউজার আসবে না। "Beatnest" সার্চে অন্য ব্র্যান্ড আসবে। `beatnest.com` আপনার না — অথচ অ্যাপের metadata-তে সেটাই লেখা। দ্রুত একটি নিজের ডোমেইন নিন (যেমন `beatnest.app`, `beatnest.in`, `getbeatnest.com`) এবং canonical/OG/sitemap সব সেখানে বসান।

### ২.৭ Admin প্যানেল

| চেক | ফলাফল |
|---|---|
| URL | `/admin` — anonymous-ভাবেও `200 OK` (SPA login) |
| Title/Description | হোমপেজের মতোই — আলাদা কিছু নেই |
| `meta robots` | **নেই** → index হওয়ার ঝুঁকি |
| `X-Robots-Tag` | নেই |
| Security headers | HSTS/CSP/XFO নেই |
| Login options | Email+password, Google "admin" account |
| Edge protection | কোনো Cloudflare Access/Basic Auth নেই |
| Rate limiting | বাইরে থেকে বোঝা যায় না; অনুমান করা যায় না |
| API/database | পাবলিকভাবে দৃশ্যমান নয় — যাচাই করা যায়নি |

**মূল ঝুঁকি:** এটি স্ট্যাটিক/স্পা পেজ। login UI পাবলিক হওয়া স্বাভাবিক, কিন্তু **আসল authorization কোথায় হচ্ছে সেটাই নির্ধারক**। যদি "শুধু authorized Google account" চেক শুধু React কোডে থাকে, তাহলে যে কেউ API সরাসরি কল করে বাইপাস করতে পারে।

---

## ৩. লোড নিতে পারবে কি? — লেয়ার ধরে ধরে

### লেয়ার ১: Cloudflare Pages (ফ্রন্টএন্ড)
- স্ট্যাটিক অ্যাসেট: **আনলিমিটেড রিকোয়েস্ট ও ব্যান্ডউইথ** (ফ্রি প্ল্যানেও)।
- এজ নেটওয়ার্ক বিশ্বজুড়ে; DDoS absorption আছে।
- **সীমা:** যদি Pages Functions ব্যবহার করেন → Workers Free **১,০০,০০০ রিকোয়েস্ট/দিন**, ১০ ms CPU। এর বেশি হলে Error 1027।
- আমাদের টেস্টে `/api/health`-ও HTML ফেরত দেয় → ওই path-এ কোনো Function নেই (catch-all SPA)।
- **রায়:** ফ্রন্টএন্ড লেয়ার **প্রায় আনলিমিটেড**; ১০,০০০ কনকারেন্টেও ভাঙবে না, যদি Functions-এ প্রতিটি পেজ লোড না যায়।

### লেয়ার ২: মিউজিক API (আসল bottleneck)
- হোমপেজে কমপক্ষে ৪–৬টি ডেটা সোর্স: spotlight, recommendations, radios, trending, mood, auth session।
- এগুলো **ব্রাউজার থেকে সরাসরি** কল হয় (raw HTML-এ ডেটা নেই)।
- JioSaavn-এর কোনো অফিসিয়াল পাবলিক API নেই; বেশিরভাগ পাবলিক instance unofficial, rate-limited, মাঝে মাঝে বন্ধ। Audius-এর পাবলিক discovery node-ও rate-limit করে।
- যদি কোনো একটি **CORS proxy বা একক API instance** ব্যবহার করেন → সব ইউজারের কোটা এক জায়গায় → ১,০০০ ইউজারেই 429।
- যদি প্রতিটি ব্রাউজার সরাসরি API কল করে → কোটা per-IP; কিন্তু ভারতের CGNAT-এ অনেক ইউজার এক IP শেয়ার করে → তবু throttle হতে পারে।
- **রায়:** ৫০০ ইউজার পর্যন্ত সাধারণত ঠিক থাকবে; ১,০০০+ এ 429/timeout শুরু হওয়ার সম্ভাবনা। এখানেই ক্যাশিং লাগবে।

### লেয়ার ৩: Auth ও ডেটাবেস
আপনার backend কোনটি তা নিশ্চিত নই। দুটো সম্ভাব্যতার সংখ্যা:

| | Supabase Free | Firebase Spark |
|---|---|---|
| Auth | ৫০,০০০ MAU | ৫০,০০০ MAU |
| DB | ৫০০ MB | ১ GiB, **৫০,০০০ reads/দিন** |
| Egress | ৫ GB + ৫ GB cached/মাস | ১০ GiB/মাস |
| Realtime | ২০০ concurrent | — |
| Storage | ১ GB | Spark-এ সীমিত/Blaze লাগতে পারে |
| বড় ফাঁদ | **৭ দিন নিষ্ক্রিয় থাকলে project pause** | দৈনিক read quota শেষ হলে API বন্ধ |

**গুরুত্বপূর্ণ:** Firebase-এ প্রতিটি পেজ লোডে ৫টি read হলে **দিনে মাত্র ১০,০০০ পেজ ভিউ**-তেই ৫০k read শেষ। Supabase-এ ছবি/অডিও Supabase Storage-এ রাখলে ৫ GB egress খুব দ্রুত শেষ হবে — কভার/অডিও বাইরের CDN-এ রাখুন।

### লেয়ার ৪: অডিও স্ট্রিমিং
- ৩২০ kbps = **৪০ KB/সেকেন্ড = ১৪৪ MB/ঘণ্টা** প্রতি listener।
- ১,০০০ concurrent listener = **৪০ MB/s ≈ ৩২০ Mbps**; ১০,০০০ = **৩.২ Gbps**।
- JioSaavn/Audius CDN টেকনিক্যালি সামলাবে, কিন্তু hotlink ব্লক, geo-restriction, signed URL expiry এবং **লাইসেন্সিং** ঝুঁকি আছে। বড় হলে এটি ব্যবসায়িক/আইনি সমস্যা হবে, শুধু টেকনিক্যাল নয়।

### লেয়ার ৫: ক্লায়েন্ট (মোবাইল)
- ২–৩ MB first load + ৬০০ KB JS + ২৮টি ৫০০px কভার।
- ভারতের সাধারণ mid-range Android + 4G-তে LCP ৩–৫ সে, দুর্বল নেটওয়ার্কে ৮–১৫ সে।
- API waterfall (একটার পরে আরেকটা) থাকলে আরও ১–৩ সে যোগ।
- Skeleton না থাকায় খালি সেকশন দেখায় → perceived failure।

---

## ৪. সংখ্যায় capacity (অনুমান)

**ধরা হয়েছে:** প্রতি ইউজার ৩ সেকেন্ডে পেজ লোড করে; প্রতি পেজে ৫টি API কল; ১,০০০ ইউজার ≈ ৩৩ পেজ/সেকেন্ড।

| Concurrent | Page loads/min | API req/s (৫/load) | Cloudflare static | মিউজিক API | Auth/DB | রায় |
|---:|---:|---:|---|---|---|---|
| ১০০ | ~২,০০০ | ~১৬৭ | ✅ | ✅ সাধারণত ঠিক | ✅ | **আজই চালু করা যায়** |
| ৫০০ | ~১০,০০০ | ~৮৩৩ | ✅ | ⚠️ free proxy হলে ঝুঁকি | ⚠️ | সতর্কতার সাথে |
| ১,০০০ | ~২০,০০০ | ~১,৬৬৭ | ✅ | ❌ 429 শুরু | ⚠️ | API cache/paid দরকার |
| ৫,০০০ | ~১,০০,০০০ | ~৮,৩৩৩ | ✅ (fair use) | ❌ ভাঙবে | ❌ Blaze/Pro | backend hardening |
| ১০,০০০+ | ২,০০,০০০+ | ~১৬,৬৬৭ | ⚠️ attack-scale | ❌ | ❌ | এখনই নয় |

> এগুলো অভিজ্ঞতাভিত্তিক অনুমান, মাপা সংখ্যা নয়। আসল সংখ্যা পেতে `dashboard/`-এর ব্রাউজার টেস্ট ও `loadtest/k6-beatnest.js` চালান — এবং **API-এর আলাদা লোড টেস্ট** করুন।

### প্রথমে কী ভাঙবে (সম্ভাব্য ক্রম)
1. তৃতীয় পক্ষের মিউজিক API / CORS proxy → 429, timeout, খালি সেকশন।
2. ধীর মোবাইলে বড় JS + কভার → ৮–১৫ সে লোড।
3. Auth session/quota → লগইন ফেল, likes/downloads কাজ না করা।
4. অডিও CDN hotlink/geo/licence → গান বাজবে না।
5. Cloudflare Pages Functions (যদি থাকে) → দিনে ১ লক্ষ রিকোয়েস্টের পর 1027।
6. Cloudflare edge → প্রায় কখনোই নয়।

---

## ৫. "ইউজার বলছে সাইট লোড হচ্ছে না" — ডায়াগনস্টিক চেকলিস্ট

ইউজারের ফোনে/ব্রাউজারে এই ক্রমে দেখুন:

1. **DevTools → Network → Fetch/XHR** — লাল 429/403/CORS আছে কি? থাকলে API-ই কারণ।
2. **Console** — `blocked by CORS policy`, `Failed to fetch`, `429` খুঁজুন।
3. **Incognito + extension off** — Brave/ad-blocker অনেক সময় API/CDN ব্লক করে।
4. **মোবাইল ডেটা vs Wi-Fi** — ISP-ভেদে DNS/CDN রুট আলাদা।
5. **Clear site data / unregister service worker** — পুরোনো `beatnest-pwa-v1` cache আটকে থাকলে।
6. **DNS** — `1.1.1.1` বা `8.8.8.8` দিয়ে দেখুন।
7. **Google sign-in** — popup/third-party cookie block; incognito-তে আলাদা করে টেস্ট।
8. **অডিও autoplay** — ব্রাউজার policy; প্রথম tap-এর আগে গান বাজবে না (এটি স্বাভাবিক)।
9. **অন্য ডিভাইস/নেটওয়ার্ক** — একই সমস্যা হলে কোড/API; না হলে লোকাল নেটওয়ার্ক।
10. **API status** — কোন API, কোন instance ব্যবহার করছেন তা লগ করুন (Sentry/console)।

**দ্রুত সমাধান (UX):** প্রতিটি সেকশনে skeleton shimmer + "আবার চেষ্টা করুন" বাটন + API failure-এ cached/fallback ট্র্যাক দেখান। খালি `(0 picks)` কখনো দেখাবেন না — এটাই "সাইট ভাঙা" মনে হয়।

---

## ৬. Admin প্যানেল — এখনই যা করবেন

### P0 (আজ)
1. **Cloudflare Access** দিয়ে `/admin*` ঘিরে ফেলুন (Zero Trust Free — ৫০ ইউজার পর্যন্ত)। Google Workspace/email allowlist; OTP; session 8h.
2. **Server-side authorization** নিশ্চিত করুন — শুধু UI-তে `if (isAdmin)` নয়। প্রতিটি admin API-তে role check; Supabase হলে **RLS** এবং `service_role` key কখনো frontend-এ নয়।
3. **`X-Robots-Tag: noindex`** + `meta name="robots" content="noindex,nofollow"` + `robots.txt`-এ `Disallow: /admin`.
4. **Rate limit** login ও admin API-তে (Cloudflare WAF rate-limiting rule, প্রতি IP ৫–১০/মিনিট)।
5. **Audit log** — কে, কখন, কী বদলাল; ৯০ দিন রাখুন।
6. **2FA** admin account-এ; শেয়ার করা অ্যাডমিন অ্যাকাউন্ট নয়।
7. **Secrets** — frontend bundle-এ কোনো API secret/service key নেই তা নিশ্চিত করুন (`grep` করুন build output-এ)।

### P1 (এই সপ্তাহ)
- CSP: `default-src 'self'; img-src 'self' https://c.saavncdn.com https://*.audius.co data:; media-src https://*.saavncdn.com https://*.audius.co; connect-src 'self' <api-host>; frame-ancestors 'none'; base-uri 'self'`.
- HSTS: `max-age=31536000; includeSubDomains; preload`.
- `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Admin session timeout, refresh-token rotation, logout-all.
- Admin-এর জন্য আলাদা সাবডোমেইন (যেমন `admin.yourdomain.com`) — মূল অ্যাপের XSS থেকে আলাদা রাখতে।
- Backup ও restore drill (Supabase/Firebase free-এ backup নেই —ম্যানুয়াল export)।

### যাচাইয়ের নিরাপদ পদ্ধতি
- একটি **non-admin** Google account দিয়ে লগইন করে দেখুন admin API 403 দেয় কি না।
- DevTools-এ admin request-এর Authorization header/token কপি করে **আপনার নিজের** টেস্ট অ্যাকাউন্ট দিয়ে ভিন্ন role-এ কল করুন — অন্যের সাইটে নয়।
- Supabase হলে anon key দিয়ে `select` চালিয়ে দেখুন RLS ছাড়া ডেটা আসে কি না (নিজের প্রজেক্টে)।

---

## ৭. পারফরম্যান্স ও SEO — অগ্রাধিকার তালিকা

### P0 (এই সপ্তাহে)
| # | কাজ | কেন |
|---|---|---|
| 1 | `_headers` দিয়ে `/_next/static/*` → `Cache-Control: public, max-age=31536000, immutable` | repeat visit দ্রুত; bandwidth বাঁচে |
| 2 | হোমপেজের ডেটা **edge-cache** করুন (Cloudflare KV/Cache API, ৬০–৩০০ সে) অথবা build-time JSON | API 429 ও waterfall কমবে |
| 3 | Skeleton + error/retry state; `(0 picks)` সরান | perceived failure বন্ধ |
| 4 | `sitemap.xml` + `robots.txt`-এ Sitemap; Google Search Console-এ submit | index শুরু হবে |
| 5 | `og:image` ১২০০×৬৩০ + Twitter card | শেয়ারে প্রিভিউ |
| 6 | Admin `noindex` + Cloudflare Access | নিরাপত্তা |
| 7 | Custom domain কিনে canonical/OG বদলান; `beatnest.com` মেটা সরান | ব্র্যান্ড/SEO |

### P1 (২–৪ সপ্তাহ)
- কভার ইমেজ `?w=150`/`300` ভ্যারিয়েন্ট, `srcset`, `loading="lazy"` (fold-এর নিচে), hero-তে `fetchpriority="high"`.
- CDN preconnect: `c.saavncdn.com`, Audius content host.
- JS code-split; প্রথম লোডে ৬০০ KB কমান; unused dependency বাদ.
- ২৮টি কভারের জন্য `width`/`height` (CLS ঠেকাতে)।
- Radio card-এ CSS gradient (ইতিমধ্যে আছে) — ইমেজ নয়।
- Font: system font বা `font-display: swap`; render-blocking কমান।
- `beatnest-icon.png` ১৯২/৫১২ স্কয়ার, <৫০ KB; maskable আলাদা।
- `sw.js` cache version build hash-এ বদলান; stale chunk 404 হলে auto-reload।
- `/healthz` স্ট্যাটিক JSON + API-র জন্য আলাদা health endpoint।
- Cloudflare Web Analytics + Sentry (client error, API failure rate)।

### P2 (স্কেল)
- API gateway/Worker proxy + per-user rate limit + shared cache (KV/D1).
- API fallback: এক provider fail হলে অন্য provider।
- Audio: লাইসেন্সড/CDN-ভিত্তিক স্ট্রিমিং; hotlink নয়।
- Admin আলাদা ডেপ্লয়মেন্ট, WAF, IP allowlist (superadmin)।
- Load test staging-এ; production-এ শুধু low-rate smoke।

---

## ৮. আসল লোড টেস্ট কীভাবে করবেন

### ৮.১ ব্রাউজার ল্যাব (এখনই)
```bash
cd dashboard
python3 -m http.server 8000 --bind 0.0.0.0
```
তারপর `http://localhost:8000` খুলুন। এতে আছে:
- GET-only safe load test (max 40 concurrency, 60 s, 3,000 requests) — আপনার ব্রাউজার/ISP থেকে।
- লাইভ p50/p95/p99, RPS, success %, error breakdown.
- পেজ অডিট: status, latency, `Cache-Control`, JS/CSS chunk, meta, og:image, API host scan.
- API probe: আপনার backend/health URL থাকলে সেটাও টেস্ট করুন।

> এটি গ্লোবাল ডিস্ট্রিবিউটেড টেস্ট নয় — এক ক্লায়েন্টের দৃষ্টিকোণ। আসল capacity-র জন্য k6 লাগবে।

### ৮.২ k6 (আসল টেস্ট)
```bash
# install (mac)
brew install k6
# অথবা Linux
sudo apt install k6

# প্রথমে smoke: ৫ rps, ১ মিনিট
BASE_URL=https://beatnest.pages.dev RATE=5 DURATION=60s k6 run loadtest/k6-beatnest.js

# তারপর ramp: ৫ → ২০ → ৫০ rps
BASE_URL=https://beatnest.pages.dev RATE=20 k6 run loadtest/k6-beatnest.js

# admin শুধু পেজ লোড (login নয়)
BASE_URL=https://beatnest.pages.dev TARGET=/admin RATE=2 k6 run loadtest/k6-beatnest.js
```
**নিয়ম:** production-এ peak time-এ চালাবেন না; একবারে ৫০ rps-এর বেশি নয়; API-এর জন্য আলাদা টেস্ট; staging থাকলে সেখানে চালান।

### ৮.৩ API-র আসল টেস্ট
API endpoint ও auth token জানা থাকলে (নিজের staging-এ):
```bash
k6 run -e BASE_URL=https://your-api.example.com -e TARGET=/health loadtest/k6-beatnest.js
```
API-তে ২০০–৫০০ rps চালিয়ে 429/5xx দেখুন। এটাই আপনার আসল সিলিং।

---

## ৯. মনিটরিং (ফ্রি সেটআপ)

| টুল | কী দেখবে |
|---|---|
| Cloudflare Web Analytics | real user page views, LCP/INP (JS beacon) |
| BetterStack / UptimeRobot | ১ মিনিট interval, keyword `Recommended` বা `/healthz` |
| Sentry (free) | JS error, API fetch failure, slow transactions |
| Cloudflare Notifications | 5xx spike, bandwidth, Functions quota |
| Google Search Console | index, sitemap, Core Web Vitals |
| Supabase/Firebase dashboard | egress, reads, MAU, pause warning |

**অ্যালার্ট থ্রেশহোল্ড:** 5xx > 1% (৫ মিনিট), p95 > 2 সে, API 429 > 0.5%, uptime < 99.9%.

---

## ১০. স্কেলিং ও খরচ (রূপরেখা)

| পর্যায় | ইউজার | যা লাগবে | আনুমানিক খরচ |
|---|---|---|---|
| এখন | <৫০০ concurrent | Cloudflare Free + API cache + skeleton | $0 |
| Grow | ১–৫ হাজার | Cloudflare Free/Pro, API VPS/Worker + KV, Supabase Pro/Firebase Blaze | $5–৩০/মাস |
| Scale | ১০ হাজার+ | multi-instance API, Redis/KV cache, DB read replica, audio CDN, licensed catalog | $১০০+/মাস |

**সস্তা বড় লাভ:**
1. API response ৬০–৩০০ সে cache → ৮০–৯০% upstream কল কমে।
2. কভার ইমেজ responsive → ৫০–৭০% ইমেজ ব্যান্ডউইথ কমে।
3. JSON static/ISR → API ও DB read কমে।
4. `immutable` cache → repeat visit-এ JS/CSS আর ডাউনলোড হয় না।

---

## ১১. চূড়ান্ত রায়

| ক্ষেত্র | গ্রেড | মন্তব্য |
|---|---|---|
| Availability (আজ) | **A** | ১৯/২০ নোড OK; গ্লোবাল আউটেজ নেই |
| এজ/CDN | **A** | Cloudflare, HTTP/3, TLS 1.3, IPv6 |
| Caching | **D** | hashed asset-এও `max-age=0` |
| First-load performance | **C–** | ২–৩ MB, ৬০০ KB JS, ২৮ বড় কভার |
| Perceived reliability | **D** | API fail হলে খালি সেকশন, skeleton নেই |
| SEO/discoverability | **F** | sitemap নেই, index নেই, OG নেই, ভুল domain |
| Admin security | **D** | edge gate/noindex/headers নেই; server-side auth যাচাই দরকার |
| Scalability ceiling | **B–** | frontend unlimited; third-party API-ই সীমা |
| Brand/domain | **D** | `beatnest.com` বিক্রির জন্য; নামের দ্বন্দ্ব |

**সংক্ষেপে:** আজ ১০০–৫০০ ইউজার নিতে সমস্যা নেই। ১,০০০+ ইউজারে যাওয়ার আগে **API caching, skeletons, image optimization, admin hardening, sitemap/OG** — এই পাঁচটা করুন। Cloudflare-কে নিয়ে চিন্তা নেই; তৃতীয় পক্ষের API আর আপনার ক্লায়েন্ট কোডকেই সামলাতে হবে।

---

## ১২. প্রমাণ ও সূত্র (appendix)

- হোম ও `/admin`: `200`, `content-type: text/html`, Cloudflare, Brotli, `cache-control: max-age=0`.
- JS chunk: `/_next/static/chunks/44p1b9-n0yjp0.js` → `200`, `application/javascript`, gzip, `max-age=0`, ETag.
- CSS: `/_next/static/chunks/1z7fwjeivx9do.css` → `200`, `text/css`, gzip.
- Icon: `/beatnest-icon.png` → `200`, `139,034` bytes, `max-age=0`.
- `manifest.json` → ২০০, valid JSON; icons 192/512 declared.
- `sw.js` → ২০০; custom cache `beatnest-pwa-v1`.
- `sitemap.xml` → 404; `robots.txt` → ২০০ (শুধু কমেন্ট)।
- Raw HTML (JS ছাড়া): `(0 picks)`, `(0 tracks)` — ডেটা client-side।
- DNS: Cloudflare IPv4 + IPv6; TLS cert 16 Oct 2026 – 14 Jan 2027.
- check-host.net: ৬/৬ OK (BG 0.766s, FR 0.176s, ID 0.318s, IL 0.302s, US 0.277s, VN 0.866s); ২০-নোড চেকে ১৯/২০ OK; ভারত — Mumbai 0.346s, Rajpura 0.519s (দুটোই 200)।
- `beatnest.com` → HugeDomains "for sale".
- Google `site:beatnest.pages.dev` → 0 results.
- Cloudflare Pages limits: static unlimited; Functions 100k/day, 10ms CPU.
- Supabase Free: 500MB DB, 5GB+5GB egress, 50k MAU, 200 realtime, pause after 7 days.
- Firebase Spark: 50k reads/day, 20k writes/day, 1GiB, 10GiB/month egress.

**দায়স্বীকার:** উপরের capacity সংখ্যাগুলো অনুমান; বাস্তব ফল আপনার API, ডিভাইস, নেটওয়ার্ক ও ডেটা-ভলিউমের উপর নির্ভর করবে। এই অডিট কোনো penetration test বা legal/licensing পরামর্শ নয়।
