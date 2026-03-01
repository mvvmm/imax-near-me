#!/usr/bin/env bash
#
# Looks up a venue's IMAX.com theatre page URL via DuckDuckGo search
# and caches results in imax-urls.json
#
# Usage:
#   ./lookup-imax-url.sh "AMC Northpark 15" "Dallas"
#   ./lookup-imax-url.sh "Kinepolis Brussels" "Brussels"
#
# Requires: python3 (stdlib only)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE_FILE="$ROOT_DIR/imax-urls.json"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <venue-name> [city]" >&2
  exit 1
fi

VENUE_NAME="$1"
CITY="${2:-}"

# Initialize cache file if it doesn't exist
if [ ! -f "$CACHE_FILE" ]; then
  echo '{}' > "$CACHE_FILE"
fi

# Check cache first — includes null entries for known misses
CACHED=$(python3 -c "
import json, sys
cache = json.load(open('$CACHE_FILE'))
key = sys.argv[1]
if key in cache:
    print(json.dumps(cache[key]))
else:
    print('MISS')
" "$VENUE_NAME")

if [ "$CACHED" != "MISS" ]; then
  echo "Cache hit for: $VENUE_NAME" >&2
  echo "$CACHED"
  exit 0
fi

# Build search query
QUERY="$VENUE_NAME"
if [ -n "$CITY" ]; then
  QUERY="$VENUE_NAME $CITY"
fi

echo "Looking up IMAX URL: $QUERY" >&2

# Search DuckDuckGo HTML endpoint and extract imax.com/theatre URLs
python3 - "$VENUE_NAME" "$QUERY" "$CACHE_FILE" <<'PYEOF'
import json, sys, re, urllib.request, urllib.parse

venue_name = sys.argv[1]
query = sys.argv[2]
cache_file = sys.argv[3]

def search_ddg(q):
    search_url = 'https://html.duckduckgo.com/html/?' + urllib.parse.urlencode({'q': q})
    req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0'})
    resp = urllib.request.urlopen(req, timeout=15).read().decode()
    hrefs = re.findall(r'uddg=([^&]+)', resp)
    return [urllib.parse.unquote(h) for h in hrefs]

def clean_url(u):
    return re.split(r'[&?]', u)[0]

def find_imax_theatre_url(urls):
    for u in urls:
        if re.match(r'https?://www\.imax\.com/theatre/.+', u) and '/finder' not in u:
            return clean_url(u)
    return None

def find_imax_domain_url(urls):
    for u in urls:
        if 'imax.com' in u:
            return clean_url(u)
        break
    return None

imax_url = None
try:
    urls = search_ddg(query + ' IMAX imax.com')
    imax_url = find_imax_theatre_url(urls)

    if not imax_url:
        print(f'Trying fallback search for: {venue_name}', file=sys.stderr)
        urls = search_ddg('imax ' + venue_name)
        imax_url = find_imax_domain_url(urls)
except Exception as e:
    print(f'Search error: {e}', file=sys.stderr)

result = {'imax_url': imax_url}

cache = json.load(open(cache_file))
cache[venue_name] = result
with open(cache_file, 'w') as f:
    json.dump(cache, f, indent=2, ensure_ascii=False)

if imax_url:
    print(f'Found: {imax_url}', file=sys.stderr)
else:
    print(f'No IMAX.com page found for: {venue_name}', file=sys.stderr)

print(json.dumps(result))
PYEOF
