#!/usr/bin/env python3
"""Add Instagram (preferred) handles to final.csv when the account is theirs and recently active."""

from __future__ import annotations

import csv
import json
import os
import re
import ssl
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote_plus, unquote, urlparse
from urllib.request import Request, urlopen

FINAL = "/Users/whoshriyansh/Downloads/final.csv"
CACHE = "/Users/whoshriyansh/personal_projects/furviou_tool/scripts/social_cache.json"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
NOW = datetime(2026, 9, 2, tzinfo=timezone.utc)
RECENT_DAYS = 365  # posted in the last year = recently enough to use

IG_SKIP = {
    "instagram", "www", "p", "reel", "reels", "stories", "explore", "accounts",
    "about", "legal", "directory", "developer", "developers", "about-us",
    "share", "sharer", "intent", "static", "lite", "tv", "nametag", "emailsignup",
    "direct", "youractivity", "web", "popular", "tags", "locations", "ar",
}

HANDLE_RE = re.compile(r"^[A-Za-z0-9._]{2,30}$")
IG_URL_RE = re.compile(
    r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?",
    re.I,
)
IG_AT_RE = re.compile(r"(?:instagram(?:\.com)?[:\s/]+|ig[:\s]+)@?([A-Za-z0-9._]{2,30})", re.I)


def load_cache() -> dict:
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {"sites": {}, "ig": {}}


def save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f)


def fetch(url: str, timeout: int = 10, max_bytes: int = 250_000) -> tuple[int, str, str]:
    req = Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(req, timeout=timeout, context=CTX) as resp:
        raw = resp.read(max_bytes)
        try:
            text = raw.decode("utf-8", errors="ignore")
        except Exception:
            text = raw.decode("latin-1", errors="ignore")
        return resp.status, str(resp.geturl()), text


def fetch_soft(url: str, timeout: int = 10) -> str:
    try:
        _, _, html = fetch(url, timeout=timeout)
        return html or ""
    except HTTPError as e:
        try:
            return e.read(180_000).decode("utf-8", errors="ignore")
        except Exception:
            return ""
    except Exception:
        return ""


def norm_handle(raw: str) -> str:
    h = unquote(raw or "").strip().strip("/").lstrip("@").split("?")[0].split("#")[0]
    h = h.strip().lower()
    if h.endswith("/"):
        h = h[:-1]
    if h in IG_SKIP or not HANDLE_RE.match(h):
        return ""
    if h.replace(".", "").replace("_", "") == "":
        return ""
    return h


def handles_from_html(html: str) -> list[str]:
    found: list[str] = []
    for m in IG_URL_RE.finditer(html or ""):
        h = norm_handle(m.group(1))
        if h:
            found.append(h)
    # href="/username" on IG pages, and @handles next to Instagram labels
    for m in re.finditer(r'content=["\']@([A-Za-z0-9._]{2,30})["\']', html or "", re.I):
        h = norm_handle(m.group(1))
        if h:
            found.append(h)
    # de-dupe preserve order
    out = []
    seen = set()
    for h in found:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out


def site_url(website: str) -> str:
    w = (website or "").strip()
    if not w:
        return ""
    if not re.match(r"^https?://", w, re.I):
        return "https://" + w
    return w


def extract_site_socials(website: str) -> dict:
    url = site_url(website)
    out = {"website": website, "ok": False, "instagram": [], "error": ""}
    if not url:
        return out
    html = ""
    try:
        _, final, html = fetch(url)
        out["ok"] = True
        out["final"] = final
    except Exception:
        if url.startswith("https://"):
            try:
                _, final, html = fetch("http://" + url[len("https://") :])
                out["ok"] = True
                out["final"] = final
            except Exception as e:
                out["error"] = str(e)[:160]
                return out
        else:
            return out
    out["instagram"] = handles_from_html(html)
    return out


def parse_ig_timestamps(text: str) -> list[int]:
    stamps = []
    for m in re.finditer(r'"taken_at(?:_timestamp)?"\s*:\s*(\d{9,11})', text):
        stamps.append(int(m.group(1)))
    for m in re.finditer(r'"taken_at"\s*:\s*(\d{9,11})', text):
        stamps.append(int(m.group(1)))
    # ISO dates in 2024-2026
    for m in re.finditer(r"(20[2-3]\d)-(\d{2})-(\d{2})", text):
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31 and 2024 <= y <= 2026:
            try:
                dt = datetime(y, mo, d, tzinfo=timezone.utc)
                stamps.append(int(dt.timestamp()))
            except Exception:
                pass
    return stamps


def recent_enough(ts: int) -> bool:
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return (NOW - dt).days <= RECENT_DAYS and dt <= NOW


def relative_recent(text: str) -> bool:
    low = (text or "").lower()
    if re.search(r"\b(\d+|an?)\s+(hour|hr|minute|min|day|week|month)s?\s+ago\b", low):
        # "3 years ago" is not this pattern; years handled separately
        return True
    if re.search(r"\b(yesterday|today|just now)\b", low):
        return True
    if re.search(r"\b(\d+|an?)\s+years?\s+ago\b", low):
        return False
    return False


def verify_instagram(handle: str) -> dict:
    handle = norm_handle(handle)
    result = {
        "handle": handle,
        "exists": False,
        "recent": False,
        "source": "",
        "detail": "",
    }
    if not handle:
        return result

    pages = [
        ("profile", f"https://www.instagram.com/{handle}/"),
        ("jina", f"https://r.jina.ai/https://www.instagram.com/{handle}/"),
    ]
    texts = []
    for src, url in pages:
        html = fetch_soft(url, timeout=12)
        if not html or len(html) < 80:
            continue
        texts.append((src, html))
        low = html.lower()
        if "sorry, this page isn't available" in low or "page isn't available" in low:
            result["detail"] = "missing"
            continue
        stamps = parse_ig_timestamps(html)
        if stamps:
            latest = max(stamps)
            result["exists"] = True
            result["recent"] = recent_enough(latest)
            result["source"] = src
            result["detail"] = datetime.fromtimestamp(latest, tz=timezone.utc).date().isoformat()
            if result["recent"]:
                return result
        if relative_recent(html):
            result["exists"] = True
            result["recent"] = True
            result["source"] = src + "_relative"
            result["detail"] = "relative"
            return result
        # Profile exists with posts mentioned
        if f"instagram.com/{handle}" in low or f"@{handle}" in low:
            result["exists"] = True
            result["source"] = result["source"] or src

    # DuckDuckGo as last recency/existence check
    q = quote_plus(f"site:instagram.com/{handle}")
    ddg = fetch_soft(f"https://html.duckduckgo.com/html/?q={q}", timeout=10)
    if ddg:
        if f"instagram.com/{handle}" in ddg.lower() or handle in ddg.lower():
            result["exists"] = True
            result["source"] = result["source"] or "ddg"
        stamps = parse_ig_timestamps(ddg)
        if stamps and recent_enough(max(stamps)):
            result["recent"] = True
            result["detail"] = datetime.fromtimestamp(max(stamps), tz=timezone.utc).date().isoformat()
            result["source"] = "ddg"
            return result
        if relative_recent(ddg):
            result["recent"] = True
            result["source"] = "ddg_relative"
            return result

    return result


def tokens(s: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]{4,}", (s or "").lower()) if t not in {"http", "https", "www", "com", "llc", "inc", "ltd", "the"}}


def handle_matches_business(handle: str, biz: str, website: str, email: str) -> bool:
    ht = set(re.findall(r"[a-z0-9]{3,}", handle.lower().replace(".", " ").replace("_", " ")))
    ht.add(handle.lower().replace(".", "").replace("_", ""))
    pool = tokens(biz) | tokens(website) | tokens(email.split("@")[0] if email else "")
    host = urlparse(site_url(website)).netloc.lower().removeprefix("www.").split(".")[0]
    if host:
        pool.add(host)
        pool.add(host.replace("-", ""))
    if not pool:
        return False
    hflat = handle.lower().replace(".", "").replace("_", "")
    for p in pool:
        if len(p) >= 4 and (p in hflat or hflat in p):
            return True
    return bool(ht & pool)


def search_instagram(biz: str, website: str) -> list[str]:
    """Find candidate IG handles via search; still must be verified."""
    if not biz:
        return []
    q = quote_plus(f'"{biz}" instagram')
    html = fetch_soft(f"https://html.duckduckgo.com/html/?q={q}", timeout=10)
    handles = handles_from_html(html)
    # also parse uddg redirect links
    for m in re.finditer(r"uddg=([^&\"']+)", html or ""):
        url = unquote(m.group(1))
        handles.extend(handles_from_html(url))
    out = []
    seen = set()
    for h in handles:
        if h not in seen and handle_matches_business(h, biz, website, ""):
            seen.add(h)
            out.append(h)
    return out[:3]


def main() -> None:
    with open(FINAL, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
    if "Social Media" not in fieldnames:
        fieldnames.append("Social Media")

    cache = load_cache()
    sites = cache.setdefault("sites", {})
    igs = cache.setdefault("ig", {})

    unique_sites = []
    seen = set()
    for r in rows:
        w = (r.get("Website") or "").strip().lower()
        if w and w not in seen:
            seen.add(w)
            unique_sites.append(r.get("Website") or "")
    print(f"leads={len(rows)} unique_sites={len(unique_sites)}")

    to_fetch = [w for w in unique_sites if w.lower() not in {k.lower() for k in sites}]
    print(f"sites to fetch={len(to_fetch)} cached={len(sites)}")
    if to_fetch:
        done = 0
        with ThreadPoolExecutor(max_workers=20) as ex:
            futs = {ex.submit(extract_site_socials, w): w for w in to_fetch}
            for fut in as_completed(futs):
                w = futs[fut]
                try:
                    sites[w.lower()] = fut.result()
                except Exception as e:
                    sites[w.lower()] = {"ok": False, "instagram": [], "error": str(e)[:160]}
                done += 1
                if done % 40 == 0 or done == len(to_fetch):
                    print(f"  site extract {done}/{len(to_fetch)}")
                    save_cache(cache)
        save_cache(cache)

    # Collect candidate handles per row
    candidates = []  # (row_idx, handle, from_site)
    site_ig_count = 0
    for i, r in enumerate(rows):
        w = (r.get("Website") or "").strip()
        info = sites.get(w.lower(), {}) if w else {}
        found = list(info.get("instagram") or [])
        if found:
            site_ig_count += 1
        for h in found:
            candidates.append((i, h, True))
    print(f"rows with IG on website={site_ig_count} candidate_pairs={len(candidates)}")

    # Search fallback for rows with no site IG (unique businesses)
    need_search = []
    seen_biz = set()
    for i, r in enumerate(rows):
        w = (r.get("Website") or "").strip()
        info = sites.get(w.lower(), {}) if w else {}
        if info.get("instagram"):
            continue
        key = (r.get("Business Name") or "").strip().lower()
        if not key or key in seen_biz:
            continue
        seen_biz.add(key)
        need_search.append(i)
    print(f"businesses to search={len(need_search)}")

    search_cache = cache.setdefault("search", {})
    search_jobs = []
    for i in need_search:
        r = rows[i]
        biz = r.get("Business Name") or ""
        w = r.get("Website") or ""
        sk = biz.strip().lower() + "|" + w.strip().lower()
        if sk not in search_cache:
            search_jobs.append((sk, biz, w))
    print(f"searches to run={len(search_jobs)}")
    if search_jobs:
        done = 0
        with ThreadPoolExecutor(max_workers=6) as ex:
            futs = {ex.submit(search_instagram, biz, w): sk for sk, biz, w in search_jobs}
            for fut in as_completed(futs):
                sk = futs[fut]
                try:
                    search_cache[sk] = fut.result() or []
                except Exception:
                    search_cache[sk] = []
                done += 1
                if done % 25 == 0 or done == len(search_jobs):
                    print(f"  searched {done}/{len(search_jobs)}")
                    save_cache(cache)
        save_cache(cache)
    for i in need_search:
        r = rows[i]
        sk = (r.get("Business Name") or "").strip().lower() + "|" + (r.get("Website") or "").strip().lower()
        found_h = search_cache.get(sk) or []
        if found_h:
            biz_l = (r.get("Business Name") or "").strip().lower()
            for j, r2 in enumerate(rows):
                if (r2.get("Business Name") or "").strip().lower() == biz_l:
                    for h in found_h:
                        candidates.append((j, h, False))
    print(f"search finished candidate_pairs={len(candidates)}")

    # Verify unique handles
    unique_handles = []
    seen_h = set()
    for _, h, _ in candidates:
        if h not in seen_h:
            seen_h.add(h)
            unique_handles.append(h)
    to_verify = [h for h in unique_handles if h not in igs]
    print(f"unique handles={len(unique_handles)} to_verify={len(to_verify)}")

    if to_verify:
        done = 0
        with ThreadPoolExecutor(max_workers=8) as ex:
            futs = {ex.submit(verify_instagram, h): h for h in to_verify}
            for fut in as_completed(futs):
                h = futs[fut]
                try:
                    igs[h] = fut.result()
                except Exception as e:
                    igs[h] = {"handle": h, "exists": False, "recent": False, "detail": str(e)[:120]}
                done += 1
                if done % 20 == 0 or done == len(to_verify):
                    print(f"  ig verify {done}/{len(to_verify)}")
                    save_cache(cache)
        save_cache(cache)

    # Apply: Instagram handle only if theirs + recent. Never drop a row.
    added = 0
    from_site = 0
    from_search = 0
    for r in rows:
        r["Social Media"] = r.get("Social Media") or ""

    # prefer site-sourced, then search; first recent handle wins
    by_row: dict[int, list[tuple[str, bool]]] = {}
    for i, h, on_site in candidates:
        by_row.setdefault(i, []).append((h, on_site))

    for i, opts in by_row.items():
        chosen = ""
        chosen_site = False
        r = rows[i]
        biz = r.get("Business Name") or ""
        web = r.get("Website") or ""
        email = r.get("Email") or ""
        # site handles first
        ordered = sorted(opts, key=lambda x: (not x[1], x[0]))
        for h, on_site in ordered:
            v = igs.get(h) or {}
            if not v.get("recent"):
                continue
            if on_site or handle_matches_business(h, biz, web, email):
                chosen = "@" + h
                chosen_site = on_site
                break
        if chosen:
            rows[i]["Social Media"] = chosen
            added += 1
            if chosen_site:
                from_site += 1
            else:
                from_search += 1

    with open(FINAL, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"\nWrote {FINAL}")
    print(f"rows={len(rows)} with_social={added} from_site={from_site} from_search={from_search} blank={len(rows)-added}")
    print("sample:")
    n = 0
    for r in rows:
        if r.get("Social Media"):
            print(f"  {r['Business Name'][:40]:40s} {r['Social Media']}")
            n += 1
            if n >= 15:
                break


if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"elapsed {time.time()-t0:.1f}s")
