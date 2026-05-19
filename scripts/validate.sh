#!/usr/bin/env bash
# Thin wrapper around scripts/validate.mjs so CI / users can run either form.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "node is required (>=20.x). Install from https://nodejs.org." >&2
  exit 1
fi

# Lint the Postman collection as JSON if jq is available.
if command -v jq >/dev/null 2>&1; then
  jq empty < voicetel-api.postman_collection.json
fi

exec node scripts/validate.mjs "$@"
