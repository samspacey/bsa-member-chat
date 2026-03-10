#!/usr/bin/env python3
"""
Integrate Smart Money People reviews from data/reviews/*.json into knowledge/*.md files.
"""

import os
import json
import re
from pathlib import Path

BASE = Path(__file__).parent.parent
REVIEWS_DIR = BASE / "data" / "reviews"
KNOWLEDGE_DIR = BASE / "knowledge"

# Category context mapping
CATEGORY_CONTEXT = {
    "savings": "Savings product review",
    "mortgages": "Mortgage product review",
    "insurance": "Insurance product review",
    "current account": "Current account review",
}

def get_category_context(category: str) -> str:
    cat = (category or "").lower().strip()
    return CATEGORY_CONTEXT.get(cat, "General review")

def stars(rating: int) -> str:
    try:
        n = int(rating)
    except (ValueError, TypeError):
        n = 0
    return "⭐" * n

def format_review(review: dict) -> str:
    sentiment = review.get("sentiment", "Positive")
    title = review.get("title", "Review")
    text = review.get("text", "")
    rating = review.get("rating", 0)
    date = review.get("date", "")
    category = review.get("category", "")

    lines = [
        f"### {sentiment} - {title} (Smart Money People)",
        f'> "{text}"',
        f"- **Rating:** {stars(rating)}",
        f"- **Date:** {date}",
        f"- **Context:** {get_category_context(category)}",
    ]
    return "\n".join(lines)

# Build the JSON slug → knowledge file mapping
# Explicit exceptions first
EXPLICIT_MAP = {
    "the-cumberland": "cumberland",
    "the-family-building-society": "family",
    "melton-mowbray-building-society": "melton",
    "norwich-and-peterborough-building-society": "norwich-peterborough",
    "hinckley-rugby-building-society": "hinckley-rugby",
    "stafford-building-society": "stafford",
    "tipton-coseley-building-society": "tipton-coseley",
    "nationwide": "nationwide",
}

def slug_to_knowledge_name(slug: str) -> str:
    """Convert a JSON slug (no extension) to the expected knowledge file stem."""
    if slug in EXPLICIT_MAP:
        return EXPLICIT_MAP[slug]
    # Strip -building-society suffix
    name = re.sub(r"-building-society$", "", slug)
    return name

def build_mapping():
    """Return dict: knowledge_stem → json_path (or None if no match)."""
    mapping = {}

    # Collect all review JSON slugs (skip _summary.json)
    json_files = {}
    for jf in REVIEWS_DIR.glob("*.json"):
        if jf.name.startswith("_"):
            continue
        slug = jf.stem.lower()  # normalise to lowercase
        json_files[slug] = jf

    # For each knowledge file, find its JSON
    for md in sorted(KNOWLEDGE_DIR.glob("*.md")):
        stem = md.stem  # e.g. "bath", "chorley"

        # Search for a JSON whose slug maps to this stem
        matched_jf = None
        for slug, jf in json_files.items():
            if slug_to_knowledge_name(slug) == stem:
                matched_jf = jf
                break

        mapping[stem] = (md, matched_jf)

    # Report any JSON files that mapped to no knowledge file
    mapped_knowledge = {slug_to_knowledge_name(jf.stem.lower()) for jf in REVIEWS_DIR.glob("*.json") if not jf.name.startswith("_")}
    known_stems = {md.stem for md in KNOWLEDGE_DIR.glob("*.md")}
    unmapped_jsons = mapped_knowledge - known_stems
    if unmapped_jsons:
        print(f"\n⚠️  JSON files with no matching knowledge file: {sorted(unmapped_jsons)}")

    return mapping

def add_trustpilot_suffix(content: str) -> str:
    """Add (Trustpilot) to existing ### Positive/Negative lines that have no source label."""
    def replacer(m):
        line = m.group(0)
        # Already has a source label in parentheses at end?
        if re.search(r'\(.*?\)\s*$', line):
            return line
        return line.rstrip() + " (Trustpilot)"

    return re.sub(r'^### (?:Positive|Negative) - .+$', replacer, content, flags=re.MULTILINE)

def integrate_reviews(md_path: Path, reviews: list) -> tuple[bool, int]:
    """
    Integrate reviews into a knowledge file.
    Returns (was_updated, num_reviews_added).
    """
    content = md_path.read_text(encoding="utf-8")

    # Skip if already integrated
    if "Smart Money People" in content:
        return False, 0

    # Rename heading
    content = content.replace("## Specific Trustpilot Reviews", "## Specific Customer Reviews")

    # Add (Trustpilot) to existing unlabelled reviews
    content = add_trustpilot_suffix(content)

    # Format new SMP reviews
    review_blocks = []
    for r in reviews:
        review_blocks.append(format_review(r))

    if not review_blocks:
        return False, 0

    review_section = "\n\n".join(review_blocks)

    # Insert before final --- divider or append at end
    final_divider = re.search(r'\n---\s*$', content)
    if final_divider:
        insert_pos = final_divider.start()
        content = content[:insert_pos] + "\n\n" + review_section + content[insert_pos:]
    else:
        content = content.rstrip() + "\n\n" + review_section + "\n"

    md_path.write_text(content, encoding="utf-8")
    return True, len(review_blocks)

def main():
    mapping = build_mapping()

    updated = []
    skipped_already_done = []
    skipped_no_json = []
    skipped_no_reviews = []

    print("\n" + "="*60)
    print("Smart Money People Review Integration")
    print("="*60)

    for stem, (md_path, json_path) in sorted(mapping.items()):
        content = md_path.read_text(encoding="utf-8")

        # Already integrated?
        if "Smart Money People" in content:
            skipped_already_done.append(stem)
            print(f"  ⏭️  SKIP (already done): {stem}.md")
            continue

        # No matching JSON?
        if json_path is None:
            skipped_no_json.append(stem)
            print(f"  ❓  SKIP (no JSON):       {stem}.md")
            continue

        # Load reviews
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        reviews = data.get("reviews", [])
        if not reviews:
            skipped_no_reviews.append(stem)
            print(f"  0️⃣  SKIP (no reviews):    {stem}.md  [{json_path.name}]")
            continue

        was_updated, count = integrate_reviews(md_path, reviews)
        if was_updated:
            updated.append((stem, count))
            print(f"  ✅  UPDATED ({count:2d} reviews): {stem}.md  [{json_path.name}]")
        else:
            # Shouldn't reach here but handle gracefully
            skipped_no_reviews.append(stem)
            print(f"  ⚪  SKIP (no change):     {stem}.md")

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"  Updated:              {len(updated)} files ({sum(c for _, c in updated)} reviews added)")
    print(f"  Already integrated:   {len(skipped_already_done)} files")
    print(f"  No matching JSON:     {len(skipped_no_json)} files")
    print(f"  No reviews in JSON:   {len(skipped_no_reviews)} files")
    print()

    if updated:
        print("Updated files:")
        for stem, count in updated:
            print(f"  - {stem}.md ({count} reviews)")

    if skipped_already_done:
        print("\nAlready done (skipped):")
        for stem in skipped_already_done:
            print(f"  - {stem}.md")

    if skipped_no_json:
        print("\nNo matching JSON (skipped):")
        for stem in skipped_no_json:
            print(f"  - {stem}.md")

    if skipped_no_reviews:
        print("\nNo reviews in JSON (skipped):")
        for stem in skipped_no_reviews:
            print(f"  - {stem}.md")

if __name__ == "__main__":
    main()
