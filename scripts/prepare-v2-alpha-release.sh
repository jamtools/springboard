#!/usr/bin/env bash
set -euo pipefail

TAG_NAME=""
EXECUTE=false
REMOTE="origin"

usage() {
  cat <<'USAGE'
Usage:
  npm run prepare:v2-alpha-release -- --tag v2.0.0-alpha-1 [--execute] [--remote origin]

Default mode is a dry run. It validates the release-prep path and reports the
git/tag operations it would run.

With --execute, this script may:
  1. regenerate package exports,
  2. commit package.json export updates if they were stale,
  3. push the branch,
  4. create an annotated tag,
  5. push the tag.

CI should not run this helper. The tag publish workflow verifies generated
exports and performs the npm publish from the already-tagged commit.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG_NAME="$2"
      shift 2
      ;;
    --execute)
      EXECUTE=true
      shift
      ;;
    --remote)
      REMOTE="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$TAG_NAME" ]]; then
  echo "Missing required --tag" >&2
  usage
  exit 1
fi

if [[ "$TAG_NAME" != v* ]]; then
  echo "Tag must start with v so the publish workflow receives the expected version: $TAG_NAME" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$TAG_NAME" >/dev/null; then
  echo "Tag already exists locally: $TAG_NAME" >&2
  exit 1
fi

if git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag already exists on $REMOTE: $TAG_NAME" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree must be clean before release prep starts." >&2
  git status --short
  exit 1
fi

echo "Installing with frozen lockfile..."
pnpm install --frozen-lockfile

echo "Building release package set..."
npx turbo run build --filter=springboard --filter=@springboard/vite-plugin --filter=create-springboard-app --filter=@jamtools/core

echo "Regenerating package exports locally..."
npm run generate:package-exports

if [[ -n "$(git status --porcelain -- packages/springboard/package.json packages/jamtools/core/package.json)" ]]; then
  echo "Generated package exports changed:"
  git diff -- packages/springboard/package.json packages/jamtools/core/package.json

  if [[ "$EXECUTE" == "true" ]]; then
    git add packages/springboard/package.json packages/jamtools/core/package.json
    git commit -m "Refresh generated package exports"
    git push "$REMOTE" HEAD
  else
    echo "Dry run: would commit and push refreshed generated package exports."
    echo "Re-run with --execute after review approval to allow commit/push/tag side effects."
    exit 1
  fi
fi

echo "Checking generated package exports are committed..."
npm run check:package-exports

echo "Running release validation..."
npx turbo run check-types --filter=springboard --filter=@springboard/vite-plugin --filter=@jamtools/core
npx turbo run test --filter=springboard --filter=@jamtools/core
npm run prepublishOnly --prefix packages/springboard
npm run prepublishOnly --prefix packages/springboard/create-springboard-app
npm run prepublishOnly --prefix packages/jamtools/core

if [[ "$EXECUTE" == "true" ]]; then
  git tag -a "$TAG_NAME" -m "Release $TAG_NAME"
  git push "$REMOTE" "$TAG_NAME"
else
  echo "Dry run: would create and push annotated tag $TAG_NAME."
fi
