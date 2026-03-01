#!/usr/bin/env bash
#
# Fetches IMAX venue data from the IMAX Fandom Wiki and outputs imax-venues.json
# Requires: curl, python3 (stdlib only, no pip packages)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT="$ROOT_DIR/imax-venues.json"
API_URL="https://imax.fandom.com/api.php?action=parse&page=List_of_IMAX_venues&prop=wikitext&format=json"

echo "Fetching IMAX venue data from Fandom Wiki..."
WIKITEXT=$(curl -s "$API_URL" | python3 -c "import sys,json; print(json.load(sys.stdin)['parse']['wikitext']['*'])")

echo "Parsing wikitext tables..."
python3 -c "
import re, json, sys

wikitext = sys.stdin.read()

# Split into sections by == headings ==
sections = re.split(r'^(==\s*.+?\s*==)\s*$', wikitext, flags=re.MULTILINE)

venues = []

def clean(text):
    \"\"\"Strip wikitext markup from a cell value.\"\"\"
    text = text.strip()
    # Remove [[ ]] links, keeping display text
    text = re.sub(r'\[\[([^]|]*\|)?([^]]*)\]\]', r'\2', text)
    # Remove <sup>...</sup>, <br>, <ref>...</ref>, etc.
    text = re.sub(r'<ref[^>]*>.*?</ref>', '', text, flags=re.DOTALL)
    text = re.sub(r'<ref[^>]*/>', '', text)
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'</?su[bp]>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    # Remove trailing table close markup
    text = re.sub(r'\|\}$', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_dimensions(raw):
    \"\"\"Extract metric dimensions (meters) from screen dimensions field.\"\"\"
    result = {}
    raw = clean(raw)
    if not raw:
        return result

    # Try to find meter dimensions: NNm × NNm or NN.NNm×NN.NNm or NN.NNmxNN.NNm
    m = re.search(r'([\d.]+)\s*m?\s*[×xX]\s*([\d.]+)\s*m', raw)
    if m:
        result['width_m'] = float(m.group(1))
        result['height_m'] = float(m.group(2))

    # For dome theatres, might just be a diameter like 27.00m
    if not m:
        dm = re.search(r'([\d.]+)\s*m(?:\s|$)', raw)
        if dm:
            result['diameter_m'] = float(dm.group(1))

    result['raw'] = raw
    return result

def extract_rowspan_cell(cell):
    \"\"\"Extract rowspan count and clean value from a cell that may have rowspan markup.\"\"\"
    rowspan_m = re.search(r'rowspan\s*=\s*\"?(\d+)\"?', cell)
    count = int(rowspan_m.group(1)) if rowspan_m else 1
    value = re.sub(r'rowspan\s*=\s*\"?\d+\"?\s*\|', '', cell)
    return count, clean(value)

def split_row_cells(row):
    \"\"\"Split a wikitext table row into cells, preserving empty cells.\"\"\"
    lines = row.strip().split('\n')
    cells = []
    current_cell = None
    for line in lines:
        if line.startswith('|') and not line.startswith('|}'):
            if current_cell is not None:
                cells.append(current_cell)
            current_cell = line[1:]  # strip leading |
        elif line.startswith('!'):
            continue  # skip header lines
        elif current_cell is not None:
            current_cell += '\n' + line  # multi-line cell
    if current_cell is not None:
        cells.append(current_cell)
    return cells

def parse_table(table_text, region, has_province_col):
    \"\"\"Parse a single wikitext table into venue dicts.\"\"\"
    rows = re.split(r'^\|-', table_text, flags=re.MULTILINE)

    current_country = ''
    current_province = ''
    current_city = ''
    country_remaining = 0
    province_remaining = 0
    city_remaining = 0

    for row in rows[1:]:  # skip header row
        cells = split_row_cells(row)

        if not cells:
            continue

        idx = 0

        # Handle country column (may have rowspan)
        if country_remaining <= 0:
            if idx >= len(cells):
                continue
            country_remaining, current_country = extract_rowspan_cell(cells[idx])
            idx += 1

        # Handle province/state column (Asia and Americas, may have rowspan)
        if has_province_col:
            if province_remaining <= 0:
                if idx >= len(cells):
                    country_remaining -= 1
                    continue
                province_remaining, current_province = extract_rowspan_cell(cells[idx])
                idx += 1

        # Handle city column (may have rowspan, e.g. Vietnam's Ba Đình District)
        if city_remaining <= 0:
            if idx >= len(cells):
                country_remaining -= 1
                if has_province_col:
                    province_remaining -= 1
                continue
            city_remaining, current_city = extract_rowspan_cell(cells[idx])
            idx += 1

        remaining = cells[idx:]

        # We expect: name, screen_ar, digital_proj, max_ar_digital, film_proj, dimensions, commercial
        if len(remaining) < 5:
            country_remaining -= 1
            if has_province_col:
                province_remaining -= 1
            city_remaining -= 1
            continue

        city = current_city
        _, name = extract_rowspan_cell(remaining[0])
        screen_ar = clean(remaining[1])
        digital_proj = clean(remaining[2])
        max_ar_digital = clean(remaining[3])
        film_proj = clean(remaining[4]) if len(remaining) > 4 else ''
        dimensions_raw = remaining[5] if len(remaining) > 5 else ''
        commercial = clean(remaining[6]) if len(remaining) > 6 else ''

        venue = {
            'region': region,
            'country': current_country,
            'city': city,
            'name': name,
            'screen_aspect_ratio': screen_ar,
            'digital_projector': digital_proj,
            'max_digital_aspect_ratio': max_ar_digital,
            'film_projector': film_proj,
            'screen_dimensions': parse_dimensions(dimensions_raw),
            'commercial_films': commercial,
        }
        if has_province_col:
            venue['state'] = current_province

        venues.append(venue)
        country_remaining -= 1
        city_remaining -= 1
        if has_province_col:
            province_remaining -= 1

# Process each section
i = 0
while i < len(sections):
    section = sections[i]
    heading_m = re.match(r'^==\s*(.+?)\s*==$', section.strip())
    if heading_m and i + 1 < len(sections):
        region = heading_m.group(1)
        body = sections[i + 1]
        # Find the table in this section
        table_m = re.search(r'\{\|.*?\|\}', body, re.DOTALL)
        if table_m:
            table_text = table_m.group()
            # Asia and Americas have a Province/State column
            has_province = (region in ('Americas', 'Asia'))
            parse_table(table_text, region, has_province)
        i += 2
    else:
        i += 1

def has_premium_projector(v):
    dp = v['digital_projector'].lower()
    fp = v['film_projector']
    return bool(fp) or 'gt laser' in dp or 'laser xt' in dp or 'cola' in dp or 'dome' in dp

def looks_like_venue(v):
    name = v['name']
    # Filter out rows where column alignment drifted (name is an aspect ratio, etc.)
    if re.match(r'^[\d.:]+$', name):
        return False
    return True

before = len(venues)
venues = [v for v in venues if has_premium_projector(v) and looks_like_venue(v)]
skipped = before - len(venues)
if skipped:
    print(f'Filtered out {skipped} malformed or non-premium venues', file=sys.stderr)

output = {
    'source': 'https://imax.fandom.com/wiki/List_of_IMAX_venues',
    'fetched_at': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
    'venue_count': len(venues),
    'venues': venues,
}

print(json.dumps(output, indent=2, ensure_ascii=False))
" <<< "$WIKITEXT" > "$OUTPUT"

COUNT=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['venue_count'])")
echo "Wrote $COUNT venues to $OUTPUT"

# Enrich with Google Places data
DETAILS_FILE="$ROOT_DIR/theatre-details.json"
LOOKUP_SCRIPT="$SCRIPT_DIR/lookup-theatre.sh"

if [ ! -x "$LOOKUP_SCRIPT" ]; then
  echo "Warning: lookup-theatre.sh not found or not executable, skipping enrichment." >&2
  exit 0
fi

echo "Enriching venues with Google Places data..."

python3 -c "
import json, subprocess, sys, time

output_file = sys.argv[1]
details_file = sys.argv[2]
lookup_script = sys.argv[3]

data = json.load(open(output_file))
venues = data['venues']

# Load existing cache
try:
    cache = json.load(open(details_file))
except (FileNotFoundError, json.JSONDecodeError):
    cache = {}

lookups_done = 0
lookups_cached = 0
lookups_failed = 0

for i, venue in enumerate(venues):
    name = venue['name']
    city = venue.get('city', '')

    # Check cache
    if name in cache:
        detail = cache[name]
        lookups_cached += 1
    else:
        # Call lookup script (which now caches null entries for misses too)
        try:
            result = subprocess.run(
                [lookup_script, name, city],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0 and result.stdout.strip():
                detail = json.loads(result.stdout.strip())
                lookups_done += 1
                # Rate limit: ~5 req/sec to be safe
                time.sleep(0.2)
            else:
                detail = None
                lookups_failed += 1
                print(f'  [{i+1}/{len(venues)}] MISS: {name}', file=sys.stderr)
        except Exception as e:
            detail = None
            lookups_failed += 1
            print(f'  [{i+1}/{len(venues)}] ERROR: {name}: {e}', file=sys.stderr)

    # Only enrich if we have a detail with non-null values
    if detail and detail.get('address'):
        venue['address'] = detail.get('address', '')
        venue['website'] = detail.get('website', '')
        venue['phone'] = detail.get('phone', '')
        venue['google_maps_url'] = detail.get('google_maps_url', '')
        venue['latitude'] = detail.get('latitude')
        venue['longitude'] = detail.get('longitude')
        venue['google_places_id'] = detail.get('google_places_id', '')

    # Progress
    total = lookups_done + lookups_cached
    if total % 50 == 0 and total > 0:
        print(f'  [{total}/{len(venues)}] processed ({lookups_done} new, {lookups_cached} cached)', file=sys.stderr)

data['venue_count'] = len(venues)
with open(output_file, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'Done! {lookups_done} new lookups, {lookups_cached} cached, {lookups_failed} failed.', file=sys.stderr)
" "$OUTPUT" "$DETAILS_FILE" "$LOOKUP_SCRIPT"

echo "Enriched output written to $OUTPUT"

# Enrich with IMAX.com theatre URLs
IMAX_URLS_FILE="$ROOT_DIR/imax-urls.json"
IMAX_LOOKUP_SCRIPT="$SCRIPT_DIR/lookup-imax-url.sh"

if [ ! -x "$IMAX_LOOKUP_SCRIPT" ]; then
  echo "Warning: lookup-imax-url.sh not found or not executable, skipping IMAX URL enrichment." >&2
  exit 0
fi

echo "Enriching venues with IMAX.com theatre URLs..."

python3 -c "
import json, subprocess, sys, time

output_file = sys.argv[1]
urls_file = sys.argv[2]
lookup_script = sys.argv[3]

data = json.load(open(output_file))
venues = data['venues']

# Load existing cache
try:
    cache = json.load(open(urls_file))
except (FileNotFoundError, json.JSONDecodeError):
    cache = {}

lookups_done = 0
lookups_cached = 0
lookups_failed = 0

for i, venue in enumerate(venues):
    name = venue['name']
    city = venue.get('city', '')

    # Check cache
    if name in cache:
        result = cache[name]
        lookups_cached += 1
    else:
        # Call lookup script
        try:
            proc = subprocess.run(
                [lookup_script, name, city],
                capture_output=True, text=True, timeout=30
            )
            if proc.returncode == 0 and proc.stdout.strip():
                result = json.loads(proc.stdout.strip())
                lookups_done += 1
                # Rate limit: respect Google CSE quota
                time.sleep(0.2)
            else:
                result = None
                lookups_failed += 1
                print(f'  [{i+1}/{len(venues)}] MISS: {name}', file=sys.stderr)
        except Exception as e:
            result = None
            lookups_failed += 1
            print(f'  [{i+1}/{len(venues)}] ERROR: {name}: {e}', file=sys.stderr)

    # Enrich venue with IMAX URL if found
    if result and result.get('imax_url'):
        venue['imax_url'] = result['imax_url']

    # Progress
    total = lookups_done + lookups_cached
    if total % 50 == 0 and total > 0:
        print(f'  [{total}/{len(venues)}] processed ({lookups_done} new, {lookups_cached} cached)', file=sys.stderr)

data['venue_count'] = len(venues)
with open(output_file, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'IMAX URLs: {lookups_done} new lookups, {lookups_cached} cached, {lookups_failed} failed.', file=sys.stderr)
" "$OUTPUT" "$IMAX_URLS_FILE" "$IMAX_LOOKUP_SCRIPT"

echo "IMAX URL enrichment complete."
