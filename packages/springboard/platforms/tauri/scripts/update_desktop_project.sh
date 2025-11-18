#!/bin/bash

if command -v pnpm &> /dev/null; then
  PKG_MANAGER="pnpm"
else
  PKG_MANAGER="npm"
fi

# Load configuration
DESKTOP_CONFIG_FILE=${DESKTOP_CONFIG_FILE:-"../../node_modules/@springboardjs/platforms-tauri/desktop_config.json"}
CONFIG=$(cat "$DESKTOP_CONFIG_FILE")

# # Update package.json
package_json_changes=$(echo "$CONFIG" | jq -r '.config["package.json"]')
if [ -n "$package_json_changes" ]; then
  jq -s '.[0] * .[1]' package.json <(echo "$package_json_changes") > package.json.tmp && mv package.json.tmp package.json
fi


# Update tauri.conf.json
tauri_conf_changes=$(echo "$CONFIG" | jq -r '.config["tauri.conf.json"]')
if [ -n "$tauri_conf_changes" ]; then
  jq -s '.[0] * .[1]' src-tauri/tauri.conf.json <(echo "$tauri_conf_changes") > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
fi

npm_deps=$(echo "$CONFIG" | jq -r '.dependencies.npm | to_entries | map("\(.key)@\(.value)") | join(" ")')
if [ -n "$npm_deps" ]; then
  npm i $npm_deps
fi

# Install Tauri plugins with specified versions
tauri_plugins=$(echo "$CONFIG" | jq -r '.dependencies.tauri | to_entries[] | "\(.key)@\(.value)"')
for plugin in $tauri_plugins; do
  name="${plugin%@*}"
  version="${plugin#*@}"
  if [[ "$version" == "*" ]]; then
    npx tauri add "$name"
  else
    npx tauri add "$plugin"
  fi
done

apply_json_merge() {
  local file=$1
  local changes=$2

  # Check if the file and changes exist
  if [ ! -f "$file" ]; then
    echo "File $file not found."
    return 1
  fi

  # Apply the merge using jq
  jq -s '.[0] * .[1]' "$file" <(echo "$changes") > "$file.tmp" && mv "$file.tmp" "$file"
}

capabilities_json_changes=$(echo "$CONFIG" | jq -r '.config["src-tauri/capabilities/default.json"]')
if [ -n "$capabilities_json_changes" ]; then
#   jq -s '.[0] * .[1]' src-tauri/capabilities/default.json <(echo "$capabilities_json_changes") > src-tauri/capabilities/default.json.tmp && mv src-tauri/capabilities/default.json.tmp src-tauri/capabilities/default.json
  apply_json_merge "src-tauri/capabilities/default.json" "$capabilities_json_changes"
fi

pkg_changes=$(echo "$CONFIG" | jq -r '.files["pkg.json"]')
if [ -n "$pkg_changes" ]; then
    echo "$pkg_changes" > pkg.json
fi

# cd ../../ && $PKG_MANAGER i --frozen-lockfile=false && cd -


# # this doesn't work because there's no tomlq

# # # Update Cargo.toml
# # cargo_toml_changes=$(echo "$CONFIG" | jq -r '.config["Cargo.toml"]')
# # if [ -n "$cargo_toml_changes" ]; then
# #   tomlq ". |= . + $cargo_toml_changes" src-tauri/Cargo.toml > src-tauri/Cargo.toml.tmp && mv src-tauri/Cargo.toml.tmp src-tauri/Cargo.toml
# # fi
