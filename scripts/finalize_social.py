#!/usr/bin/env python3
"""Add Instagram handles from each lead's own website when the profile still exists."""

from __future__ import annotations

import csv
import json
import os
import re
import ssl
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError

FINAL = "/Users/whoshriyansh/Downloads/final.csv"
CACHE = "/Users/whoshriyansh/personal_projects/furviou_tool/scripts/social_cache.json"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()

JUNK = {
    "instagram", "www", "p", "reel", "reels", "stories", "explore", "accounts",
    "share", "sharer", "intent", "linktree", "linktr.ee", "yourpage", "username",
    "profile", "user", "name", "here", "page", "official", "instagram.com",
}


def norm(h: str) -> str:
    h = (h or "").strip().lstrip("@").lower().split("?")[0].strip("/")
    if not re.match(r"^[a-z0-9._]{2,30}$", h):
        return ""
    if h in JUNK or h.replace(".", "").replace("_", "") in JUNK:
        return ""
    if h.endswith("___") or h.endswith("."):
        return ""
    if h in {"wix", "squarespace", "tailorbrands", "vacasa"} or h.startswith("vacasa"):
        return ""
    return h


def profile_exists(handle: str) -> dict:
    url = f"https://www.instagram.com/{handle}/"
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        with urlopen(req, timeout=10, context=CTX) as resp:
            html = resp.read(120_000).decode("utf-8", errors="ignore")
            status = resp.status
    except HTTPError as e:
        html = ""
        try:
            html = e.read(80_000).decode("utf-8", errors="ignore")
        except Exception:
            pass
        status = e.code
    except Exception as e:
        return {"handle": handle, "exists": False, "detail": str(e)[:80]}

    low = html.lower()
    if "sorry, this page isn't available" in low or "page isn't available" in low:
        return {"handle": handle, "exists": False, "detail": "missing"}
    title_m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    title = (title_m.group(1) if title_m else "").lower()
    if handle in title or "instagram" in title or f"@{handle}" in low or f"instagram.com/{handle}" in low:
        return {"handle": handle, "exists": True, "detail": "profile", "status": status}
    # Login wall on a 200 is common for real profiles
    if status == 200 and len(html) > 2000:
        return {"handle": handle, "exists": True, "detail": "login_wall", "status": status}
    return {"handle": handle, "exists": False, "detail": f"status_{status}"}


def best_handle(handles: list[str], biz: str, website: str) -> str:
    clean = []
    seen = set()
    for h in handles:
        n = norm(h)
        if n and n not in seen:
            seen.add(n)
            clean.append(n)
    if not clean:
        return ""
    blob = re.sub(r"[^a-z0-9]", "", f"{biz} {website}".lower())
    scored = []
    for h in clean:
        flat = h.replace(".", "").replace("_", "")
        score = 0
        if flat and flat in blob:
            score += 5
        for part in re.findall(r"[a-z0-9]{4,}", h.replace(".", " ").replace("_", " ")):
            if part in blob:
                score += 2
        scored.append((score, h))
    scored.sort(reverse=True)
    return scored[0][1]


def main() -> None:
    with open(FINAL, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    cache = {}
    if os.path.exists(CACHE):
        cache = json.load(open(CACHE, encoding="utf-8"))
    sites = cache.get("sites") or {}
    igs = cache.get("ig") or {}

    # Collect website -> handles
    needed = set()
    for r in rows:
        w = (r.get("Website") or "").strip().lower()
        info = sites.get(w) or {}
        for h in info.get("instagram") or []:
            n = norm(h)
            if n:
                needed.add(n)

    to_check = [h for h in sorted(needed) if h not in igs or "exists" not in igs[h]]
    print(f"rows={len(rows)} site_handles={len(needed)} to_check={len(to_check)} cached_ig={len(igs)}")

    if to_check:
        done = 0
        with ThreadPoolExecutor(max_workers=10) as ex:
            futs = {ex.submit(profile_exists, h): h for h in to_check}
            for fut in as_completed(futs):
                h = futs[fut]
                try:
                    igs[h] = fut.result()
                except Exception as e:
                    igs[h] = {"handle": h, "exists": False, "detail": str(e)[:80]}
                done += 1
                if done % 25 == 0 or done == len(to_check):
                    print(f"  checked {done}/{len(to_check)}")
        cache["ig"] = igs
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(cache, f)

    exists_n = sum(1 for h in needed if (igs.get(h) or {}).get("exists"))
    print(f"existing profiles among site handles: {exists_n}/{len(needed)}")

    fieldnames = [c for c in rows[0].keys() if c != "Social Media"] + ["Social Media"]
    added = 0
    for r in rows:
        w = (r.get("Website") or "").strip().lower()
        info = sites.get(w) or {}
        handle = best_handle(info.get("instagram") or [], r.get("Business Name") or "", w)
        ok = bool(handle) and bool((igs.get(handle) or {}).get("exists"))
        r["Social Media"] = f"@{handle}" if ok else ""
        if ok:
            added += 1

    # Same website -> same handle already applied per row.

    with open(FINAL, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"wrote {FINAL} rows={len(rows)} with_instagram={added} blank={len(rows)-added}")
    print("top handles", Counter(r["Social Media"] for r in rows if r["Social Media"]).most_common(12))


if __name__ == "__main__":
    main()
