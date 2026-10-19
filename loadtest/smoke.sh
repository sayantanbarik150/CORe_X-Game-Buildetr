#!/usr/bin/env bash
# Beatnest — smoke test (GET/HEAD only, no login, no credentials)
# Usage:
#   bash loadtest/smoke.sh
#   SITE=https://beatnest.pages.dev bash loadtest/smoke.sh
# Exit code: 0 = no hard failure, 1 = hard failure.

set -uo pipefail

SITE="${SITE:-https://beatnest.pages.dev}"
TIMEOUT="${TIMEOUT:-15}"
FAIL=0
WARN=0

if [ -t 1 ]; then
  R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; B='\033[0;36m'; D='\033[0m'; BOLD='\033[1m'
else
  R=''; G=''; Y=''; B=''; D=''; BOLD=''
fi

pass() { printf "  ${G}✓ PASS${D}  %s\n" "$1"; }
warn() { printf "  ${Y}! WARN${D}  %s\n" "$1"; WARN=$((WARN + 1)); }
fail() { printf "  ${R}✕ FAIL${D}  %s\n" "$1"; FAIL=$((FAIL + 1)); }
info() { printf "  ${B}·${D}       %s\n" "$1"; }
section() { printf "\n${BOLD}%s${D}\n" "$1"; }

# curl_out URL -> "code|time|bytes" (code 000 on network error)
curl_out() {
  local url="$1" out
  out=$(curl -sS -o /dev/null --max-time "$TIMEOUT" -w '%{http_code}|%{time_total}|%{size_download}' "$url" 2>/dev/null) || true
  if [ -z "$out" ]; then
    echo "000|0|0"
  else
    echo "$out"
  fi
}

check_status() {
  local name="$1" url="$2" expected="$3" mode="$4"
  local out code time bytes
  out=$(curl_out "$url")
  code=${out%%|*}; time=$(echo "$out" | cut -d'|' -f2); bytes=$(echo "$out" | cut -d'|' -f3)
  if echo " $expected " | grep -q " $code "; then
    pass "$name — HTTP $code, ${time}s, ${bytes}B"
  elif [ "$mode" = "warn" ]; then
    warn "$name — HTTP $code (expected $expected), ${time}s"
  else
    fail "$name — HTTP $code (expected $expected), ${time}s"
  fi
}

headers() { curl -sSI --max-time "$TIMEOUT" "$1" 2>/dev/null || true; }
has_header() { echo "$1" | grep -qi "^$2:"; }
header_val() { echo "$1" | grep -i "^$2:" | head -n1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d '\r'; }

printf "\n${BOLD}Beatnest smoke test${D}\n"
printf "site: %s\ntime: %s\n" "$SITE" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

## 1. Core pages
section "1) Core pages"
check_status "Home /" "$SITE/" "200" "fail"
check_status "Admin /admin" "$SITE/admin" "200 301 302 401 403" "fail"
check_status "Manifest" "$SITE/manifest.json" "200" "fail"
check_status "Service worker /sw.js" "$SITE/sw.js" "200" "fail"
check_status "robots.txt" "$SITE/robots.txt" "200" "fail"
check_status "sitemap.xml" "$SITE/sitemap.xml" "200" "warn"
check_status "PWA icon" "$SITE/beatnest-icon.png" "200" "fail"

## 2. HTML & assets
section "2) HTML & assets"
HTML=$(curl -sS --max-time "$TIMEOUT" "$SITE/" 2>/dev/null || true)
if echo "$HTML" | grep -qi '<title>'; then
  TITLE=$(echo "$HTML" | grep -o '<title>[^<]*</title>' | head -n1 | sed 's/<[^>]*>//g')
  pass "HTML title: ${TITLE:-found}"
else
  fail "HTML title পাওয়া যায়নি"
fi

CHUNK=$(printf '%s' "$HTML" | grep -oE '/_next/static/chunks/[A-Za-z0-9._-]+\.js' | head -n1)
if [ -n "$CHUNK" ]; then
  check_status "JS entry ${CHUNK}" "$SITE$CHUNK" "200" "fail"
else
  warn "HTML-এ JS chunk পাওয়া যায়নি"
fi

## 3. Cache headers
section "3) Cache headers"
H=$(headers "$SITE/")
HC=$(header_val "$H" "cache-control")
info "HTML Cache-Control: ${HC:-none}"
if echo "$HC" | grep -qi 'max-age=0'; then
  warn "HTML max-age=0 — edge caching/s-maxage বিবেচনা করুন"
fi

if [ -n "$CHUNK" ]; then
  JH=$(headers "$SITE$CHUNK")
  JC=$(header_val "$JH" "cache-control")
  info "JS Cache-Control: ${JC:-none}"
  if echo "$JC" | grep -qiE 'immutable|max-age=31536000'; then
    pass "JS hashed asset-এ long-term cache আছে"
  else
    warn "JS hashed asset-এ immutable cache নেই (বর্তমানে: ${JC:-none})"
  fi
fi

## 4. Security headers
section "4) Security headers"
H=$(headers "$SITE/")
for hdr in "strict-transport-security" "content-security-policy" "x-frame-options" "permissions-policy"; do
  if has_header "$H" "$hdr"; then
    pass "$hdr আছে"
  else
    warn "$hdr নেই"
  fi
done
if echo "$H" | grep -qi '^access-control-allow-origin: \*'; then
  warn "HTML-এ Access-Control-Allow-Origin: * — দরকার নেই"
fi
if echo "$H" | grep -qi '^alt-svc:'; then
  info "HTTP/3 advertised: $(header_val "$H" "alt-svc")"
fi

## 5. Admin & SEO signals
section "5) Admin & SEO signals"
ADMIN_HTML=$(curl -sS --max-time "$TIMEOUT" "$SITE/admin" 2>/dev/null || true)
if echo "$ADMIN_HTML" | grep -qiE 'name="robots"[^>]*noindex|content="noindex'; then
  pass "Admin noindex আছে"
else
  warn "Admin noindex নেই"
fi

if echo "$HTML" | grep -qi 'property="og:image"'; then
  pass "og:image আছে"
else
  warn "og:image নেই"
fi

ROBOTS=$(curl -sS --max-time "$TIMEOUT" "$SITE/robots.txt" 2>/dev/null || true)
if echo "$ROBOTS" | grep -qi '^sitemap:'; then
  pass "robots.txt-এ Sitemap আছে"
else
  warn "robots.txt-এ Sitemap directive নেই"
fi

## 6. TLS / latency sample
section "6) Latency sample (5 runs)"
TOTAL=0
for i in 1 2 3 4 5; do
  out=$(curl_out "$SITE/")
  t=$(echo "$out" | cut -d'|' -f2)
  TOTAL=$(awk -v a="$TOTAL" -v b="$t" 'BEGIN { printf "%.4f", a + b }')
done
AVG=$(awk -v total="$TOTAL" 'BEGIN { printf "%.3f", total / 5 }')
info "5-run average: ${AVG}s (নেটওয়ার্কভেদে বদলাবে)"

## Summary
section "Summary"
printf "  failures: %s\n  warnings: %s\n\n" "$FAIL" "$WARN"
if [ "$FAIL" -gt 0 ]; then
  printf "${R}${BOLD}Smoke test FAILED${D}\n"
  exit 1
fi
printf "${G}${BOLD}Smoke test passed${D} (warnings মেরে ফেলা হয়নি, রিপোর্টে দেখুন)\n"
