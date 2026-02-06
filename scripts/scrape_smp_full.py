#!/usr/bin/env python3
"""
Smart Money People Full Review Scraper
Scrapes up to 250 reviews per building society from smartmoneypeople.com
Uses plain HTTP with server-side pagination on product pages (no Playwright needed).
"""

import json
import os
import re
import sys
import time
import html as html_module
from datetime import datetime, timezone
from typing import Optional, List, Dict
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path

# === Configuration ===
MAX_REVIEWS_PER_SOCIETY = 250
MAX_PAGES_PER_PRODUCT = 30  # safety limit
DELAY_BETWEEN_REQUESTS = 2.5  # seconds
BASE_URL = "https://smartmoneypeople.com"
DATA_DIR = Path(__file__).parent.parent / "data" / "reviews"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
}

# === All BSA Member Building Societies ===
# name -> list of slug candidates to try (first match wins)
SOCIETIES = [
    {"name": "Bath Building Society", "slugs": ["bath-building-society"]},
    {"name": "Beverley Building Society", "slugs": ["beverley-building-society"]},
    {"name": "Buckinghamshire Building Society", "slugs": ["buckinghamshire-building-society"]},
    {"name": "Cambridge Building Society", "slugs": ["cambridge-building-society"]},
    {"name": "Chelsea Building Society", "slugs": ["chelsea-building-society"]},
    {"name": "Chorley Building Society", "slugs": ["Chorley-building-society", "chorley-building-society", "chorley-and-district-building-society"]},
    {"name": "Coventry Building Society", "slugs": ["coventry-building-society"]},
    {"name": "Cumberland Building Society", "slugs": ["the-cumberland", "cumberland-building-society"]},
    {"name": "Darlington Building Society", "slugs": ["darlington-building-society"]},
    {"name": "Dudley Building Society", "slugs": ["dudley-building-society"]},
    {"name": "Earl Shilton Building Society", "slugs": ["earl-shilton-building-society"]},
    {"name": "Ecology Building Society", "slugs": ["ecology-building-society"]},
    {"name": "Family Building Society", "slugs": ["family-building-society", "the-family-building-society"]},
    {"name": "Furness Building Society", "slugs": ["furness-building-society"]},
    {"name": "Hanley Economic Building Society", "slugs": ["hanley-economic-building-society"]},
    {"name": "Harpenden Building Society", "slugs": ["harpenden-building-society"]},
    {"name": "Hinckley & Rugby Building Society", "slugs": ["hinckley-and-rugby-building-society", "hinckley-rugby-building-society"]},
    {"name": "Leeds Building Society", "slugs": ["leeds-building-society"]},
    {"name": "Leek Building Society", "slugs": ["leek-building-society"]},
    {"name": "Leek United Building Society", "slugs": ["leek-united-building-society"]},
    {"name": "Loughborough Building Society", "slugs": ["loughborough-building-society"]},
    {"name": "Manchester Building Society", "slugs": ["manchester-building-society"]},
    {"name": "Mansfield Building Society", "slugs": ["mansfield-building-society"]},
    {"name": "Market Harborough Building Society", "slugs": ["market-harborough-building-society"]},
    {"name": "Marsden Building Society", "slugs": ["marsden-building-society"]},
    {"name": "Melton Building Society", "slugs": ["melton-building-society", "melton-mowbray-building-society"]},
    {"name": "Monmouthshire Building Society", "slugs": ["monmouthshire-building-society"]},
    {"name": "National Counties Building Society", "slugs": ["national-counties-building-society"]},
    {"name": "Nationwide Building Society", "slugs": ["nationwide"]},
    {"name": "Newbury Building Society", "slugs": ["newbury-building-society"]},
    {"name": "Newcastle Building Society", "slugs": ["newcastle-building-society"]},
    {"name": "Norwich & Peterborough Building Society", "slugs": ["norwich-and-peterborough-building-society", "norwich-peterborough-building-society"]},
    {"name": "Nottingham Building Society", "slugs": ["nottingham-building-society"]},
    {"name": "Penrith Building Society", "slugs": ["penrith-building-society"]},
    {"name": "Principality Building Society", "slugs": ["principality-building-society"]},
    {"name": "Progressive Building Society", "slugs": ["progressive-building-society"]},
    {"name": "Saffron Building Society", "slugs": ["saffron-building-society"]},
    {"name": "Scottish Building Society", "slugs": ["scottish-building-society"]},
    {"name": "Skipton Building Society", "slugs": ["skipton-building-society"]},
    {"name": "Stafford Railway Building Society", "slugs": ["stafford-building-society", "stafford-railway-building-society"]},
    {"name": "Suffolk Building Society", "slugs": ["suffolk-building-society", "ipswich-building-society"]},
    {"name": "Swansea Building Society", "slugs": ["swansea-building-society"]},
    {"name": "Teachers Building Society", "slugs": ["teachers-building-society"]},
    {"name": "Tipton & Coseley Building Society", "slugs": ["tipton-and-coseley-building-society", "tipton-coseley-building-society"]},
    {"name": "Vernon Building Society", "slugs": ["vernon-building-society"]},
    {"name": "West Bromwich Building Society", "slugs": ["west-bromwich-building-society", "west-brom-building-society"]},
    {"name": "Yorkshire Building Society", "slugs": ["yorkshire-building-society"]},
]


def fetch(url: str) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on error."""
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        if e.code == 404:
            return None
        print(f"    HTTP {e.code} for {url}")
        return None
    except (URLError, TimeoutError) as e:
        print(f"    Error fetching {url}: {e}")
        return None


def clean_text(raw: str) -> str:
    """Clean HTML entities and whitespace from text."""
    text = html_module.unescape(raw)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def discover_slug(society: dict) -> Optional[str]:
    """Try candidate slugs and return the first one that has a valid SMP page."""
    for slug in society["slugs"]:
        url = f"{BASE_URL}/{slug}-reviews/products"
        time.sleep(1)
        html = fetch(url)
        if html and "product reviews" in html.lower():
            return slug
    return None


def discover_products(slug: str, html: str) -> List[str]:
    """Extract product slugs from the products page."""
    pattern = rf"/{re.escape(slug)}-reviews/product/([a-zA-Z0-9\-]+)"
    matches = set(re.findall(pattern, html, re.IGNORECASE))
    # Exclude generic product slugs from site navigation
    exclude = {"review", ""}
    return sorted(m.lower() for m in matches if m.lower() not in exclude)


def get_total_reviews(html: str) -> int:
    """Extract total review count from the products page."""
    # Pattern: "82 product reviews" or "Showing 11 of 82"
    m = re.search(r"based on (\d+) product review", html)
    if m:
        return int(m.group(1))
    m = re.search(r"of\s*<strong[^>]*>(\d+)</strong>\s*company reviews", html)
    if m:
        return int(m.group(1))
    m = re.search(r"Showing\s+\d+\s+of\s+(\d+)", html)
    if m:
        return int(m.group(1))
    return 0


def get_avg_rating(html: str) -> float:
    """Extract average rating from the products page."""
    m = re.search(r"(\d+\.\d+)/5", html)
    if m:
        return float(m.group(1))
    return 0.0


def parse_reviews_from_html(html: str, product: str) -> List[dict]:
    """Parse review cards from a product page HTML."""
    reviews = []

    # Split by review blocks
    blocks = re.split(r'id="review-\d+"', html)

    for block in blocks[1:]:  # skip first (before any review)
        # Extract rating
        rating_m = re.search(r'data-rating="(\d)"', block)
        if not rating_m:
            continue
        rating = int(rating_m.group(1))
        if rating < 1 or rating > 5:
            continue

        # Extract title from h3
        title_m = re.search(r"<h3[^>]*>(.*?)</h3>", block, re.DOTALL)
        if not title_m:
            continue
        title = clean_text(title_m.group(1))
        if not title or len(title) < 3:
            continue

        # Extract review text from the paragraph span
        # The full text is in: <span class="block paragraph mb-2 text-black hyphenate hideable">
        text = ""
        text_m = re.search(
            r'<span class="block paragraph[^"]*hyphenate[^"]*">\s*(.*?)\s*</span>',
            block,
            re.DOTALL,
        )
        if text_m:
            text = clean_text(text_m.group(1))
        
        if not text:
            # Try alternative pattern
            text_m = re.search(
                r'<span class="block paragraph[^"]*">\s*(.*?)\s*</span>',
                block,
                re.DOTALL,
            )
            if text_m:
                text = clean_text(text_m.group(1))

        # Also try to get longer text from alternate containers
        alt_m = re.search(
            r'<span class="block mb-3 paragraph[^"]*">(.*?)</span>',
            block,
            re.DOTALL,
        )
        if alt_m:
            alt_text = clean_text(alt_m.group(1))
            if len(alt_text) > len(text):
                text = alt_text

        # Extract date
        date_m = re.search(
            r"Reviewed on:</strong>\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})",
            block,
        )
        date_str = date_m.group(1).strip() if date_m else ""

        if not text or len(text) < 10:
            # Use title as text if text is too short
            if len(title) > 20:
                text = title
            else:
                continue

        # Determine sentiment
        if rating >= 4:
            sentiment = "positive"
        elif rating == 3:
            sentiment = "mixed"
        else:
            sentiment = "negative"

        # Normalize product name
        product_display = normalize_product(product)

        reviews.append({
            "title": title[:200],
            "text": text,
            "rating": rating,
            "date": date_str,
            "product": product_display,
            "sentiment": sentiment,
        })

    return reviews


def normalize_product(product_slug: str) -> str:
    """Convert product slug to display name."""
    savings_slugs = {
        "savings", "isa", "cash-isa", "fixed-rate-isa", "instant-access-savings",
        "fixed-rate-bond", "regular-saver", "easy-access-savings", "savings-account",
        "instant-access-account", "e-saver-account", "limited-access-saver",
        "regular-savings", "bond", "junior-isa", "notice-account", "junior-savings",
        "loyalty-saver", "promise-saver",
    }
    mortgage_slugs = {
        "mortgages", "mortgage", "fixed-rate-mortgage", "tracker-rate-mortgage",
        "tracker", "buy-to-let-mortgage", "residential-mortgage",
    }
    insurance_slugs = {
        "insurance", "home-insurance", "life-insurance", "income-protection",
        "buildings-insurance", "contents-insurance",
    }
    current_slugs = {
        "current-account", "plus-current-account", "day2day-current-account",
    }

    slug_lower = product_slug.lower()
    if slug_lower in savings_slugs:
        return "Savings"
    if slug_lower in mortgage_slugs:
        return "Mortgages"
    if slug_lower in insurance_slugs:
        return "Insurance"
    if slug_lower in current_slugs:
        return "Current Account"
    # Fallback: capitalize
    return product_slug.replace("-", " ").title()


def scrape_product(slug: str, product: str, max_reviews: int) -> List[dict]:
    """Scrape all pages of a product, up to max_reviews."""
    all_reviews = []
    seen_titles = set()

    for page in range(1, MAX_PAGES_PER_PRODUCT + 1):
        # Try both lowercase slug and original URL (some use capital letters)
        url = f"{BASE_URL}/{slug}-reviews/product/{product}?page={page}"
        time.sleep(DELAY_BETWEEN_REQUESTS + (0.5 * (page > 1)))

        html = fetch(url)
        if not html:
            break

        reviews = parse_reviews_from_html(html, product)
        if not reviews:
            break

        new_count = 0
        for r in reviews:
            key = r["title"][:80]
            if key not in seen_titles:
                seen_titles.add(key)
                all_reviews.append(r)
                new_count += 1

        if new_count == 0:
            # No new reviews on this page, likely hit the end
            break

        if len(all_reviews) >= max_reviews:
            break

        # Check if there's a next page
        if f"page={page + 1}" not in html:
            break

    return all_reviews[:max_reviews]


def scrape_society(society: dict) -> Optional[dict]:
    """Scrape all reviews for a single building society."""
    name = society["name"]
    print(f"\n{'=' * 60}")
    print(f"  {name}")
    print(f"{'=' * 60}")

    # Check if we already have data for this society
    for slug_candidate in society["slugs"]:
        existing_file = DATA_DIR / f"{slug_candidate}.json"
        if existing_file.exists():
            try:
                existing = json.loads(existing_file.read_text())
                review_count = len(existing.get("reviews", []))
                if review_count > 0:
                    print(f"  Already scraped ({review_count} reviews), skipping. Delete {existing_file.name} to re-scrape.")
                    return existing
            except Exception:
                pass

    # Discover the correct slug
    print(f"  Discovering SMP slug...")
    slug = discover_slug(society)
    if not slug:
        print(f"  ❌ No SMP page found for {name}")
        return None

    print(f"  ✓ Found slug: {slug}")

    # Get products page for metadata
    products_url = f"{BASE_URL}/{slug}-reviews/products"
    products_html = fetch(products_url)
    if not products_html:
        print(f"  ❌ Could not fetch products page")
        return None

    total_on_smp = get_total_reviews(products_html)
    avg_rating = get_avg_rating(products_html)
    products = discover_products(slug, products_html)

    print(f"  Total reviews on SMP: {total_on_smp}")
    print(f"  Average rating: {avg_rating}")
    print(f"  Products: {products}")

    if not products:
        print(f"  ❌ No products found")
        return None

    # Scrape each product
    all_reviews = []
    seen_titles = set()
    remaining = MAX_REVIEWS_PER_SOCIETY

    for product in products:
        if remaining <= 0:
            break

        print(f"\n  --- {product} ---")
        reviews = scrape_product(slug, product, remaining)

        new_count = 0
        for r in reviews:
            key = r["title"][:80]
            if key not in seen_titles:
                seen_titles.add(key)
                all_reviews.append(r)
                new_count += 1

        remaining = MAX_REVIEWS_PER_SOCIETY - len(all_reviews)
        print(f"  Got {new_count} new reviews from {product} (total: {len(all_reviews)})")

    # Calculate actual average from scraped reviews
    if all_reviews:
        actual_avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
        actual_avg = round(actual_avg, 2)
    else:
        actual_avg = avg_rating

    result = {
        "society": name,
        "slug": slug,
        "smpUrl": f"{BASE_URL}/{slug}-reviews/products",
        "totalReviewsOnSMP": total_on_smp,
        "avgRating": actual_avg,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "reviews": all_reviews,
    }

    # Save immediately
    save_society(result)
    print(f"\n  ✅ Scraped {len(all_reviews)} reviews for {name} (avg: {actual_avg})")
    return result


def save_society(data: dict):
    """Save a society's review data to JSON."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    filepath = DATA_DIR / f"{data['slug']}.json"
    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def save_summary(results: list[dict]):
    """Save the summary file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    societies = []
    for r in results:
        if r:
            societies.append({
                "name": r["society"],
                "slug": r["slug"],
                "totalOnSMP": r["totalReviewsOnSMP"],
                "scraped": len(r["reviews"]),
                "avgRating": r["avgRating"],
            })

    # Sort by number of reviews scraped
    societies.sort(key=lambda x: x["scraped"], reverse=True)

    summary = {
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "totalSocieties": len(societies),
        "totalReviews": sum(s["scraped"] for s in societies),
        "societies": societies,
    }

    filepath = DATA_DIR / "_summary.json"
    filepath.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nSummary saved to {filepath}")


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Allow filtering by name substring
    filters = [a.lower() for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv

    if force:
        print("Force mode: re-scraping all societies")

    results = []
    skipped = []
    failed = []

    for i, society in enumerate(SOCIETIES):
        name = society["name"]

        # Apply filter
        if filters and not any(f in name.lower() for f in filters):
            continue

        print(f"\n[{i + 1}/{len(SOCIETIES)}] Processing {name}...")

        try:
            # If force mode, delete existing files
            if force:
                for slug_candidate in society["slugs"]:
                    existing_file = DATA_DIR / f"{slug_candidate}.json"
                    if existing_file.exists():
                        existing_file.unlink()

            result = scrape_society(society)
            if result:
                results.append(result)
            else:
                failed.append(name)
        except Exception as e:
            print(f"  ❌ Error scraping {name}: {e}")
            import traceback
            traceback.print_exc()
            failed.append(name)

    # Also include any previously scraped societies not in this run
    existing_files = list(DATA_DIR.glob("*.json"))
    existing_slugs = {r["slug"] for r in results}
    for f in existing_files:
        if f.name.startswith("_"):
            continue
        try:
            data = json.loads(f.read_text())
            if data.get("slug") not in existing_slugs:
                results.append(data)
        except Exception:
            pass

    # Save summary
    save_summary(results)

    # Print final report
    print(f"\n{'=' * 60}")
    print(f"SCRAPING COMPLETE")
    print(f"{'=' * 60}")
    print(f"Societies scraped: {len(results)}")
    print(f"Total reviews: {sum(len(r['reviews']) for r in results)}")
    if failed:
        print(f"Failed/not found: {', '.join(failed)}")

    for r in sorted(results, key=lambda x: len(x["reviews"]), reverse=True):
        print(f"  {r['society']}: {len(r['reviews'])} reviews (avg {r['avgRating']})")


if __name__ == "__main__":
    # Force unbuffered output
    import functools
    print = functools.partial(print, flush=True)
    main()
