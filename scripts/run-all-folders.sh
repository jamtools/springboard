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

bump_version "$root_dir/packages/springboard/data_storage"
bump_version "$root_dir/packages/springboard/core"
bump_version "$root_dir/packages/springboard/platforms/webapp"
bump_version "$root_dir/packages/springboard/platforms/node"
bump_version "$root_dir/packages/springboard/platforms/react-native"
bump_version "$root_dir/packages/springboard/platforms/partykit"
bump_version "$root_dir/packages/springboard/server"
bump_version "$root_dir/packages/springboard/external/mantine"
bump_version "$root_dir/packages/springboard/external/shoelace"
bump_version "$root_dir/packages/jamtools/core"
bump_version "$root_dir/packages/jamtools/features"
bump_version "$root_dir/packages/springboard/cli"
bump_version "$root_dir/packages/springboard/create-springboard-app"
bump_version "$root_dir/packages/springboard/plugins/svelte"

pnpm i

publish_package "$root_dir/packages/springboard/data_storage"

sleep 1

publish_package "$root_dir/packages/springboard/core"

sleep 1

publish_package "$root_dir/packages/springboard/platforms/webapp"

sleep 1

publish_package "$root_dir/packages/springboard/platforms/node"

sleep 1

publish_package "$root_dir/packages/springboard/platforms/react-native"

sleep 1

publish_package "$root_dir/packages/springboard/platforms/partykit"

sleep 1

publish_package "$root_dir/packages/springboard/server"

sleep 1

publish_package "$root_dir/packages/springboard/external/mantine"

sleep 1

publish_package "$root_dir/packages/springboard/external/shoelace"

sleep 1

publish_package "$root_dir/packages/jamtools/core"

sleep 1

publish_package "$root_dir/packages/jamtools/features"

sleep 1

publish_package "$root_dir/packages/springboard/cli"

sleep 1

publish_package "$root_dir/packages/springboard/create-springboard-app"

sleep 1

publish_package "$root_dir/packages/springboard/plugins/svelte"

# # npm i
