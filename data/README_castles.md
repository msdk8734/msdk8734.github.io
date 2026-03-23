# Japanese 100 Fine Castles / Continued 100 Fine Castles Dataset

This repository contains a curated JSON dataset for mapping **Japan’s 100 Famous Castles** and **Continued 100 Famous Castles** (計200件) on a map.

The dataset is designed for practical use in web maps, apps, and data projects, and has been manually normalized and audited so that each record points to a meaningful **site-center coordinate** rather than an arbitrary nearby facility.

## What this dataset is

This JSON file is a structured dataset of 200 castle-related sites in Japan, covering:

- **日本100名城** (100 Famous Castles of Japan)
- **続日本100名城** (Continued 100 Famous Castles of Japan)

Each record includes core identification fields, Japanese and English names, readings, location data, and audit metadata describing how the coordinate was verified.

This is **not** just a raw list of place names and coordinates.  
It is an **audited geographic reference dataset** created to support reliable visualization and reuse.

---

## Why this dataset matters

Castle datasets found online often contain one or more of the following problems:

- coordinates pointing to a station, museum, parking lot, or stamp location instead of the actual site
- inconsistent English spellings
- missing Japanese readings
- duplicate IDs
- mixed naming conventions
- unclear provenance for coordinate corrections

This dataset was created to solve those problems.

The final version aims to provide:

- **consistent structure**
- **map-friendly coordinates**
- **corrected readings**
- **normalized English labels**
- **traceable verification metadata**
- **full coverage of all 200 sites**

For anyone building a map, visualization, website, or educational resource, this makes the data much more trustworthy and reusable than an unverified coordinate list.

---

## Core design principle: `site_center`

The most important design choice in this dataset is that the main coordinate is standardized as:

```json
"coordinate_type": "site_center"
```

### What `site_center` means

The main latitude/longitude is intended to represent the **historic site itself** in a way that is natural on a map.

It does **not** primarily represent:

- stamp placement location
- visitor center
- museum
- parking lot
- nearest station
- trailhead
- city office

Instead, it aims to represent the castle site as a historic/geographic entity.

### How `site_center` was interpreted by site type

- **Flatland / early modern castles**: representative point near the main enclosure, honmaru, or tenshudai area
- **Mountain castles**: representative point near the main bailey / main enclosure
- **Fortified residences / yakata / clan residences**: central area of the surviving historic site
- **Chashi / archaeological groups / ruins**: representative center of the principal remains

This makes the dataset much more suitable for cartographic use.

---

## Structure of the JSON

Each object follows a normalized schema similar to the following:

```json
{
  "id": 1,
  "list_type": "100",
  "number": 1,
  "name_ja": "根室半島チャシ跡群",
  "reading_ja": "ねむろはんとうちゃしあとぐん",
  "name_en": "Nemuro Peninsula Chashi Ruins",
  "prefecture": "北海道",
  "prefecture_en": "Hokkaido",
  "tower_status": "ruins",
  "is_national_treasure": false,
  "built_year": null,
  "lat": 43.39075,
  "lng": 145.66838,
  "coordinate_type": "site_center",
  "source_primary": "…",
  "source_secondary": "…",
  "verification_confidence": "high",
  "verification_note": "…"
}
```

### Field reference

#### Identification
- `id`  
  Internal unique ID. Duplicate IDs were removed during normalization.

- `list_type`  
  `"100"` or `"continued_100"`.

- `number`  
  Castle number within the official list.

#### Names
- `name_ja`  
  Main Japanese display name.

- `reading_ja`  
  Japanese reading in hiragana.

- `name_en`  
  Normalized English label.

#### Location
- `prefecture`  
  Japanese prefecture name.

- `prefecture_en`  
  English prefecture name.

- `lat`, `lng`  
  Main coordinate for mapping.

- `coordinate_type`  
  Meaning of the main coordinate. Final dataset uses `"site_center"`.

#### Castle metadata
- `tower_status`  
  General structural/tower condition status, normalized from the original source schema.  
  Typical values include:
  - `existing`
  - `reconstructed_concrete`
  - `reconstructed_wood`
  - `replica`
  - `ruins`

- `is_national_treasure`  
  Boolean flag for National Treasure status.

- `built_year`  
  Representative built year / founding year value where available.

#### Audit metadata
- `source_primary`  
  Main source used for verification.

- `source_secondary`  
  Supporting source used when needed.

- `verification_confidence`  
  Confidence label for the adopted coordinate.

- `verification_note`  
  Short explanation of how or why that coordinate was chosen.

---

## How this dataset was produced

This dataset began from an existing `castles.json` file that contained useful base coverage but also several issues.

### Problems in the original file
The original version included:
- some inaccurate coordinates
- some incorrect or awkward English labels
- some missing or inconsistent readings
- schema inconsistencies
- reused / duplicated IDs

### What was changed

The dataset was then revised through a multi-step audit process:

1. **Schema normalization**
   - converted key names into a clearer normalized structure
   - standardized naming conventions
   - added explicit `coordinate_type`

2. **Name cleanup**
   - corrected Japanese/English label inconsistencies
   - normalized selected Romanization issues
   - added `reading_ja`

3. **Coordinate audit**
   - reviewed all 200 records
   - corrected coordinates in batches
   - standardized the main coordinate as `site_center`

4. **Audit metadata**
   - added provenance and confidence fields
   - recorded why a coordinate was adopted

5. **Final review**
   - reconciled intermediate logs
   - rechecked medium-confidence cases
   - produced a final version with all 200 records brought to `high`

---

## Sources and verification policy

The dataset was not edited arbitrarily.  
Coordinates and naming were reviewed against public sources with a preference for sources that directly identify the site.

### Main source types used

- **Jcastle**  
  Used extensively because many castle pages include individual coordinate fields and English labels.

- **Municipal / official local government pages**
  - city pages
  - town cultural property pages
  - local historic site pages

- **Cultural heritage databases**
  - culture-related public databases
  - heritage description pages
  - official or semi-official cultural property listings

- **Geographic reference sources**
  - public geospatial reference pages
  - site maps
  - map-linked official spot pages

- **Supplementary sources**
  - tourism association pages
  - limited use of broad public references only when needed to support identification

### General source priority

The audit process generally preferred the following order:

1. official municipal / site-management information
2. public cultural property / heritage databases
3. Jcastle coordinate pages
4. public geospatial reference sources
5. supporting map-linked references

### Confidence logic

A record was considered **high** when the adopted coordinate could be tied to a reliable source or clearly supported by aligned sources identifying the site itself.

A record would be considered **medium** if the site could be identified but the point was still more interpretive.  
The final release rechecked those cases and raised the remaining records so that the final audited version is:

- **high: 200**
- **medium: 0**

---

## Important naming notes

### English names
English labels were normalized for practical use, but castle names can vary across English-language sources.

Examples of normalization choices include:
- using `Castle` for conventional castles
- using `Ruins` where that better reflects the historic site
- using `Yakata` / `Fortified Residence` where appropriate
- correcting obvious misspellings and inconsistent Romanization

This means the dataset prioritizes **clarity and consistency for mapping**, not necessarily one rigid academic naming convention.

### Japanese readings
`reading_ja` was added to improve:
- search
- sorting
- furigana-style display
- future Romanization workflows

---

## Reliability and limitations

This dataset is highly curated, but a few points should be kept in mind.

### Strengths
- full 200-site coverage
- normalized schema
- map-oriented coordinate policy
- manually reviewed corrections
- provenance fields included
- final confidence standardized to high

### Limitations
- `site_center` is a representative mapping point, not a legal boundary centroid
- some castles have very large or dispersed extents, so a single point is necessarily a simplification
- English naming in castle studies can vary across sources
- this dataset is optimized for **mapping and practical reuse**, not for strict archaeological boundary analysis

So this file should be understood as a **high-quality cartographic reference dataset**, not a cadastral or excavation-boundary dataset.

---

## Recommended use cases

This dataset is especially suitable for:

- interactive maps
- GitHub Pages visualizations
- D3 / Leaflet / Mapbox projects
- castle tourism apps
- educational projects
- static or searchable castle directories
- location-based storytelling projects

It is also a strong base for future expansion, such as adding:

- `stamp_location`
- `visitor_center`
- `main_enclosure`
- `region`
- `official_site_url`
- `wikipedia_url`
- `castle_type`

---

## Recommended file to publish

The final recommended file is the audited final version:

- `castles_verified_all_audited_v3.json`

If you want to publish it in the repository under the simpler canonical name:

- `castles.json`

that is perfectly fine.

---

## Suggested citation / attribution note

You may wish to describe the file in the repository like this:

> Audited JSON dataset of Japan’s 100 Famous Castles and Continued 100 Famous Castles (200 total), with normalized names, Japanese readings, and site-center map coordinates verified from public reference sources.

---

## Maintenance guidance

If future edits are made, it is recommended to:

- keep `coordinate_type` explicit
- preserve `source_primary`, `source_secondary`, and `verification_note`
- avoid replacing coordinates without recording the source
- keep English naming conventions internally consistent
- treat map display coordinates separately from stamp or facility coordinates

In other words, this dataset should continue to be maintained as an **audited reference file**, not just a casual place list.

---

## Summary

This project produced a carefully revised and auditable castle dataset by:

- fixing inaccurate coordinates
- adding Japanese readings
- normalizing English names
- cleaning the schema
- removing ID duplication
- verifying all 200 entries
- standardizing all main coordinates as `site_center`

The result is a much more dependable public dataset for mapping and reuse.

