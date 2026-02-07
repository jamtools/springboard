#!/bin/bash

set -euo pipefail

out="src/example/index-as-string.ts"
tmp="$(mktemp "${out}.tmp.XXXXXX")"

{
  echo 'export default `'
  cat example/index.tsx
  echo '`;'
} > "$tmp"

mv "$tmp" "$out"
