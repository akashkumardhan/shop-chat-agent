#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-trycloudflare-url>" >&2
  exit 1
fi

NEW_URL="${1%/}"

if [[ ! "$NEW_URL" =~ ^https://[a-zA-Z0-9-]+\.trycloudflare\.com$ ]]; then
  echo "Error: '$NEW_URL' does not look like a https://*.trycloudflare.com URL" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

FILES=(
  ".env"
  "shopify.app.shop-chat-agent.toml"
  "extensions/chat-bubble/assets/chat.js"
  "extensions/chat-bubble/assets/modules/api.js"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: expected file not found: $f" >&2
    exit 1
  fi
done

FOUND=$(grep -hoE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "${FILES[@]}" | sort -u)
FOUND_COUNT=$(printf '%s\n' "$FOUND" | grep -c . || true)

if [[ "$FOUND_COUNT" -eq 0 ]]; then
  echo "Error: no https://*.trycloudflare.com URL found in tracked files" >&2
  exit 1
fi

if [[ "$FOUND_COUNT" -gt 1 ]]; then
  echo "Error: multiple distinct trycloudflare URLs found — refusing to guess:" >&2
  printf '  %s\n' "$FOUND" >&2
  exit 1
fi

OLD_URL="$FOUND"

if [[ "$OLD_URL" == "$NEW_URL" ]]; then
  echo "No change: $OLD_URL is already the current URL"
  exit 0
fi

for f in "${FILES[@]}"; do
  sed -i '' "s|${OLD_URL}|${NEW_URL}|g" "$f"
done

echo "Replaced ${OLD_URL} → ${NEW_URL} in ${#FILES[@]} files"
