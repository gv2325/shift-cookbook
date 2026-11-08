# SHIFT hub data extraction

Rebuilds `web/src/data/cities.json` from the SHIFT Transport Analytics Hub (shift-transport.org).

The hub's dashboard page currently fails server-side, but its Next.js JavaScript bundle embeds the city data as `JSON.parse('…')` literals. These scripts pull those out and clean them.

```bash
mkdir -p work/js work/data
# 1. Download the hub's JS chunks (the data lives in the 43-*.js chunk)
curl -sS https://www.shift-transport.org/ -o work/home.html
grep -oE '/_next/static/chunks/[^"]+\.js' work/home.html | sort -u | \
  while read f; do curl -sS "https://www.shift-transport.org$f" -o "work/js/$(basename "$f")"; done
# 2. Extract every embedded JSON blob
node extract_bundle_json.js work/data work/js/43-*.js
# 3. Clean, add coordinates and provenance, flag internal conflicts
python3 build_dataset.py work/data
```

`build_dataset.py` writes `shift_cities.json` (all 30 cities) and `mock_cities.json`. The web app's `cities.json` is the Indian subset with zeros turned into `null`.

Caveats:
- The input file names (`blob0_43-252.json` etc.) depend on the chunk hash. Update them in `build_dataset.py` when the hub redeploys.
- The two embedded tables disagree for 29 of 30 cities. Both values are kept as `conflicts`, and the dashboard table is used as the headline value.
- No licence is stated on the hub. Treat the data as "to be confirmed" before republishing it widely.
