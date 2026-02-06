#!/usr/bin/env python3
"""Update societies.json with all scraped societies."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "societies.json")) as f:
    existing = json.load(f)
existing_ids = {s["id"] for s in existing}

with open(os.path.join(ROOT, "data", "reviews", "_summary.json")) as f:
    summary = json.load(f)

slug_to_id = {
    "bath-building-society": "bath",
    "beverley-building-society": "beverley",
    "buckinghamshire-building-society": "buckinghamshire",
    "cambridge-building-society": "cambridge",
    "chelsea-building-society": "chelsea",
    "coventry-building-society": "coventry",
    "the-cumberland": "cumberland",
    "darlington-building-society": "darlington",
    "dudley-building-society": "dudley",
    "earl-shilton-building-society": "earl-shilton",
    "ecology-building-society": "ecology",
    "the-family-building-society": "family",
    "furness-building-society": "furness",
    "hanley-economic-building-society": "hanley-economic",
    "harpenden-building-society": "harpenden",
    "hinckley-rugby-building-society": "hinckley-rugby",
    "leeds-building-society": "leeds",
    "leek-building-society": "leek",
    "loughborough-building-society": "loughborough",
    "manchester-building-society": "manchester",
    "mansfield-building-society": "mansfield",
    "market-harborough-building-society": "market-harborough",
    "marsden-building-society": "marsden",
    "melton-mowbray-building-society": "melton",
    "monmouthshire-building-society": "monmouthshire",
    "national-counties-building-society": "national-counties",
    "nationwide": "nationwide",
    "newbury-building-society": "newbury",
    "newcastle-building-society": "newcastle",
    "norwich-and-peterborough-building-society": "norwich-peterborough",
    "nottingham-building-society": "nottingham",
    "penrith-building-society": "penrith",
    "principality-building-society": "principality",
    "progressive-building-society": "progressive",
    "saffron-building-society": "saffron",
    "scottish-building-society": "scottish",
    "skipton-building-society": "skipton",
    "stafford-building-society": "stafford",
    "suffolk-building-society": "suffolk",
    "swansea-building-society": "swansea",
    "teachers-building-society": "teachers",
    "tipton-coseley-building-society": "tipton-coseley",
    "vernon-building-society": "vernon",
    "yorkshire-building-society": "yorkshire",
}

new_metadata = {
    "beverley": {"emoji": "\U0001f3d8\ufe0f", "region": "Yorkshire", "tagline": "Local savings and mortgages", "color": "#2E5090"},
    "buckinghamshire": {"emoji": "\U0001f9a2", "region": "South East", "tagline": "Independent financial advice", "color": "#1B4D3E"},
    "cambridge": {"emoji": "\U0001f4da", "region": "East Anglia", "tagline": "Community-focused lending", "color": "#4B0082"},
    "chelsea": {"emoji": "\U0001f48e", "region": "London", "tagline": "Part of YBS Group", "color": "#1C3A5F"},
    "darlington": {"emoji": "\U0001f3db\ufe0f", "region": "North East", "tagline": "Award-winning mortgage service", "color": "#003D6B"},
    "dudley": {"emoji": "\u2699\ufe0f", "region": "Midlands", "tagline": "Financial advice and mortgages", "color": "#6B2D5B"},
    "earl-shilton": {"emoji": "\U0001f3e1", "region": "Midlands", "tagline": "Small community mutual", "color": "#2F4F4F"},
    "family": {"emoji": "\U0001f468\u200d\U0001f469\u200d\U0001f467\u200d\U0001f466", "region": "South East", "tagline": "Specialist family mortgages", "color": "#FF6B35"},
    "furness": {"emoji": "\u2693", "region": "Cumbria", "tagline": "Regional savings and mortgages", "color": "#1E90FF"},
    "hanley-economic": {"emoji": "\U0001f3fa", "region": "Midlands", "tagline": "Staffordshire-based mutual", "color": "#8B0000"},
    "harpenden": {"emoji": "\U0001f333", "region": "South East", "tagline": "Hertfordshire building society", "color": "#228B22"},
    "hinckley-rugby": {"emoji": "\U0001f3c9", "region": "Midlands", "tagline": "Heart of England mutual", "color": "#4169E1"},
    "leek": {"emoji": "\u26f0\ufe0f", "region": "Midlands", "tagline": "Staffordshire Moorlands-based", "color": "#2E8B57"},
    "loughborough": {"emoji": "\U0001f393", "region": "Midlands", "tagline": "Leicestershire mutual", "color": "#6A0DAD"},
    "manchester": {"emoji": "\U0001f41d", "region": "North West", "tagline": "Manchester-based mutual", "color": "#E31B23"},
    "mansfield": {"emoji": "\U0001f3d7\ufe0f", "region": "Midlands", "tagline": "Nottinghamshire mutual", "color": "#006400"},
    "market-harborough": {"emoji": "\U0001f3d8\ufe0f", "region": "Midlands", "tagline": "Local Leicestershire mutual", "color": "#556B2F"},
    "marsden": {"emoji": "\u26f0\ufe0f", "region": "Yorkshire", "tagline": "West Yorkshire mutual", "color": "#483D8B"},
    "melton": {"emoji": "\U0001f9c0", "region": "Midlands", "tagline": "Melton Mowbray-based", "color": "#B8860B"},
    "national-counties": {"emoji": "\U0001f3e0", "region": "South East", "tagline": "Specialist savings accounts", "color": "#2F4F4F"},
    "newbury": {"emoji": "\U0001f40e", "region": "South East", "tagline": "Berkshire-based mutual", "color": "#1C1C1C"},
    "newcastle": {"emoji": "\U0001f309", "region": "North East", "tagline": "North East building society", "color": "#003366"},
    "norwich-peterborough": {"emoji": "\u26ea", "region": "East Anglia", "tagline": "Now part of YBS Group", "color": "#336633"},
    "nottingham": {"emoji": "\U0001f3f9", "region": "Midlands", "tagline": "Savings specialists", "color": "#3CB371"},
    "penrith": {"emoji": "\u26f0\ufe0f", "region": "Cumbria", "tagline": "Lake District mutual", "color": "#696969"},
    "progressive": {"emoji": "\u2618\ufe0f", "region": "Northern Ireland", "tagline": "Northern Ireland mutual", "color": "#006747"},
    "saffron": {"emoji": "\U0001f33e", "region": "East Anglia", "tagline": "Essex-based mutual", "color": "#FF8C00"},
    "scottish": {"emoji": "\U0001f3f4\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074\U000e007f", "region": "Scotland", "tagline": "Scotland's building society", "color": "#003399"},
    "stafford": {"emoji": "\U0001f682", "region": "Midlands", "tagline": "Railway heritage mutual", "color": "#8B4513"},
    "suffolk": {"emoji": "\U0001f30a", "region": "East Anglia", "tagline": "Suffolk-based mutual", "color": "#4682B4"},
    "swansea": {"emoji": "\U0001f3f4\U000e0067\U000e0062\U000e0077\U000e006c\U000e0073\U000e007f", "region": "Wales", "tagline": "South Wales mutual", "color": "#CC0000"},
    "teachers": {"emoji": "\U0001f4d6", "region": "National", "tagline": "For education professionals", "color": "#4B0082"},
    "tipton-coseley": {"emoji": "\U0001f3ed", "region": "Midlands", "tagline": "Black Country mutual", "color": "#2F4F4F"},
    "vernon": {"emoji": "\U0001f3f0", "region": "North West", "tagline": "Stockport-based mutual", "color": "#8B0000"},
}

new_societies = list(existing)

for soc in summary["societies"]:
    sid = slug_to_id.get(soc["slug"], soc["slug"])
    if sid in existing_ids:
        continue

    meta = new_metadata.get(sid, {})
    short = soc["name"].replace(" Building Society", "").replace("The ", "")

    new_societies.append({
        "id": sid,
        "name": soc["name"],
        "shortName": short,
        "emoji": meta.get("emoji", "\U0001f3e0"),
        "region": meta.get("region", "England"),
        "size": "",
        "tagline": meta.get("tagline", "Local building society"),
        "color": meta.get("color", "#333333"),
    })

with open(os.path.join(ROOT, "societies.json"), "w") as f:
    json.dump(new_societies, f, indent=2, ensure_ascii=False)

print(f"Updated societies.json: {len(new_societies)} societies ({len(new_societies) - len(existing)} new)")
