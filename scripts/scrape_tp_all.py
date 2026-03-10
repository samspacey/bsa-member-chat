#!/usr/bin/env python3
"""
Scrape Trustpilot reviews for 35 building societies missing them,
then integrate into knowledge .md files.
"""
import json
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

REVIEWS_DIR = Path("/Users/sam/clawd/bsa-member-chat/data/reviews")
KNOWLEDGE_DIR = Path("/Users/sam/clawd/bsa-member-chat/knowledge")

# (knowledge_slug, json_filename, trustpilot_url_candidates)
SOCIETIES = [
    ("beverley", "beverley-building-society.json", [
        "https://uk.trustpilot.com/review/www.beverleybs.co.uk",
        "https://uk.trustpilot.com/review/beverleybs.co.uk",
    ]),
    ("buckinghamshire", "buckinghamshire-building-society.json", [
        "https://uk.trustpilot.com/review/www.bucksbs.co.uk",
        "https://uk.trustpilot.com/review/bucksbs.co.uk",
    ]),
    ("cambridge", "cambridge-building-society.json", [
        "https://uk.trustpilot.com/review/www.cambridgebs.co.uk",
        "https://uk.trustpilot.com/review/cambridgebs.co.uk",
    ]),
    ("chelsea", "chelsea-building-society.json", [
        "https://uk.trustpilot.com/review/www.thechelsea.co.uk",
        "https://uk.trustpilot.com/review/www.chelseabs.co.uk",
    ]),
    ("dudley", "dudley-building-society.json", [
        "https://uk.trustpilot.com/review/www.dudleybs.co.uk",
        "https://uk.trustpilot.com/review/dudleybs.co.uk",
    ]),
    ("earl-shilton", "earl-shilton-building-society.json", [
        "https://uk.trustpilot.com/review/esbs.co.uk",
        "https://uk.trustpilot.com/review/www.esbs.co.uk",
    ]),
    ("family", "the-family-building-society.json", [
        "https://uk.trustpilot.com/review/www.familybs.co.uk",
        "https://uk.trustpilot.com/review/familybs.co.uk",
        "https://uk.trustpilot.com/review/www.thefamilybuildingsociety.co.uk",
    ]),
    ("furness", "furness-building-society.json", [
        "https://uk.trustpilot.com/review/www.furnessbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/furnessbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/www.furnessbs.co.uk",
    ]),
    ("hanley-economic", "hanley-economic-building-society.json", [
        "https://uk.trustpilot.com/review/www.thehanley.co.uk",
        "https://uk.trustpilot.com/review/thehanley.co.uk",
    ]),
    ("harpenden", "harpenden-building-society.json", [
        "https://uk.trustpilot.com/review/www.harpendenbs.co.uk",
        "https://uk.trustpilot.com/review/harpendenbs.co.uk",
    ]),
    ("hinckley-rugby", "hinckley-rugby-building-society.json", [
        "https://uk.trustpilot.com/review/www.hrab.co.uk",
        "https://uk.trustpilot.com/review/hrab.co.uk",
    ]),
    ("leek-united", "leek-united-building-society.json", [
        "https://uk.trustpilot.com/review/www.leekunited.co.uk",
        "https://uk.trustpilot.com/review/leekunited.co.uk",
    ]),
    ("leek", "leek-building-society.json", [
        "https://uk.trustpilot.com/review/www.leekbs.co.uk",
        "https://uk.trustpilot.com/review/leekbs.co.uk",
    ]),
    ("loughborough", "loughborough-building-society.json", [
        "https://uk.trustpilot.com/review/www.loughboroughbs.co.uk",
        "https://uk.trustpilot.com/review/loughboroughbs.co.uk",
    ]),
    ("manchester", "manchester-building-society.json", [
        "https://uk.trustpilot.com/review/www.themanchester.co.uk",
        "https://uk.trustpilot.com/review/manchesterbuildingsociety.co.uk",
    ]),
    ("mansfield", "mansfield-building-society.json", [
        "https://uk.trustpilot.com/review/www.mansfieldbs.co.uk",
        "https://uk.trustpilot.com/review/mansfieldbs.co.uk",
    ]),
    ("market-harborough", "market-harborough-building-society.json", [
        "https://uk.trustpilot.com/review/www.mhbs.co.uk",
        "https://uk.trustpilot.com/review/mhbs.co.uk",
    ]),
    ("marsden", "marsden-building-society.json", [
        "https://uk.trustpilot.com/review/www.marsdenbs.co.uk",
        "https://uk.trustpilot.com/review/marsdenbs.co.uk",
    ]),
    ("melton", "melton-mowbray-building-society.json", [
        "https://uk.trustpilot.com/review/www.meltonbs.co.uk",
        "https://uk.trustpilot.com/review/meltonbs.co.uk",
        "https://uk.trustpilot.com/review/www.mmbs.co.uk",
    ]),
    ("national-counties", "national-counties-building-society.json", [
        "https://uk.trustpilot.com/review/www.ncbs.co.uk",
        "https://uk.trustpilot.com/review/ncbs.co.uk",
    ]),
    ("newbury", "newbury-building-society.json", [
        "https://uk.trustpilot.com/review/www.newbury-bs.co.uk",
        "https://uk.trustpilot.com/review/newbury-bs.co.uk",
    ]),
    ("newcastle", "newcastle-building-society.json", [
        "https://uk.trustpilot.com/review/www.newcastle.co.uk",
        "https://uk.trustpilot.com/review/newcastle.co.uk",
        "https://uk.trustpilot.com/review/www.newcastlebs.co.uk",
    ]),
    ("norwich-peterborough", "norwich-and-peterborough-building-society.json", [
        "https://uk.trustpilot.com/review/www.nandp.co.uk",
        "https://uk.trustpilot.com/review/nandp.co.uk",
    ]),
    ("nottingham", "nottingham-building-society.json", [
        "https://uk.trustpilot.com/review/www.thenottingham.com",
        "https://uk.trustpilot.com/review/thenottingham.com",
        "https://uk.trustpilot.com/review/www.nottinghambs.co.uk",
    ]),
    ("penrith", "penrith-building-society.json", [
        "https://uk.trustpilot.com/review/www.penrithbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/penrithbuildingsociety.co.uk",
    ]),
    ("progressive", "progressive-building-society.json", [
        "https://uk.trustpilot.com/review/www.theprogressive.com",
        "https://uk.trustpilot.com/review/theprogressive.com",
    ]),
    ("saffron", "saffron-building-society.json", [
        "https://uk.trustpilot.com/review/www.saffronbs.co.uk",
        "https://uk.trustpilot.com/review/saffronbs.co.uk",
    ]),
    ("scottish", "scottish-building-society.json", [
        "https://uk.trustpilot.com/review/www.scottishbs.co.uk",
        "https://uk.trustpilot.com/review/scottishbs.co.uk",
    ]),
    ("stafford", "stafford-building-society.json", [
        "https://uk.trustpilot.com/review/www.srbs.co.uk",
        "https://uk.trustpilot.com/review/srbs.co.uk",
    ]),
    ("suffolk", "suffolk-building-society.json", [
        "https://uk.trustpilot.com/review/www.suffolkbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/suffolkbuildingsociety.co.uk",
    ]),
    ("swansea", "swansea-building-society.json", [
        "https://uk.trustpilot.com/review/www.swansea-bs.co.uk",
        "https://uk.trustpilot.com/review/swansea-bs.co.uk",
    ]),
    ("teachers", "teachers-building-society.json", [
        "https://uk.trustpilot.com/review/www.teachersbs.co.uk",
        "https://uk.trustpilot.com/review/teachersbs.co.uk",
    ]),
    ("tipton-coseley", "tipton-coseley-building-society.json", [
        "https://uk.trustpilot.com/review/www.thetipton.co.uk",
        "https://uk.trustpilot.com/review/thetipton.co.uk",
    ]),
    ("vernon", "vernon-building-society.json", [
        "https://uk.trustpilot.com/review/www.vernonbs.co.uk",
        "https://uk.trustpilot.com/review/vernonbs.co.uk",
    ]),
    ("west-bromwich", "west-bromwich-building-society.json", [
        "https://uk.trustpilot.com/review/www.westbrom.co.uk",
        "https://uk.trustpilot.com/review/westbrom.co.uk",
    ]),
]


def fetch_url(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  HTTP {e.code} for {url}", flush=True)
        return None
    except Exception as e:
        print(f"  Error fetching {url}: {e}", flush=True)
        return None


def parse_reviews_from_next_data(html):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return [], 0
    try:
        data = json.loads(m.group(1))
        page_props = data.get('props', {}).get('pageProps', {})
        bu = page_props.get('businessUnit', {})
        total = bu.get('numberOfReviews', 0)
        reviews = []
        for r in page_props.get('reviews', []):
            title = r.get('title', '') or ''
            text = r.get('text', '') or ''
            rating = r.get('rating', 0)
            dates = r.get('dates', {})
            pub_date = dates.get('publishedDate', '') or dates.get('experiencedDate', '')
            reviews.append({
                'title': title.strip(),
                'text': text.strip(),
                'rating': int(rating),
                'date': pub_date,
            })
        return reviews, total
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"  Parse error: {e}", flush=True)
        return [], 0


def format_date(date_str):
    if not date_str:
        return date_str
    if any(m in date_str for m in ['January', 'February', 'March', 'April', 'May', 'June',
                                     'July', 'August', 'September', 'October', 'November', 'December']):
        return date_str
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        day = dt.day
        if 11 <= day <= 13:
            suffix = 'th'
        elif day % 10 == 1:
            suffix = 'st'
        elif day % 10 == 2:
            suffix = 'nd'
        elif day % 10 == 3:
            suffix = 'rd'
        else:
            suffix = 'th'
        return f"{day}{suffix} {dt.strftime('%B %Y')}"
    except (ValueError, AttributeError):
        return date_str


def determine_sentiment(rating):
    if rating >= 4:
        return "Positive"
    elif rating == 3:
        return "Mixed"
    else:
        return "Negative"


def star_str(rating):
    return "⭐" * rating + "☆" * (5 - rating)


def knowledge_already_has_trustpilot(slug):
    kf = KNOWLEDGE_DIR / f"{slug}.md"
    if not kf.exists():
        return False
    content = kf.read_text(encoding='utf-8')
    return 'trustpilot' in content.lower()


def update_knowledge_file(slug, tp_reviews):
    """Append Trustpilot reviews section to knowledge file."""
    kf = KNOWLEDGE_DIR / f"{slug}.md"
    if not kf.exists():
        print(f"  ⚠️  Knowledge file not found: {kf}", flush=True)
        return False

    # Check again just in case
    content = kf.read_text(encoding='utf-8')
    if 'trustpilot' in content.lower():
        print(f"  ℹ️  Knowledge file already has Trustpilot section, skipping", flush=True)
        return False

    # Limit to 20 most recent
    reviews_to_add = tp_reviews[:20]

    section_lines = [
        "",
        "## Trustpilot Reviews",
        "",
    ]
    for r in reviews_to_add:
        sentiment = determine_sentiment(r['rating'])
        title = r['title'] or '(no title)'
        text = r['text'] or '(no review text)'
        rating = r['rating']
        date = r['date']
        stars = star_str(rating)

        section_lines.append(f"### {sentiment} - {title} (Trustpilot)")
        section_lines.append(f'> "{text}"')
        section_lines.append(f"- **Rating:** {stars} ({rating}/5)")
        section_lines.append(f"- **Date:** {date}")
        section_lines.append("")

    section = "\n".join(section_lines)
    new_content = content.rstrip() + "\n" + section + "\n"

    kf.write_text(new_content, encoding='utf-8')
    print(f"  ✅ Updated knowledge file with {len(reviews_to_add)} reviews", flush=True)
    return True


def main():
    results_summary = []

    for slug, json_file, url_candidates in SOCIETIES:
        print(f"\n{'='*60}", flush=True)
        print(f"Processing: {slug} ({json_file})", flush=True)

        # Check if knowledge file already has Trustpilot
        if knowledge_already_has_trustpilot(slug):
            print(f"  ℹ️  Knowledge file already has Trustpilot — skipping scrape", flush=True)
            results_summary.append((slug, 0, 0, "already_done"))
            continue

        # Load existing reviews JSON
        json_path = REVIEWS_DIR / json_file
        existing_data = {}
        existing_reviews = []

        if json_path.exists():
            with open(json_path) as f:
                existing_data = json.load(f)
            existing_reviews = existing_data.get('reviews', [])
            print(f"  Existing reviews in JSON: {len(existing_reviews)}", flush=True)
        else:
            print(f"  No existing JSON file — will create", flush=True)

        # Dedup set based on title+date
        existing_keys = set()
        for r in existing_reviews:
            t = r.get('title', '').strip().lower()[:40]
            d = r.get('date', '').strip().lower()
            existing_keys.add((t, d))

        # Try URL candidates
        all_tp_reviews = []
        working_url = None
        total_on_tp = 0

        for url in url_candidates:
            print(f"  Trying: {url}", flush=True)
            html = fetch_url(url)
            if not html:
                print(f"    -> Not found / error", flush=True)
                time.sleep(0.5)
                continue

            reviews, total = parse_reviews_from_next_data(html)
            if reviews:
                working_url = url
                total_on_tp = total
                all_tp_reviews.extend(reviews)
                print(f"    -> Found {len(reviews)} reviews (total on TP: {total})", flush=True)

                # Fetch extra pages (cap at 10 pages / 200 reviews)
                if total > 20:
                    max_pages = min((total // 20) + 1, 10)
                    for page in range(2, max_pages + 1):
                        paged_url = f"{url}?page={page}"
                        print(f"  Fetching page {page}...", flush=True)
                        time.sleep(1.5)
                        phtml = fetch_url(paged_url)
                        if not phtml:
                            break
                        previews, _ = parse_reviews_from_next_data(phtml)
                        if not previews:
                            break
                        all_tp_reviews.extend(previews)
                        print(f"    -> Got {len(previews)} more reviews", flush=True)
                break
            else:
                print(f"    -> No reviews found", flush=True)
            time.sleep(0.5)

        if not all_tp_reviews:
            print(f"  ❌ No Trustpilot reviews found for {slug}", flush=True)
            results_summary.append((slug, 0, 0, "not_found"))
            time.sleep(2)
            continue

        print(f"  Total Trustpilot reviews scraped: {len(all_tp_reviews)}", flush=True)

        # Merge into existing reviews
        new_count = 0
        formatted_tp_reviews = []
        for tr in all_tp_reviews:
            formatted_date = format_date(tr['date'])
            title = tr['title'].strip()
            key = (title.lower()[:40], formatted_date.lower())

            if key not in existing_keys:
                new_review = {
                    'title': title,
                    'text': tr['text'],
                    'rating': tr['rating'],
                    'date': formatted_date,
                    'product': 'General',
                    'sentiment': determine_sentiment(tr['rating']).lower(),
                    'source': 'trustpilot'
                }
                existing_reviews.append(new_review)
                existing_keys.add(key)
                new_count += 1

            formatted_tp_reviews.append({
                'title': title,
                'text': tr['text'],
                'rating': tr['rating'],
                'date': formatted_date,
            })

        print(f"  Added {new_count} new reviews to JSON (total now: {len(existing_reviews)})", flush=True)

        # Save JSON
        existing_data['reviews'] = existing_reviews
        existing_data['trustpilotUrl'] = working_url
        if 'scrapedAt' not in existing_data:
            existing_data['scrapedAt'] = datetime.utcnow().isoformat() + '+00:00'

        with open(json_path, 'w') as f:
            json.dump(existing_data, f, indent=2, ensure_ascii=False)
        print(f"  Saved JSON: {json_file}", flush=True)

        # Update knowledge file
        update_knowledge_file(slug, formatted_tp_reviews)

        results_summary.append((slug, len(all_tp_reviews), new_count, "success"))
        time.sleep(2.5)  # polite delay between societies

    # Print summary
    print(f"\n{'='*60}", flush=True)
    print("FINAL SUMMARY", flush=True)
    print(f"{'='*60}", flush=True)
    success = [r for r in results_summary if r[3] == "success"]
    not_found = [r for r in results_summary if r[3] == "not_found"]
    already = [r for r in results_summary if r[3] == "already_done"]

    print(f"\n✅ SUCCESS ({len(success)} societies):", flush=True)
    for slug, found, added, _ in success:
        print(f"   {slug}: scraped {found}, added {added} new to JSON", flush=True)

    if not_found:
        print(f"\n❌ NOT FOUND ({len(not_found)} societies):", flush=True)
        for slug, _, _, _ in not_found:
            print(f"   {slug}", flush=True)

    if already:
        print(f"\nℹ️  ALREADY HAD TRUSTPILOT ({len(already)} societies):", flush=True)
        for slug, _, _, _ in already:
            print(f"   {slug}", flush=True)

    print(f"\nTotal: {len(SOCIETIES)} societies processed", flush=True)


if __name__ == '__main__':
    main()
