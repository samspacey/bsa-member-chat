#!/usr/bin/env python3
"""
Scrape Trustpilot reviews for building societies and merge with existing SMP reviews.
Uses __NEXT_DATA__ JSON embedded in Trustpilot pages.
"""
import json
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

REVIEWS_DIR = Path("/Users/sam/clawd/bsa-member-chat/data/reviews")

# Map: (society name, existing json filename, list of trustpilot URL candidates)
SOCIETIES = [
    ("Earl Shilton Building Society", "earl-shilton-building-society.json", [
        "https://uk.trustpilot.com/review/esbs.co.uk",
    ]),
    ("Cambridge Building Society", "cambridge-building-society.json", [
        "https://uk.trustpilot.com/review/www.cambridgebs.co.uk",
    ]),
    ("Chelsea Building Society", "chelsea-building-society.json", [
        "https://uk.trustpilot.com/review/www.thechelsea.co.uk",
        "https://uk.trustpilot.com/review/www.chelseabs.co.uk",
    ]),
    ("Manchester Building Society", "manchester-building-society.json", [
        "https://uk.trustpilot.com/review/www.themanchester.co.uk",
        "https://uk.trustpilot.com/review/manchesterbuildingsociety.co.uk",
    ]),
    ("Penrith Building Society", "penrith-building-society.json", [
        "https://uk.trustpilot.com/review/www.penrithbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/penrithbuildingsociety.co.uk",
    ]),
    ("Progressive Building Society", "progressive-building-society.json", [
        "https://uk.trustpilot.com/review/www.theprogressive.com",
    ]),
    ("Swansea Building Society", "swansea-building-society.json", [
        "https://uk.trustpilot.com/review/www.swansea-bs.co.uk",
        "https://uk.trustpilot.com/review/swansea-bs.co.uk",
    ]),
    ("Market Harborough Building Society", "market-harborough-building-society.json", [
        "https://uk.trustpilot.com/review/www.mhbs.co.uk",
        "https://uk.trustpilot.com/review/mhbs.co.uk",
    ]),
    ("Chorley Building Society", "Chorley-building-society.json", [
        "https://uk.trustpilot.com/review/www.chorleybs.co.uk",
        "https://uk.trustpilot.com/review/chorleybs.co.uk",
    ]),
    ("National Counties Building Society", "national-counties-building-society.json", [
        "https://uk.trustpilot.com/review/www.ncbs.co.uk",
        "https://uk.trustpilot.com/review/ncbs.co.uk",
    ]),
    ("Norwich & Peterborough Building Society", "norwich-and-peterborough-building-society.json", [
        "https://uk.trustpilot.com/review/www.nandp.co.uk",
        "https://uk.trustpilot.com/review/nandp.co.uk",
    ]),
    ("Teachers Building Society", "teachers-building-society.json", [
        "https://uk.trustpilot.com/review/www.teachersbs.co.uk",
        "https://uk.trustpilot.com/review/teachersbs.co.uk",
    ]),
    ("Furness Building Society", "furness-building-society.json", [
        "https://uk.trustpilot.com/review/www.furnessbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/furnessbuildingsociety.co.uk",
        "https://uk.trustpilot.com/review/www.furnessbs.co.uk",
    ]),
    ("Leek United Building Society", "leek-united-building-society.json", [
        "https://uk.trustpilot.com/review/www.leekunited.co.uk",
        "https://uk.trustpilot.com/review/leekunited.co.uk",
    ]),
    ("West Bromwich Building Society", "west-bromwich-building-society.json", [
        "https://uk.trustpilot.com/review/www.westbrom.co.uk",
        "https://uk.trustpilot.com/review/westbrom.co.uk",
    ]),
]


def fetch_url(url):
    """Fetch a URL and return text content."""
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
    """Extract reviews from __NEXT_DATA__ JSON in the HTML."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return [], 0
    
    try:
        data = json.loads(m.group(1))
        page_props = data.get('props', {}).get('pageProps', {})
        
        # Get total review count
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
    """Convert ISO date to human-readable format like '5th February 2026'."""
    if not date_str:
        return date_str
    
    # If already in human format, return as-is
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
        return "positive"
    elif rating == 3:
        return "neutral"
    else:
        return "negative"


def main():
    results_summary = []
    
    for society_name, json_file, url_candidates in SOCIETIES:
        print(f"\n{'='*60}", flush=True)
        print(f"Processing: {society_name}", flush=True)
        
        # Load existing reviews
        json_path = REVIEWS_DIR / json_file
        existing_data = None
        existing_reviews = []
        
        if json_path.exists():
            with open(json_path) as f:
                existing_data = json.load(f)
            existing_reviews = existing_data.get('reviews', [])
            print(f"  Existing reviews: {len(existing_reviews)}", flush=True)
        else:
            print(f"  No existing file - will create new", flush=True)
        
        # Build set of existing review keys for dedup
        # Normalize: lowercase title (first 40 chars) + date
        existing_keys = set()
        for r in existing_reviews:
            t = r.get('title', '').strip().lower()[:40]
            d = r.get('date', '').strip().lower()
            existing_keys.add((t, d))
        
        # Try each URL candidate
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
                
                # Fetch additional pages if there are more reviews
                if total > 20:  # Trustpilot shows 20 per page
                    max_pages = min((total // 20) + 1, 10)  # Cap at 10 pages
                    for page in range(2, max_pages + 1):
                        paged_url = f"{url}?page={page}"
                        print(f"  Fetching page {page}...", flush=True)
                        time.sleep(1)
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
            print(f"  ❌ No Trustpilot reviews found for {society_name}", flush=True)
            results_summary.append((society_name, 0, 0))
            continue
        
        print(f"  Total Trustpilot reviews scraped: {len(all_tp_reviews)}", flush=True)
        
        # Merge - add non-duplicate reviews
        new_count = 0
        for tr in all_tp_reviews:
            formatted_date = format_date(tr['date'])
            title = tr['title'].strip()
            
            # Check for duplicates using normalized key
            key = (title.lower()[:40], formatted_date.lower())
            if key in existing_keys:
                continue
            
            new_review = {
                'title': title,
                'text': tr['text'],
                'rating': tr['rating'],
                'date': formatted_date,
                'product': 'General',
                'sentiment': determine_sentiment(tr['rating']),
                'source': 'trustpilot'
            }
            existing_reviews.append(new_review)
            existing_keys.add(key)
            new_count += 1
        
        print(f"  ✅ Added {new_count} new reviews (total now: {len(existing_reviews)})", flush=True)
        results_summary.append((society_name, len(all_tp_reviews), new_count))
        
        # Save
        if existing_data:
            existing_data['reviews'] = existing_reviews
            existing_data['trustpilotUrl'] = working_url
        else:
            existing_data = {
                'society': society_name,
                'slug': json_file.replace('.json', ''),
                'trustpilotUrl': working_url,
                'scrapedAt': datetime.utcnow().isoformat() + '+00:00',
                'reviews': existing_reviews
            }
        
        with open(json_path, 'w') as f:
            json.dump(existing_data, f, indent=2, ensure_ascii=False)
        print(f"  Saved to {json_file}", flush=True)
        
        time.sleep(1)
    
    # Summary
    print(f"\n{'='*60}", flush=True)
    print("SUMMARY", flush=True)
    print(f"{'='*60}", flush=True)
    for name, found, added in results_summary:
        status = "✅" if added > 0 else ("⚠️" if found > 0 else "❌")
        print(f"  {status} {name}: found {found} on Trustpilot, added {added} new", flush=True)


if __name__ == '__main__':
    main()
