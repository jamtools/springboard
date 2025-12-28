#!/bin/bash

if [ -n "$1" ]; then
  version="$1"
  full_version="${version#v}"
else
  full_version="0.15.0-rc9"
fi

PUBLISH_MODE="verdaccio"

shift # Skip the first argument (version)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      PUBLISH_MODE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate mode
if [[ "$PUBLISH_MODE" != "npm" && "$PUBLISH_MODE" != "verdaccio" ]]; then
  echo "Error: --mode must be either 'npm' or 'verdaccio'"
  exit 1
fi

set -e
root_dir=$(pwd)

bump_version() {
  local target_dir=$1
  local version=$full_version

  cd "$target_dir" || exit 1
  echo "Bumping version in $target_dir"
  jq --arg version "$version" '.version = $version' "$target_dir/package.json" > "$target_dir/tmp.json" && mv "$target_dir/tmp.json" "$target_dir/package.json"
}

bump_peer_dep() {
  local target_dir=$1
  local dependency_name=$2
  local version="$full_version"
  echo "Updating peer dependency $package_name in $target_dir to $version"
  jq --arg dep "$dependency_name" --arg version "$version" '.peerDependencies[$dep] = $version' "$target_dir/package.json" > "$target_dir/tmp.json" && mv "$target_dir/tmp.json" "$target_dir/package.json"
}

publish_package() {
  local target_dir=$1
  cd "$target_dir" || exit 1
  echo "Publishing package in $target_dir"

  local environment=""

  # Set registry based on mode
  if [ "$PUBLISH_MODE" = "npm" ]; then
    environment="npm"
  else
    export NPM_CONFIG_REGISTRY="http://localhost:4873"
    environment="local Verdaccio"
  fi

  # Determine tag based on version format
  local tag="latest"
  if [[ "$full_version" == *"-"* ]]; then
    if [[ "$full_version" == *"-rc"* ]]; then
      tag="rc"
    elif [[ "$full_version" == *"-dev"* ]]; then
      tag="dev"
    else
      tag="dev"
    fi
    echo "Publishing pre-release version to $environment with tag: $tag"
  else
    echo "Publishing production version to $environment"
  fi

  # Execute the publish command
  pnpm publish --access public --tag "$tag" --no-git-checks
}

# Core packages
bump_version "$root_dir/packages/springboard"
bump_version "$root_dir/packages/jamtools/core"
bump_version "$root_dir/packages/jamtools/features"

# CLI and tooling
bump_version "$root_dir/packages/springboard/cli"
bump_version "$root_dir/packages/springboard/create-springboard-app"
bump_version "$root_dir/packages/springboard/vite-plugin"

# External integrations
bump_version "$root_dir/packages/springboard/external/mantine"
bump_version "$root_dir/packages/springboard/external/shoelace"

# Plugins
bump_version "$root_dir/packages/springboard/plugins/svelte"

pnpm i

# Publish core packages first (dependencies)
publish_package "$root_dir/packages/springboard"

sleep 1

publish_package "$root_dir/packages/jamtools/core"

sleep 1

publish_package "$root_dir/packages/jamtools/features"

sleep 1

# Publish vite plugin (may be needed by CLI)
publish_package "$root_dir/packages/springboard/vite-plugin"

sleep 1

# Publish external integrations
publish_package "$root_dir/packages/springboard/external/mantine"

sleep 1

publish_package "$root_dir/packages/springboard/external/shoelace"

sleep 1

# Publish plugins
publish_package "$root_dir/packages/springboard/plugins/svelte"

sleep 1

# Publish CLI and tooling last (likely depend on core packages)
publish_package "$root_dir/packages/springboard/cli"

sleep 1

publish_package "$root_dir/packages/springboard/create-springboard-app"
