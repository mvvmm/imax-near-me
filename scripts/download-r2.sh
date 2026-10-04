#!/usr/bin/env bash
set -euo pipefail

OBJECT_PATH="$1"
DESTINATION="$2"
BUCKET="${OBJECT_PATH%%/*}"
OBJECT_KEY="${OBJECT_PATH#*/}"
TEMP=$(mktemp "${DESTINATION}.XXXXXX")
trap 'rm -f "$TEMP"' EXIT
cf r2 objects get "$OBJECT_KEY" --bucket-name "$BUCKET" > "$TEMP"
python3 -c 'import json, sys; json.load(open(sys.argv[1]))' "$TEMP"
mv "$TEMP" "$DESTINATION"
