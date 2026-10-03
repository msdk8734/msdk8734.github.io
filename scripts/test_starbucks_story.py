#!/usr/bin/env python3
"""Regression checks for the article's frozen snapshot and readable HTML fallbacks."""
import json
import re
import unittest
from collections import Counter
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY = ROOT / "stories/starbucks-japan"


class Article(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.ids = []
        self.links = []
        self.steps = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if "data-step" in attrs:
            self.steps.append(int(attrs["data-step"]))
        if tag == "a":
            self.links.append(attrs.get("href", ""))


class StorySnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((STORY / "story-data.json").read_text())
        cls.html = (STORY / "index.html").read_text()
        cls.article = Article(cls.html)

    def test_snapshot_points_reconcile_with_frozen_statistics(self):
        stores = self.data["stores"]
        self.assertEqual(len(stores), 2108)
        self.assertEqual(len({s["id"] for s in stores}), 2108)
        self.assertEqual(len({s["url"] for s in stores}), 2108)
        counts = Counter(s["prefCode"] for s in stores)
        self.assertEqual(len(counts), 47)
        for code, pref in self.data["statistics"]["prefectures"].items():
            self.assertEqual(counts[code], pref["count"])
            self.assertAlmostEqual(pref["per100k"], pref["count"] / pref["population"] * 100000)
        for store in stores:
            self.assertTrue(20 <= store["lat"] <= 46 and 122 <= store["lon"] <= 154)
        self.assertEqual(self.data["metadata"]["snapshotMonth"], "2026-04")

    def test_featured_cases_and_context_are_historical(self):
        counts = Counter(s["muniCode"] for s in self.data["stores"])
        self.assertEqual([counts[c] for c in ("13101", "31384", "25443", "27362")], [48, 1, 2, 2])
        self.assertEqual(len(self.data["landmarks"]), 5)
        self.assertEqual(self.data["statistics"]["topTenCodes"][:4], ["13101", "31384", "25443", "27362"])
        taga = [s for s in self.data["stores"] if s["muniCode"] == "25443"]
        self.assertEqual({s["id"] for s in taga}, {"932", "980"})
        ids = {s["id"] for s in self.data["stores"]}
        for landmark in self.data["landmarks"]:
            self.assertTrue(set(landmark["sourceStoreIds"]) <= ids)
            self.assertIn("Approximate", landmark["positionNote"])

    def test_readable_numbers_match_snapshot(self):
        stats = self.data["statistics"]
        national = stats["national"]
        self.assertEqual(national["population"], 124330690)
        self.assertAlmostEqual(national["per100k"], 2108 / 124330690 * 100000)
        for name, code in (("chiyoda", "13101"), ("hiezu", "31384"), ("taga", "25443"), ("tajiri", "27362")):
            row = stats["municipalities"][code]
            shown = re.search(rf'data-stat="{name}-rate">([^<]+)', self.html).group(1)
            self.assertEqual(shown, f'{row["per100k"]:.1f}')
        fukuoka = stats["municipalities"]["40130"]
        kitakyushu = stats["municipalities"]["40100"]
        f_rate = fukuoka["count"] / fukuoka["population"] * 100000
        k_rate = kitakyushu["count"] / kitakyushu["population"] * 100000
        widths = [float(v) for v in re.findall(r'--bar-width:([\d.]+)%', self.html)]
        for shown, actual in zip(widths, [100, national["per100k"] / f_rate * 100, k_rate / f_rate * 100]):
            self.assertAlmostEqual(shown, actual, places=3)
        self.assertEqual(round(f_rate / national["per100k"], 1), 1.9)
        self.assertEqual(round(f_rate / k_rate, 1), 2.3)
        tbody = re.search(r'<tbody id="ranking-body">(.*?)</tbody>', self.html, re.S).group(1)
        rows = re.findall(r'<tr>(.*?)</tr>', tbody, re.S)
        self.assertEqual(len(rows), 10)
        for markup, code in zip(rows, stats["topTenCodes"]):
            row = stats["municipalities"][code]
            values = [unescape(re.sub('<[^>]+>', '', value)) for value in re.findall(r'<td>(.*?)</td>', markup)]
            self.assertEqual(values[1:], [str(row["count"]), f'{row["population"]:,}', f'{row["per100k"]:.1f}'])

    def test_fukuoka_city_units_cover_boundaries_and_reconcile(self):
        stats = self.data["statistics"]
        rows = [r for r in stats["municipalities"].values() if r["prefCode"] == "40"]
        self.assertEqual(len(rows), 60)
        self.assertEqual(sum(r["count"] for r in rows), stats["prefectures"]["40"]["count"])
        counts = Counter(s["muniCode"] for s in self.data["stores"])
        codes = set()
        for row in rows:
            ward_codes = row.get("aggregatedWardCodes", [row["code"]])
            self.assertFalse(codes.intersection(ward_codes))
            codes.update(ward_codes)
            self.assertEqual(sum(counts[c] for c in ward_codes), row["count"])
            self.assertAlmostEqual(row["per100k"], row["count"] / row["population"] * 100000, places=5)
        features = json.loads((ROOT / "geo-json/pref_40.geojson").read_text())["features"]
        self.assertEqual({f["properties"]["code"] for f in features} - codes, {"40000"})

    def test_featured_prefecture_ranks_use_all_47(self):
        prefs = self.data["statistics"]["prefectures"]
        for code, total, rate in [("13",1,1),("47",15,2),("11",5,29),("01",9,33),("14",4,17),("12",6,19)]:
            for key, expected in [("count",total),("per100k",rate)]:
                self.assertEqual(1 + sum(r[key] > prefs[code][key] for r in prefs.values()), expected)

    def test_chapters_and_local_links_resolve(self):
        self.assertEqual(self.article.steps, list(range(10)))
        self.assertEqual(len(self.article.ids), len(set(self.article.ids)))
        for link in self.article.links:
            if link.startswith('#'):
                self.assertIn(link[1:], self.article.ids)
            elif link and not link.startswith(('https://', 'http://')):
                self.assertTrue((STORY / link.split('#')[0]).exists(), link)
        self.assertIn('2025 Basic Resident Registration', self.html)
        self.assertNotIn('Reserve Roastery', self.html)


if __name__ == '__main__':
    unittest.main()
