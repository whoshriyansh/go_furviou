#!/usr/bin/env python3
"""Filter draft.csv leads, research websites, write personalized final.csv."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import ssl
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

DRAFT = "/Users/whoshriyansh/Downloads/draft.csv"
FINAL = "/Users/whoshriyansh/Downloads/final.csv"
CACHE = "/Users/whoshriyansh/personal_projects/furviou_tool/scripts/lead_probe_cache.json"

NA = {"", "n/a", "na", "n", "none", "-", "null", "nil"}
EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.I)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()

CHAIN_NAME = [
    "sam's club",
    "sams club",
    "restaurant depot",
    "rental center at the home depot",
    "home depot",
    "lowe's home improvement",
    "lowes home improvement",
    "rent-a-center",
    "rent a center",
    "aaron's rent",
    "aarons rent",
    "sunbelt rentals",
    "flowers baking",
    "flowers foods",
    "u-haul",
    "uhaul",
    "united rentals",
    "alstom",
    "randa apparel",
    "costco",
    "walmart",
    "landing furnished apartments",
    "cort furniture",
    "cort events",
    "sublet.com",
    "sysco",
    "us foods",
    "usfoods",
    "chef'store",
    "chefstore",
]
CHAIN_DOMAIN = [
    "samsclub.com",
    "restaurantdepot.com",
    "homedepot.com",
    "lowes.com",
    "rentacenter.com",
    "aarons.com",
    "sunbeltrentals.com",
    "flowersfoods.com",
    "alstom.com",
    "randa.net",
    "costco.com",
    "walmart.com",
    "uhaul.com",
    "unitedrentals.com",
    "hellolanding.com",
    "boarshead.com",
    "jetrord.com",
    "cort.com",
    "cortevents.com",
    "stores.cort.com",
    "sublet.com",
    "sysco.com",
    "usfoods.com",
    "usfood.com",
    "chefstore.com",
]
CHAIN_EMAIL_DOM = {
    "homedepot.com",
    "samsclub.com",
    "flowersindustries.com",
    "m.knck.io",
    "entrata.com",
    "greystar.com",
    "cort.com",
    "cort1.com",
    "sysco.com",
    "usfoods.com",
    "usfood.com",
}
SAAS_NAMES = {
    "wattch",
    "sela",
    "monstro",
    "wuuii",
    "bills treasury app",
    "tipsiti",
    "faith 4 funds",
    "cleverfi",
    "shifty",
    "onow ascent",
    "go2work",
    "gaya",
    "parra",
    "descrybe",
    "rightblogger",
    "aclymate",
    "local falcon",
    "notenest",
    "sno sites",
    "soul azul media",
}
DEAD_NOTES = [
    "not in business",
    "site is not connected",
]
FAKE_EMAILS = {"hello@info.com", "n/", "n@a.com", "info@info.com", "test@test.com"}

# Categories that are a strong fit for a custom website / digital service.
FIT_HINTS = {
    "party": "Party & Event Rentals",
    "bounce": "Party & Event Rentals",
    "vacation": "Vacation Rentals",
    "cabin rental": "Vacation Rentals",
    "short term": "Vacation Rentals",
    "furniture rental": "Furniture Rental",
    "apartment": "Apartments & Property",
    "condominium": "Apartments & Property",
    "property management": "Property Management",
    "real estate": "Real Estate",
    "realtor": "Real Estate",
    "nursery": "Wholesale Nursery & Plants",
    "plant nursery": "Wholesale Nursery & Plants",
    "seafood": "Wholesale / Distribution",
    "bakery": "Wholesale / Distribution",
    "produce": "Wholesale / Distribution",
    "wholesale": "Wholesale / Distribution",
    "wholesaler": "Wholesale / Distribution",
    "industrial equipment": "Equipment Sales & Rental",
    "equipment rental": "Equipment Sales & Rental",
    "equipment supplier": "Equipment Sales & Rental",
    "construction equipment": "Equipment Sales & Rental",
    "material handling": "Equipment Sales & Rental",
    "forklift": "Equipment Sales & Rental",
    "lawn equipment": "Equipment Sales & Rental",
    "auto accessories": "Auto Accessories / Parts",
    "car accessories": "Auto Accessories / Parts",
    "auto parts": "Auto Accessories / Parts",
    "window tint": "Auto Accessories / Parts",
    "contractor": "Construction & Contracting",
    "construction": "Construction & Contracting",
    "remodel": "Construction & Contracting",
    "design-build": "Construction & Contracting",
    "gallery kbny": "Construction & Contracting",
    "buildda": "Construction & Contracting",
    "plumbing": "Home Services",
    "landscap": "Home Services",
    "food manufacturer": "Wholesale / Distribution",
    "beverage": "Wholesale / Distribution",
    "flower market": "Wholesale Nursery & Plants",
    "car stereo": "Auto Accessories / Parts",
    "marine supply": "Auto Accessories / Parts",
    "disposable": "Wholesale / Distribution",
    "farm": "Wholesale Nursery & Plants",
    "meat products": "Wholesale / Distribution",
    "furniture store": "Furniture & Home",
    "furniture wholesaler": "Wholesale / Distribution",
    "cabinet": "Furniture & Home",
    "carpet": "Wholesale / Distribution",
    "grocery": "Wholesale / Distribution",
    "distribution": "Wholesale / Distribution",
    "warehouse": "Wholesale / Distribution",
}


def clean(s: str | None) -> str:
    return (s or "").replace("\u200b", "").replace("\xa0", " ").strip()


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", clean(s)).strip()


def is_na(s: str | None) -> bool:
    return clean(s).lower() in NA


def first_email(raw: str) -> str:
    if is_na(raw):
        return ""
    found = EMAIL_RE.findall(raw.replace("\n", " "))
    for e in found:
        el = e.lower().strip(".,;<>")
        if el in FAKE_EMAILS:
            continue
        return el
    return ""


GENERIC_LOCAL = {
    "info", "hello", "sales", "admin", "contact", "office", "support", "customerservice",
    "booking", "reservations", "rental", "rentals", "vacationrentals", "webmaster",
    "marketing", "inquiries", "enquiry", "mail", "email", "team", "help", "service",
    "accounts", "billing", "noreply", "no-reply", "owner", "manager", "stay", "orders",
    "events", "wecare", "frontdesk", "accounting", "careers", "jobs", "parts",
    "wholesale", "retail", "store", "shop", "media", "press", "hr", "reception",
    "front", "desk", "bookings", "reserve", "inquiry", "enquiries", "customers",
    "customer", "cs", "ops", "operations", "dispatch", "rent", "party", "vacation",
}

FREE_EMAIL = {
    "gmail.com", "yahoo.com", "hotmail.com", "aol.com", "outlook.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "live.com", "ymail.com", "att.net",
    "sbcglobal.net", "bellsouth.net", "comcast.net", "verizon.net", "proton.me",
    "protonmail.com", "mail.com", "zoho.com",
}


def split_name(full: str) -> tuple[str, str]:
    full = norm(full)
    if is_na(full) or "@" in full:
        return "", ""
    full = full.split("\n")[0]
    full = re.split(r"\s+and\s+", full, flags=re.I)[0]
    full = re.split(r"[,/&]", full)[0].strip()
    parts = [p for p in re.split(r"\s+", full) if p]
    if not parts:
        return "", ""
    skip = {"mr", "mrs", "ms", "dr", "sir"}
    if parts[0].lower().rstrip(".") in skip:
        parts = parts[1:]
    if not parts:
        return "", ""
    first = parts[0].title()
    last = " ".join(parts[1:]).title() if len(parts) > 1 else ""
    return first, last


def name_from_email(email: str) -> tuple[str, str]:
    local = email.split("@")[0].lower()
    local = local.split("+")[0]
    if local in GENERIC_LOCAL or local.isdigit():
        return "", ""
    if "." in local:
        a, b = local.split(".", 1)
        b = b.split(".")[0]
        if a.isalpha() and b.isalpha() and len(a) > 1 and len(b) > 1 and a not in GENERIC_LOCAL:
            return a.title(), b.title()
    return "", ""


def tokens(s: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]{4,}", s.lower()) if t not in {"http", "https", "www", "com", "llc", "inc", "ltd"}]


def is_junk_web_host(host: str) -> bool:
    h = (host or "").lower()
    return (
        not h
        or h.startswith("cloud.email.")
        or h.startswith("email.")
        or h.startswith("mail.")
        or h.startswith("e.")
        or "linktr.ee" == h
    )


def prefer_website(biz: str, email: str, website: str) -> str:
    ed = email.split("@")[-1].lower() if "@" in email else ""
    wh = host_of(website)
    if is_junk_web_host(wh):
        website = ""
        wh = ""
    if not ed or ed in FREE_EMAIL:
        return website
    if not website:
        return "https://" + ed
    if wh == ed or wh.endswith("." + ed) or ed.endswith("." + wh):
        return website
    biz_toks = tokens(biz)
    email_hits = sum(1 for t in biz_toks if t in ed)
    web_hits = sum(1 for t in biz_toks if t in wh)
    if email_hits > web_hits:
        return "https://" + ed
    return website


def pretty_site(url: str) -> str:
    if not url or is_na(url):
        return ""
    host = host_of(url)
    return host or decode_scraped_url(url)


def decode_scraped_url(w: str) -> str:
    w = clean(w)
    if is_na(w):
        return ""
    w = (
        w.replace("%3F", "?")
        .replace("%3D", "=")
        .replace("%26", "&")
        .replace("%3f", "?")
        .replace("%3d", "=")
        .replace("%26", "&")
    )
    return w


def host_of(url: str) -> str:
    try:
        p = urlparse(url if "://" in url else "https://" + url)
        return (p.netloc or "").lower().removeprefix("www.")
    except Exception:
        return ""


def absolute_url(w: str) -> str:
    w = decode_scraped_url(w)
    if not w:
        return ""
    if not re.match(r"^https?://", w, re.I):
        w = "https://" + w
    return w


def categorize(biz: str, btype: str, website: str, notes: str) -> str:
    blob = f"{btype} {biz} {notes} {website}".lower()
    for needle, cat in FIT_HINTS.items():
        if needle in blob:
            return cat
    if any(x in blob for x in ["realtor", "realty", "real estate", "real-estate", "kw.com", "exprealty", "royallepage", "sotheby"]):
        return "Real Estate"
    if any(x in blob for x in ["plumb", "sewer"]):
        return "Home Services"
    if any(x in blob for x in ["contract", "build", "remodel"]):
        return "Construction & Contracting"
    if btype:
        return norm(btype)
    return "Local Service Business"


def is_chain(biz: str, email: str, website: str) -> bool:
    b = biz.lower()
    h = host_of(website)
    ed = email.split("@")[-1].lower() if "@" in email else ""
    if any(x in b for x in CHAIN_NAME):
        return True
    if any(h == d or h.endswith("." + d) for d in CHAIN_DOMAIN):
        return True
    if ed in CHAIN_EMAIL_DOM:
        return True
    if b.strip() in {"vrbo", "airbnb"}:
        return True
    return False


def is_saas(biz: str) -> bool:
    return norm(biz).lower() in SAAS_NAMES


def is_dead_note(notes: str) -> bool:
    n = notes.lower()
    return any(x in n for x in DEAD_NOTES)


def platform_kind(url: str) -> str:
    u = url.lower()
    h = host_of(url)
    if not url or is_na(url):
        return "none"
    if h in {"facebook.com", "fb.com", "m.facebook.com"}:
        return "facebook"
    if h in {"instagram.com"}:
        return "instagram"
    if h in {"linktr.ee", "linktree.com"}:
        return "linktree"
    if "wixsite.com" in h or h.endswith("wix.com"):
        return "wix"
    if "weebly.com" in h:
        return "weebly"
    if "sites.google.com" in u or h == "business.site":
        return "google_sites"
    if any(x in h for x in ["vrbo.com", "airbnb.com", "hipcamp.com", "homesnap.com"]):
        return "listing_platform"
    if "blogspot." in h or "blogger.com" in h:
        return "blogger"
    if h in {"google.com", "maps.google.com", "maps.app.goo.gl"} or "google.com/maps" in u:
        return "google_maps"
    return "own"


def site_key(url: str) -> str:
    h = host_of(url)
    if not h:
        return url.lower().rstrip("/")
    path = urlparse(url if "://" in url else "https://" + url).path.lower().rstrip("/")
    if platform_kind(url) in {"listing_platform", "facebook", "google_maps", "google_sites"}:
        return (h + path)[:180]
    return h


def extract_title(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    if not m:
        return ""
    t = unescape(re.sub(r"\s+", " ", m.group(1))).strip()
    return t[:180]


def extract_meta(html: str, name: str) -> str:
    pat = rf'<meta[^>]+(?:name|property)=["\']{name}["\'][^>]+content=["\']([^"\']+)["\']'
    m = re.search(pat, html, re.I)
    if m:
        return unescape(m.group(1))[:240]
    pat2 = rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name|property)=["\']{name}["\']'
    m = re.search(pat2, html, re.I)
    return unescape(m.group(1))[:240] if m else ""


def sniff(html: str) -> dict:
    low = html.lower()
    gen = ""
    gm = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if gm:
        gen = gm.group(1)[:80]
    year = None
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:20)?(20\d{2})", low)]
    if years:
        year = max(years)
    else:
        ys = [int(y) for y in re.findall(r"\b(20[0-2]\d)\b", low)]
        if ys:
            # ignore if too many years (likely inventory dates)
            if len(set(ys)) <= 6:
                year = max(ys)
    title = extract_title(html)
    title_l = title.lower().strip()
    parked = any(
        x in low
        for x in [
            "this domain is for sale",
            "buy this domain",
            "domain is parked",
            "parked domain name",
            "hugedomains.com",
            "sedo.com/search",
            "account suspended",
            "default web site page",
            "apache2 debian default page",
            "welcome to nginx",
        ]
    ) or title_l in {
        "coming soon",
        "parked",
        "parked domain",
        "welcome to nginx!",
        "welcome to nginx",
        "account suspended",
        "default website",
        "website coming soon",
    }
    booking = any(
        x in low
        for x in [
            "book now",
            "check availability",
            "reserve now",
            "online booking",
            "request a quote",
            "get a quote",
            "free quote",
            "add to cart",
            "shop now",
            "rent now",
            "check rates",
        ]
    )
    contact_only = ("contact us" in low or "mailto:" in low) and not booking
    viewport = "name=\"viewport\"" in low or "name='viewport'" in low
    jquery_old = bool(re.search(r"jquery(?:\.min)?\.js.*?1\.[0-8]", low) or "jquery/1." in low)
    tables = low.count("<table") >= 6
    tech = []
    for label, keys in [
        ("WordPress", ["wp-content", "wordpress"]),
        ("Wix", ["wix.com", "wixstatic"]),
        ("Squarespace", ["squarespace", "static1.squarespace"]),
        ("Shopify", ["cdn.shopify", "myshopify"]),
        ("Weebly", ["weebly"]),
        ("GoDaddy", ["godaddysites", "secureserver"]),
        ("Webflow", ["webflow"]),
        ("Next.js", ["_next/static", "__next"]),
        ("React", ["react", "root"]),
    ]:
        if any(k in low for k in keys):
            tech.append(label)
    return {
        "title": extract_title(html),
        "desc": extract_meta(html, "description") or extract_meta(html, "og:description"),
        "generator": gen,
        "year": year,
        "parked": parked,
        "booking": booking,
        "contact_only": contact_only,
        "viewport": viewport,
        "jquery_old": jquery_old,
        "tables": tables,
        "tech": tech,
        "bytes": len(html),
    }


def fetch_site(url: str) -> dict:
    out = {
        "url": url,
        "ok": False,
        "status": 0,
        "final": "",
        "error": "",
        "https": url.startswith("https"),
        "title": "",
        "desc": "",
        "generator": "",
        "year": None,
        "parked": False,
        "booking": False,
        "contact_only": False,
        "viewport": True,
        "jquery_old": False,
        "tables": False,
        "tech": [],
        "bytes": 0,
    }
    if not url:
        out["error"] = "no_url"
        return out

    def try_open(u: str) -> tuple[int, str, str]:
        req = Request(u, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
        with urlopen(req, timeout=8, context=CTX) as resp:
            raw = resp.read(180_000)
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if "text" not in ctype and "html" not in ctype and ctype and "javascript" not in ctype:
                return resp.status, str(resp.geturl()), ""
            try:
                text = raw.decode("utf-8", errors="ignore")
            except Exception:
                text = raw.decode("latin-1", errors="ignore")
            return resp.status, str(resp.geturl()), text

    attempts = [url]
    if url.startswith("https://"):
        attempts.append("http://" + url[len("https://") :])
    last_err = ""
    for u in attempts:
        try:
            status, final, html = try_open(u)
            out["status"] = status
            out["final"] = final
            out["https"] = final.startswith("https")
            if html:
                out.update({**out, **sniff(html)})
                out["ok"] = True
            else:
                out["ok"] = status < 400
            return out
        except HTTPError as e:
            out["status"] = e.code
            last_err = f"http_{e.code}"
            if e.code in (401, 403, 429) or 500 <= e.code < 600:
                out["error"] = last_err
                return out
        except URLError as e:
            last_err = f"url_{getattr(e, 'reason', e)}"
        except Exception as e:
            last_err = f"{type(e).__name__}:{e}"
    out["error"] = last_err[:160]
    return out


TRUE_DEAD_TITLES = {
    "coming soon",
    "parked",
    "parked domain",
    "welcome to nginx!",
    "welcome to nginx",
    "account suspended",
    "default website",
    "website coming soon",
}


def repair_probe(v: dict) -> dict:
    """Fix stale parked flags from an older, too-loose detector."""
    title = (v.get("title") or "").lower().strip()
    if v.get("parked"):
        if title and title not in TRUE_DEAD_TITLES and "parked domain" not in title and "nginx" not in title and "account suspended" not in title:
            v["parked"] = False
    return v


def load_cache() -> dict:
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            cache = json.load(f)
        for k, v in list(cache.items()):
            if isinstance(v, dict):
                cache[k] = repair_probe(v)
        return cache
    return {}


def save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f)


def pick_variation(key: str, options: list[str]) -> str:
    h = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16)
    return options[h % len(options)]


CAT_PHRASE = {
    "Party & Event Rentals": "party rental company",
    "Vacation Rentals": "vacation rental business",
    "Furniture Rental": "furniture rental company",
    "Equipment Sales & Rental": "equipment rental company",
    "Wholesale / Distribution": "wholesale business",
    "Wholesale Nursery & Plants": "nursery",
    "Construction & Contracting": "contractor",
    "Home Services": "home-service company",
    "Real Estate": "real estate business",
    "Apartments & Property": "apartment community",
    "Property Management": "property manager",
    "Auto Accessories / Parts": "auto shop",
    "Furniture & Home": "home furnishings business",
    "Local Service Business": "local business",
}


def tidy_ice(text: str) -> str:
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace(" .", ".")
    return text


def icebreaker(row: dict, probe: dict, issues: list[str]) -> str:
    first = row["first"]
    biz = row["biz"]
    cat = row["category"]
    cat_p = CAT_PHRASE.get(cat, cat.lower())
    site = pretty_site(row.get("website") or row.get("website_display") or "") or "your site"
    rating = row["rating"]
    reviews = row["reviews"]
    title = (probe or {}).get("title") or ""
    year = (probe or {}).get("year")
    key = f"{biz}|{row['email']}"
    hi = f"Hi {first}," if first else "Hi there,"
    art = "an" if cat_p[:1] in "aeiou" else "a"

    rev_bit = ""
    if reviews and reviews >= 20:
        if rating and rating >= 4.5:
            rev_bit = f" You're sitting on {reviews} reviews at {rating:g} stars"
        else:
            rev_bit = f" You already have {reviews} Google reviews"
    elif reviews and reviews <= 8:
        rev_bit = " You're still early on reviews"

    # Issue-specific openers
    if "dead_site" in issues or "parked" in issues:
        body = pick_variation(
            key,
            [
                f"I tried to open {site or 'your site'} for {biz} and it doesn't actually load — that usually means people find you on Google, tap through, and bounce before they ever call.",
                f"{biz}'s website is down or parked right now. For a {cat_p}, that's free jobs walking to whoever's site opens.",
                f"Google is sending people to {site or 'your domain'}, but the page isn't serving. That's the most expensive kind of broken — you're paying for the click and losing the lead.",
            ],
        )
        ask = pick_variation(
            key + "a",
            [
                "I can have a clean, mobile site live that takes quote requests in a few days. Want me to send a 20-second preview using your name?",
                "If you want, I'll mock a simple homepage that lets people book or request a quote without calling. Interested?",
            ],
        )
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if "no_website" in issues:
        body = pick_variation(
            key,
            [
                f"I looked up {biz} and you show up on Google, but there's no real website behind the listing.",
                f"{biz} is easy to find as a listing, but there's nothing that lets a customer actually book or see what you offer after hours.",
                f"People searching for {art} {cat_p} in your area hit your Google profile and then have to call or guess — most of them won't.",
            ],
        )
        ask = pick_variation(
            key + "a",
            [
                "A one-page site with photos, pricing ranges, and a quote button would catch the jobs you lose at 9pm. Want a quick mockup?",
                "I build simple sites that turn those Google clicks into booked jobs. Can I send you a 3-section layout using your business name?",
            ],
        )
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if "facebook_only" in issues or "linktree_only" in issues:
        where = "Facebook" if "facebook_only" in issues else "a Linktree"
        body = f"{biz} is sending customers to {where} instead of a real site. That's fine for photos — terrible for booking, SEO, or looking like the established option vs the shop down the street."
        ask = "I can turn what you already post into a fast booking site this week. Want me to sketch it from your existing page?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if "diy_builder" in issues:
        tech_l = str((probe or {}).get("tech") or []).lower()
        builder = "Wix" if ("wix" in site.lower() or "wix" in tech_l) else "template"
        if "weebly" in site.lower() or "weebly" in tech_l:
            builder = "Weebly"
        elif "google" in site.lower():
            builder = "Google Sites"
        body = pick_variation(
            key,
            [
                f"I went through {site} — it looks like a DIY {builder} build. Fine to launch, but it doesn't sell like a serious {cat_p} should in 2026.",
                f"{site} is live, but it feels like a template that was never finished for how {biz} actually takes jobs.",
            ],
        )
        ask = "A tighter homepage + instant quote form would make you look like the premium option. Want a before/after of your current page?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if "listing_platform" in issues:
        body = pick_variation(
            key,
            [
                f"{biz} is living entirely on a listing platform. That's renting someone else's brand — when they change the algorithm, your calendar takes the hit.",
                f"I found {biz} on a third-party listing, not on a site you own. Owners who add their own booking page usually keep more of the fee and look more legit in Google.",
            ],
        )
        ask = "I build simple branded sites with direct booking so you're not 100% dependent on that platform. Worth a look?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if "bad_ui_note" in issues:
        body = f"I spent a few minutes on {site or biz} — the layout feels dated and hard to use. That's costing you the people who already wanted to hire you."
        ask = "I can rebuild the first screen so it loads fast, shows your work, and captures a quote. Want me to send a specific fix list?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if "slow_note" in issues:
        body = f"I opened {site} and it takes too long to become usable. On mobile that's an instant bounce — especially with your reviews sitting there unused."
        ask = "A lightweight rebuild would keep your branding and actually load. Can I send a 15-second recast of the homepage?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    # Category-specific with website present
    if cat == "Party & Event Rentals":
        if "no_booking" in issues:
            body = pick_variation(
                key,
                [
                    f"I looked at {site} for {biz}. Someone planning a party at 10pm still has to wait until you pick up the phone — that's when they book the next rental company.",
                    f"{biz}'s site doesn't make it obvious how to lock a date. Party rentals are won by whoever lets people request a date in 30 seconds.",
                ],
            )
        else:
            body = f"I went through {site}. For a party rental company, the first screen should do three things: show inventory, show available dates, and take the deposit. It's not doing that cleanly."
        ask = pick_variation(
            key + "a",
            [
                "I build rental sites with photo inventory + a date request form. Want a sample laid out with your catalog?",
                "If you want, I'll send a homepage mock that turns weekend Google traffic into booked weekends.",
            ],
        )
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat == "Vacation Rentals":
        body = pick_variation(
            key,
            [
                f"I checked {site or biz}. Guests decide in seconds, and if the photos/dates/direct-book path isn't obvious, they bounce back to Airbnb and you eat the fee.",
                f"{biz} needs a site that sells the stay, not just lists an address. Direct bookings are the whole margin on a vacation rental.",
            ],
        )
        ask = "I put up direct-booking pages that sit next to your Airbnb/VRBO listing so repeat guests skip the fees. Want a quick example using your property name?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat in {"Furniture Rental", "Equipment Sales & Rental"}:
        body = pick_variation(
            key,
            [
                f"I reviewed {site} — for {cat.lower()}, buyers want to see stock, rates, and a request form without calling around.",
                f"{biz}'s site doesn't make renting feel instant. Competitors who added online requests usually steal the after-hours jobs.",
            ],
        )
        ask = "I can ship a clean catalog + request flow this week. Should I send a 3-block layout with your name on it?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat in {"Wholesale / Distribution", "Wholesale Nursery & Plants"}:
        body = pick_variation(
            key,
            [
                f"I looked at {site} for {biz}. Wholesale buyers don't browse — they need a line card, minimums, and a 'request pricing' path that works on a phone in a warehouse parking lot.",
                f"{biz} looks like a real operation, but the site doesn't help a new account take the first step without a phone tag.",
            ],
        )
        ask = "A simple wholesale site with a product snapshot + account/quote form usually pays for itself in one new account. Want me to sketch yours?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat == "Construction & Contracting":
        body = pick_variation(
            key,
            [
                f"I went through {site}. Homeowners shopping contractors decide on the first screen — photos of finished jobs + a 60-second quote. {biz} is making them work for it.",
                f"{biz} is the kind of company people hire from Google at night. If they can't request a quote without calling, they tap the next listing.",
            ],
        )
        ask = "I build contractor sites with a job-type quote form and a past-jobs gallery. Want a mock of your homepage?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat == "Home Services":
        body = f"I checked {site} for {biz}. Service businesses win when someone can book or request a visit in under a minute. The current site still makes people hunt."
        ask = "I can put a mobile quote/booking block on a fast page this week. Interested in a quick preview?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat == "Real Estate":
        body = pick_variation(
            key,
            [
                f"I opened {site}. In 2026 a realtor site has to load instantly, look current, and make listings easy to browse — otherwise buyers bounce to Zillow and never email you.",
                f"{biz}'s site isn't doing the listing justice. The first impression is the brand, and right now it feels behind the market.",
            ],
        )
        ask = "I rebuild agent sites so they feel like a luxury listing, not a template. Want a specific teardown of your homepage?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat in {"Apartments & Property", "Property Management"}:
        body = f"I looked at {site} for {biz}. Renters tour with their thumb — if units, pricing, and a tour request aren't obvious, they apply at the next complex."
        ask = "A cleaner leasing page with unit photos + tour form is a straightforward lift. Want me to send a recast of your current first screen?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    if cat == "Auto Accessories / Parts":
        body = f"I reviewed {site}. Shoppers in this niche compare two tabs and buy from the one that looks current and shows products clearly."
        ask = f"I can modernize {biz}'s site so it actually sells instead of just existing. Want a short before/after?"
        return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")

    # generic
    title_bit = f' (title is "{title[:60]}")' if title and title.lower() not in biz.lower() else ""
    year_bit = f" It still feels like a {year} site." if year and year <= 2022 else ""
    body = f"I spent a few minutes on {site}{title_bit}.{year_bit} For a {cat_p}, the site should be doing the selling after hours — right now it's mostly a brochure."
    ask = "I write and build sites that take quote requests on mobile. Can I send a tight homepage concept using your name?"
    return tidy_ice(f"{hi} {body}{rev_bit}. {ask}")


def score_lead(row: dict, probe: dict) -> tuple[int, list[str]]:
    issues: list[str] = []
    score = 20
    kind = row["platform"]
    notes = (row.get("raw_note") or "").lower()
    cat = row["category"]
    reviews = row["reviews"] or 0
    rating = row["rating"] or 0

    if kind == "none":
        issues.append("no_website")
        score += 100
    elif kind == "facebook":
        issues.append("facebook_only")
        score += 92
    elif kind == "linktree":
        issues.append("linktree_only")
        score += 90
    elif kind in {"wix", "weebly", "google_sites", "blogger"}:
        issues.append("diy_builder")
        score += 78
    elif kind == "listing_platform":
        issues.append("listing_platform")
        score += 88
    elif kind == "google_maps":
        issues.append("no_website")
        score += 95

    if "very bad" in notes or "bad ui" in notes or "shitty" in notes or "bad website" in notes or "bad selling" in notes:
        issues.append("bad_ui_note")
        score += 80
    if "taking too much time" in notes or "too much time to load" in notes:
        issues.append("slow_note")
        score += 70
    if "free quote" in notes or "can have more good website" in notes or "online portal" in notes:
        issues.append("needs_quote")
        score += 45
    if "very nice website" in notes:
        score -= 80
        issues.append("already_strong")

    if probe:
        if probe.get("parked"):
            issues.append("parked")
            score += 90
        if not probe.get("ok") and probe.get("error") and kind == "own":
            err = probe.get("error") or ""
            st = probe.get("status") or 0
            truly_dead = (
                err.startswith("http_404")
                or err.startswith("http_410")
                or "nodename" in err
                or "Connection refused" in err
            )
            if truly_dead or st in (404, 410):
                issues.append("dead_site")
                score += 85
        if probe.get("ok"):
            if not probe.get("viewport"):
                issues.append("not_mobile")
                score += 28
            if probe.get("jquery_old") or probe.get("tables"):
                issues.append("dated_build")
                score += 32
            yr = probe.get("year")
            if yr and yr <= 2021:
                issues.append("old_copyright")
                score += 22
            if not probe.get("https"):
                issues.append("no_https")
                score += 18
            if not probe.get("booking") and cat in {
                "Party & Event Rentals",
                "Vacation Rentals",
                "Furniture Rental",
                "Equipment Sales & Rental",
                "Construction & Contracting",
                "Home Services",
            }:
                issues.append("no_booking")
                score += 34
            tech = set(probe.get("tech") or [])
            if tech & {"Next.js", "Webflow", "Shopify"} and "already_strong" not in issues:
                score -= 25
            if "Wix" in tech or "Weebly" in tech or "GoDaddy" in tech:
                if "diy_builder" not in issues:
                    issues.append("diy_builder")
                    score += 40
            if (probe.get("bytes") or 0) < 1500 and kind == "own":
                issues.append("thin_site")
                score += 25

    # Category fit for this offer
    if cat in {"Party & Event Rentals", "Vacation Rentals", "Construction & Contracting", "Home Services"}:
        score += 22
    elif cat in {"Furniture Rental", "Equipment Sales & Rental", "Wholesale / Distribution", "Wholesale Nursery & Plants"}:
        score += 16
    elif cat == "Real Estate":
        score += 14
    elif cat in {"Apartments & Property", "Property Management"}:
        score += 8

    if reviews >= 40 and any(
        x in issues
        for x in ["no_website", "facebook_only", "diy_builder", "dead_site", "bad_ui_note", "no_booking", "dated_build"]
    ):
        issues.append("reviews_unused")
        score += 20
    if 0 < reviews <= 12:
        score += 8
    if 0 < rating <= 3.6:
        score += 6

    # Must look like they actually need digital help
    if not issues:
        issues.append("generic_upgrade")
        score += 5

    return score, issues


def parse_rating(s: str):
    s = clean(s)
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_reviews(s: str):
    s = clean(s)
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def main() -> None:
    with open(DRAFT, encoding="utf-8-sig", newline="") as f:
        raw_rows = list(csv.DictReader(f))

    cleaned = []
    skipped = Counter()
    seen_email = set()

    for i, r in enumerate(raw_rows):
        biz = norm(r.get("BUSINESS NAME") or "")
        email = first_email(r.get("EMAIL") or "")
        website_raw = decode_scraped_url(r.get("WEBSITE") or "")
        website = absolute_url(website_raw) if website_raw and not is_na(website_raw) else ""
        full = r.get("FULL NAME") or ""
        first, last = split_name(full)
        if not first:
            ef, el = name_from_email(email)
            first, last = ef, el or last
        website = prefer_website(biz, email, website)
        btype = norm(r.get("BUSINESS TYPE") or "")
        note = norm(r.get("Services to sell") or "")
        extra_note = norm(r.get("NOTES") or "")
        notes = " ".join(x for x in [note, extra_note] if x)

        if not email:
            skipped["no_email"] += 1
            continue
        if email in seen_email:
            skipped["dup_email"] += 1
            continue
        if is_dead_note(notes):
            skipped["dead_note"] += 1
            continue
        if is_saas(biz):
            skipped["saas"] += 1
            continue
        if is_chain(biz, email, website):
            skipped["chain"] += 1
            continue
        if is_na(biz) and not website:
            skipped["empty"] += 1
            continue
        if biz.lower() in {"n/a"} and not website:
            skipped["empty"] += 1
            continue

        seen_email.add(email)
        cat = categorize(biz, btype, website, notes)
        plat = platform_kind(website)
        cleaned.append(
            {
                "idx": i,
                "biz": biz if not is_na(biz) else (first + " " + last).strip() or "Local business",
                "first": first,
                "last": last,
                "email": email,
                "website": website,
                "website_display": website_raw or website or "",
                "category": cat,
                "btype": btype,
                "raw_note": notes,
                "rating": parse_rating(r.get("RATING") or ""),
                "reviews": parse_reviews(r.get("REVIEWS") or ""),
                "platform": plat,
                "sitekey": site_key(website) if website else f"none:{email}",
            }
        )

    print(f"cleaned={len(cleaned)} skipped={dict(skipped)}")

    # Probe unique own-site keys
    cache = load_cache()
    to_probe = []
    for row in cleaned:
        if row["platform"] != "own":
            continue
        key = row["sitekey"]
        if key and key not in cache:
            to_probe.append((key, row["website"]))
    # unique
    seen = set()
    uniq = []
    for k, u in to_probe:
        if k not in seen:
            seen.add(k)
            uniq.append((k, u))
    print(f"sites to probe={len(uniq)} cached={len(cache)}")

    if uniq:
        done = 0
        with ThreadPoolExecutor(max_workers=28) as ex:
            futs = {ex.submit(fetch_site, u): k for k, u in uniq}
            for fut in as_completed(futs):
                k = futs[fut]
                try:
                    cache[k] = fut.result()
                except Exception as e:
                    cache[k] = {"ok": False, "error": str(e), "url": k}
                done += 1
                if done % 50 == 0 or done == len(uniq):
                    print(f"  probed {done}/{len(uniq)}")
                    save_cache(cache)
        save_cache(cache)

    scored = []
    for row in cleaned:
        probe = cache.get(row["sitekey"], {}) if row["platform"] == "own" else {}
        score, issues = score_lead(row, probe)
        row["score"] = score
        row["issues"] = issues
        row["probe"] = probe
        row["ice"] = icebreaker(row, probe, issues)
        scored.append(row)

    # Keep people who actually need a site. Floor ~700, target ~1000.
    scored.sort(key=lambda x: (-x["score"], -(x["reviews"] or 0)))
    # Drop only "already_strong" unless we would fall under 700
    needy = [x for x in scored if "already_strong" not in x["issues"]]
    # Also drop very low-need modern sites
    strong_enough = [x for x in needy if x["score"] >= 40]
    if len(strong_enough) < 700:
        strong_enough = needy
    # Target 1000 strongest; keep everyone if 700-1000.
    if len(strong_enough) > 1000:
        strong_enough = strong_enough[:1000]

    selected = strong_enough
    print(f"selected={len(selected)} min_score={selected[-1]['score'] if selected else None} max={selected[0]['score'] if selected else None}")

    fieldnames = [
        "Business Name",
        "First Name",
        "Last Name",
        "Email",
        "Business Category",
        "Icebreaker",
        "Website",
    ]
    with open(FINAL, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for row in selected:
            site = pretty_site(row["website"] or row["website_display"])
            if site.lower() in NA:
                site = ""
            w.writerow(
                {
                    "Business Name": row["biz"],
                    "First Name": row["first"],
                    "Last Name": row["last"],
                    "Email": row["email"],
                    "Business Category": row["category"],
                    "Icebreaker": row["ice"].replace("\n", " ").strip(),
                    "Website": site,
                }
            )

    cats = Counter(x["category"] for x in selected)
    print("\n=== CATEGORY COUNTS ===")
    for c, n in cats.most_common():
        print(f"{n:4d}  {c}")
    print("\n=== ISSUE COUNTS ===")
    ic = Counter()
    for x in selected:
        ic.update(x["issues"])
    for c, n in ic.most_common():
        print(f"{n:4d}  {c}")
    print("\n=== SKIPPED ===")
    for c, n in skipped.most_common():
        print(f"{n:4d}  {c}")
    print(f"\nWrote {FINAL} rows={len(selected)}")


if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"elapsed {time.time()-t0:.1f}s")
