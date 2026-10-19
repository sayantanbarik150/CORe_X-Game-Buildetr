# Beatnest — Load Audit ও Test Lab

**টার্গেট:** <https://beatnest.pages.dev> · **Admin:** <https://beatnest.pages.dev/admin>  
**অডিট:** ১৯ অক্টোবর ২০২৬ (ব্ল্যাক-বক্স; কোনো লগইন/ক্রেডেনশিয়াল ছাড়া)

এই রিপোতে Beatnest-এর সোর্স কোড নেই — এখানে অডিট রিপোর্ট ও পুনরায় চালানোর মতো টেস্ট টুল আছে।

## কী আছে

| পাথ | কী |
|---|---|
| [`docs/beatnest-audit-bn.md`](docs/beatnest-audit-bn.md) | সম্পূর্ণ রিপোর্ট (বাংলা) — availability, capacity, admin security, SEO, ফিক্স প্ল্যান |
| [`dashboard/`](dashboard/) | ব্রাউজারেই লোড টেস্ট + লাইভ পেজ অডিট + API probe (কোনো backend নেই) |
| [`loadtest/smoke.sh`](loadtest/smoke.sh) | ৩০ সেকেন্ডের smoke: status, cache, security headers, SEO signal |
| [`loadtest/k6-beatnest.js`](loadtest/k6-beatnest.js) | k6 ramp load test (GET-only, body ডাউনলোড ছাড়া) |
| [`loadtest/README-bn.md`](loadtest/README-bn.md) | টেস্ট চালানোর ধাপে ধাপে নির্দেশনা |
| [`docs/fixes/`](docs/fixes/) | রেডি `_headers`, `robots.txt`, `sitemap.xml` ও Cloudflare Access গাইড |
| [`.github/workflows/beatnest-smoke.yml`](.github/workflows/beatnest-smoke.yml) | প্রতিদিনের smoke (ঐচ্ছিক) |

## ড্যাশবোর্ড চালান

```bash
cd dashboard
python3 -m http.server 8000 --bind 0.0.0.0
```

তারপর `http://localhost:8000` খুলুন। ড্যাশবোর্ডটি আপনার ব্রাউজার থেকেই
`https://beatnest.pages.dev`-এ রিকোয়েস্ট পাঠায় (CORS অনুমতি আছে)।

## এক নজরে ফল

- **Availability:** ২০টি গ্লোবাল নোডের ১৯টি থেকে `200 OK`, ০.০৭–০.৮৭ সেকেন্ড — আজ সাইট আপ।
- **Frontend:** Cloudflare Pages-এ static request/bandwidth আনলিমিটেড; ১০০–৫০০ কনকারেন্ট আজই সামলাবে।
- **আসল সীমা:** গানের ডেটা client-side API (JioSaavn/Audius) থেকে আসে; API slow/429 হলে পেজে `(0 picks)`/`(0 tracks)` — "সাইট লোড হচ্ছে না" এর প্রধান কারণ।
- **Caching:** hashed JS/CSS/icon-এও `Cache-Control: max-age=0` — বড় সহজ লাভ।
- **Admin:** পাবলিক, `noindex` নেই, Cloudflare Access নেই, security headers নেই; server-side authorization যাচাই করা হয়নি।
- **SEO:** `sitemap.xml` 404, Google-এ index নেই, `og:image` নেই, canonical `pages.dev`; **`beatnest.com` আপনার নয় — HugeDomains-এ বিক্রির জন্য**।

বিস্তারিত ও প্রায়োরিটি লিস্ট: [`docs/beatnest-audit-bn.md`](docs/beatnest-audit-bn.md)।

## সীমাবদ্ধতা

- এই পরিবেশ থেকে সরাসরি হাজার-হাজার রিকোয়েস্টের লোড টেস্ট চালানো যায়নি; ড্যাশবোর্ড/`k6` আপনার দিক থেকে চালান।
- কোনো লগইন, পাসওয়ার্ড, payment বা admin mutation টেস্ট করা হয়নি।
- capacity সংখ্যাগুলো অনুমান — আপনার API, ডিভাইস ও নেটওয়ার্কভেদে বদলাবে।
