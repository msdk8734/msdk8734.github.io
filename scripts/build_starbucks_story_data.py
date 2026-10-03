#!/usr/bin/env python3
"""Build the April 2026 story's map points from its archived official-store CSV.

Usage: python3 scripts/build_starbucks_story_data.py /path/to/archived.csv

This deliberately does not fetch the current locator: the article describes a
fixed snapshot. Every input row must reconcile with the existing April counts.
"""

import argparse
from collections import Counter
import csv
import hashlib
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "stories/starbucks-japan/story-data.json"
APRIL_CSV_SHA256 = "904375e3608c18a59c6b739791f5324de73d60b6f8c197ef803c6633617d52cf"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def build(csv_path):
    if hashlib.sha256(csv_path.read_bytes()).hexdigest() != APRIL_CSV_SHA256:
        raise ValueError("This article must be built from the verified April 2026 CSV, not a newer store inventory.")
    counts = read_json(ROOT / "data/starbucks-municipality-counts.json")
    pref_counts = read_json(ROOT / "data/starbucks-store-counts.json")
    ranking = read_json(ROOT / "data/starbucks-national-municipality-ranking.json")
    pref_population = read_json(ROOT / "population-json/pref-pop.json")
    prefectures = counts["municipalities"]
    prefecture_codes = {p["prefNameJa"]: code for code, p in prefectures.items()}
    with csv_path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    expected_count = counts["source"]["uniqueStoreUrlCount"]
    if len(rows) != expected_count or len({r["url"] for r in rows}) != expected_count:
        raise ValueError("The CSV must contain exactly the April snapshot's 2,108 unique store URLs.")

    stores = []
    for row in rows:
        pref_code = prefecture_codes[row["prefecture"]]
        address = row["full_address"].removeprefix(row["prefecture"])
        matches = [
            entry for entry in prefectures[pref_code]["entries"].values()
            if address.startswith(entry["nameJa"])
        ]
        if len(matches) != 1:
            raise ValueError(f"Ambiguous or missing municipality for store {row['store_id']}")
        lat, lon = float(row["latitude"]), float(row["longitude"])
        if not (math.isfinite(lat) and math.isfinite(lon) and 20 <= lat <= 46 and 122 <= lon <= 154):
            raise ValueError(f"Missing or invalid Japan coordinate for store {row['store_id']}")
        expected_url = f"https://store.starbucks.co.jp/detail-{row['store_id']}/"
        if row["url"] != expected_url:
            raise ValueError(f"Unexpected source URL for store {row['store_id']}")
        stores.append({
            "id": row["store_id"],
            "name": row["store_name"],
            "lat": lat,
            "lon": lon,
            "prefCode": pref_code,
            "muniCode": matches[0]["code"],
            "url": row["url"],
        })
    stores.sort(key=lambda store: int(store["id"]))
    actual_municipalities = Counter(store["muniCode"] for store in stores)
    actual_prefectures = Counter(store["prefCode"] for store in stores)
    for pref_code, prefecture in prefectures.items():
        for code, entry in prefecture["entries"].items():
            if actual_municipalities[code] != entry["count"]:
                raise ValueError(f"Municipality count differs from April aggregate: {code}")
        if actual_prefectures[pref_code] != pref_counts["prefectures"][pref_code]["count"]:
            raise ValueError(f"Prefecture count differs from April aggregate: {pref_code}")

    by_id = {store["id"]: store for store in stores}
    top_ten = sorted(ranking["modes"]["city"], key=lambda row: row["per100k"] or 0, reverse=True)[:10]
    featured_codes = {row["code"] for row in top_ten} | {"40130", "40100"}
    population = sum(row["total"] for row in pref_population.values())

    def landmark(identifier, case_id, name, store_ids, source_url):
        anchors = [by_id[store_id] for store_id in store_ids]
        return {
            "id": identifier,
            "caseId": case_id,
            "muniCode": anchors[0]["muniCode"],
            "name": name,
            "lat": sum(store["lat"] for store in anchors) / len(anchors),
            "lon": sum(store["lon"] for store in anchors) / len(anchors),
            "sourceStoreIds": store_ids,
            "sourceUrl": source_url,
            "positionNote": "Approximate facility label, anchored to the archived Starbucks location(s) inside the facility; not a surveyed facility center.",
        }

    return {
        "metadata": {
            "snapshotMonth": "2026-04",
            "captureDate": None,
            "captureDateNote": "The archived CSV does not record an exact collection date. The article identifies this as the April 2026 snapshot; the matching ranking was generated on 2026-04-03.",
            "rankingGeneratedAt": ranking["source"]["generatedAt"],
            "source": "Starbucks Japan official store locator, archived April 2026 CSV",
            "sourceUrl": "https://store.starbucks.co.jp/",
            "sourceFile": csv_path.name,
            "sourceSha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
            "coordinateSource": "Latitude and longitude published in the official store pages' JSON-LD, preserved from the archived CSV without re-geocoding.",
            "coordinateAccuracy": "Locator-supplied positions; not independently surveyed. Facility labels use approximate anchors derived from these points.",
            "municipalityMethod": "Unique address-prefix match against the municipality names in the original April aggregate; all municipality and prefecture totals reconcile exactly.",
            "counts": {
                "snapshotStores": len(stores),
                "mappedStores": len(stores),
                "missingCoordinates": 0,
                "matchedMunicipalities": len(stores),
                "prefectures": len(actual_prefectures),
            },
            "populationSource": "2025 Basic Resident Registration, total population, Ministry of Internal Affairs and Communications. See population-json/README.txt.",
            "notes": [
                "Historical points and counts are not refreshed from current store pages.",
                "Municipality assignment follows the archived address, which may differ from the administrative polygon containing a locator point.",
                "The two Tajiri stores in this snapshot are both in Kansai International Airport Terminal 1. There is no Terminal 2 store in this snapshot.",
            ],
        },
        "stores": stores,
        "statistics": {
            "national": {"count": len(stores), "population": population, "per100k": len(stores) / population * 100000},
            "prefectures": {
                code: {**row, "population": pref_population[code]["total"], "per100k": row["count"] / pref_population[code]["total"] * 100000}
                for code, row in pref_counts["prefectures"].items()
            },
            "municipalities": {row["code"]: row for row in ranking["modes"]["city"] if row["code"] in featured_codes or row["prefCode"] == "40"},
            "topTenCodes": [row["code"] for row in top_ten],
        },
        "landmarks": [
            landmark("tokyo-station", "chiyoda", "Tokyo Station", ["2166"], "https://store.starbucks.co.jp/detail-2166/"),
            landmark("aeon-mall-hiezu", "hiezu", "AEON Mall Hiezu", ["1416"], "https://www.aeon.jp/sc/hiezu/access/"),
            landmark("taga-upbound", "taga", "Taga SA · upbound", ["932"], "https://store.starbucks.co.jp/detail-932/"),
            landmark("taga-downbound", "taga", "Taga SA · downbound", ["980"], "https://store.starbucks.co.jp/detail-980/"),
            landmark("kix-terminal-1", "tajiri", "Kansai Airport · Terminal 1", ["677", "4252"], "https://store.starbucks.co.jp/detail-677/"),
        ],
        "sources": [
            {
                "id": "chiyoda-daytime-population",
                "title": "Chiyoda City: Location, area and population",
                "url": "https://www.city.chiyoda.lg.jp/koho/kuse/gaiyo/yokoso/ichi.html",
                "note": "2020 Census: daytime population 903,780; nighttime population 66,680. These contextual figures are separate from the 2025 resident denominator used for store density.",
            },
            {
                "id": "hiezu-regional-access",
                "title": "AEON Mall Hiezu: Access guide",
                "url": "https://www.aeon.jp/sc/hiezu/access/",
                "note": "The mall is in Hiezu Village and provides driving directions from Matsue and Kurayoshi. This supports regional accessibility, not a measured visitor origin share.",
            },
            {
                "id": "hiezu-store",
                "title": "Starbucks Japan: AEON Mall Hiezu",
                "url": "https://store.starbucks.co.jp/detail-1416/",
                "note": "Official store address places the shop inside AEON Mall Hiezu.",
            },
            {
                "id": "tajiri-airport-south-gate",
                "title": "Starbucks Japan: Kansai International Airport 1F South Gate",
                "url": "https://store.starbucks.co.jp/detail-677/",
                "note": "Official address places the store at the airport in Tajiri Town; the page identifies it as an airport store for use before boarding.",
            },
            {
                "id": "tajiri-airport-second-floor",
                "title": "Starbucks Japan: Kansai International Airport 2F",
                "url": "https://store.starbucks.co.jp/detail-4252/",
                "note": "Official address places the other Tajiri store on the second floor of the airport passenger terminal.",
            },
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="Archived April 2026 unique-store CSV")
    args = parser.parse_args()
    result = build(args.csv)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(result['stores']):,} reconciled store points and {len(result['landmarks'])} facility labels to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
