#!/usr/bin/env bash
###############################################################################
# Test Automation Script for esbuild-legacy-test
#
# This script automates the complete Verdaccio workflow for testing the
# consolidated Springboard package with legacy esbuild-based builds.
#
# Test App Structure:
#   The test app is a platform-agnostic tic-tac-toe game built with Springboard.
#   Both browser and node platforms are built from the same source file:
#   src/tic_tac_toe.tsx (no platform-specific src/browser or src/node folders).
#   The legacy CLI handles platform-specific bundling internally.
#
# Workflow:
# 1. Start Verdaccio local npm registry
# 2. Build Springboard package for publishing
# 3. Publish Springboard to Verdaccio
# 4. Install dependencies in test app from Verdaccio
# 5. Run esbuild build (pnpm build) - builds browser + node from same source
# 6. Verify output files exist
# 7. Cleanup Verdaccio process
# 8. Report success/failure
#
# Usage:
#   ./scripts/test-legacy-esbuild.sh
#
# Requirements:
#   - Run from test-apps/esbuild-legacy-test directory
#   - pnpm installed
#   - Node.js >= 20.0.0
###############################################################################

set -e          # Exit on error
set -u          # Exit on undefined variable
set -o pipefail # Catch errors in pipelines

###############################################################################
# Configuration
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${TEST_APP_DIR}/../.." && pwd)"
SPRINGBOARD_PKG="${REPO_ROOT}/packages/springboard"
BUILD_SCRIPT="${REPO_ROOT}/scripts/build-for-publish.ts"

VERDACCIO_PORT=4873
VERDACCIO_URL="http://localhost:${VERDACCIO_PORT}"
VERDACCIO_PID=""
VERDACCIO_TIMEOUT=30 # seconds

# Output files to verify
# Note: The legacy CLI outputs to dist/{platform}/dist/{file}
# Both browser and node builds are generated from the same platform-agnostic
# source file (src/tic_tac_toe.tsx) - the legacy CLI handles platform-specific
# bundling internally via @platform directives.
EXPECTED_OUTPUTS=(
  "dist/browser/dist/index.js"
  "dist/browser/dist/index.html"
  "dist/node/dist/index.js"
)

# Colors for output (only if terminal supports it)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  MAGENTA='\033[0;35m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  MAGENTA=''
  CYAN=''
  BOLD=''
  RESET=''
fi

###############################################################################
# Utility Functions
###############################################################################

# Print functions with consistent formatting
print_header() {
  echo ""
  echo -e "${BOLD}${BLUE}================================================================${RESET}"
  echo -e "${BOLD}${BLUE}  $1${RESET}"
  echo -e "${BOLD}${BLUE}================================================================${RESET}"
  echo ""
}

print_step() {
  echo -e "${CYAN}>>> $1${RESET}"
}

print_success() {
  echo -e "${GREEN}SUCCESS $1${RESET}"
}

print_error() {
  echo -e "${RED}ERROR $1${RESET}"
}

print_warning() {
  echo -e "${YELLOW}WARNING $1${RESET}"
}

print_info() {
  echo -e "${MAGENTA}INFO $1${RESET}"
}

###############################################################################
# Cleanup Function
###############################################################################

cleanup() {
  local exit_code=$?

  echo ""
  print_header "Cleanup"

  # Stop Verdaccio if it's running
  if [[ -n "${VERDACCIO_PID}" ]] && kill -0 "${VERDACCIO_PID}" 2>/dev/null; then
    print_step "Stopping Verdaccio (PID: ${VERDACCIO_PID})..."
    kill "${VERDACCIO_PID}" 2>/dev/null || true

    # Wait for process to stop (max 5 seconds)
    local count=0
    while kill -0 "${VERDACCIO_PID}" 2>/dev/null && [[ $count -lt 10 ]]; do
      sleep 0.5
      count=$((count + 1))
    done

    # Force kill if still running
    if kill -0 "${VERDACCIO_PID}" 2>/dev/null; then
      print_warning "Force killing Verdaccio..."
      kill -9 "${VERDACCIO_PID}" 2>/dev/null || true
    fi

    print_success "Verdaccio stopped"
  fi

  # Kill any Verdaccio processes on the port (belt and suspenders)
  if lsof -ti:"${VERDACCIO_PORT}" >/dev/null 2>&1; then
    print_step "Cleaning up any remaining processes on port ${VERDACCIO_PORT}..."
    lsof -ti:"${VERDACCIO_PORT}" | xargs kill -9 2>/dev/null || true
  fi

  # Restore original package.json if backup exists
  if [[ -f "${SPRINGBOARD_PKG}/package.json.backup" ]]; then
    print_step "Restoring original package.json..."
    mv "${SPRINGBOARD_PKG}/package.json.backup" "${SPRINGBOARD_PKG}/package.json"
    print_success "Original package.json restored"
  fi

  echo ""
  if [[ $exit_code -eq 0 ]]; then
    print_header "Test Completed Successfully"
    echo -e "${GREEN}${BOLD}All tests passed!${RESET}"
  else
    print_header "Test Failed"
    echo -e "${RED}${BOLD}Tests failed with exit code: $exit_code${RESET}"
  fi
  echo ""

  exit $exit_code
}

# Register cleanup function to run on exit
trap cleanup EXIT INT TERM

###############################################################################
# Validation Functions
###############################################################################

validate_environment() {
  print_header "Validating Environment"

  # Check we're in the right directory
  print_step "Checking current directory..."
  if [[ ! -f "${TEST_APP_DIR}/package.json" ]]; then
    print_error "Not in test app directory. Please run from test-apps/esbuild-legacy-test/"
    exit 1
  fi
  print_success "Current directory validated"

  # Check Node.js version
  print_step "Checking Node.js version..."
  if ! command -v node >/dev/null 2>&1; then
    print_error "Node.js not found"
    exit 1
  fi
  local node_version
  node_version=$(node --version)
  print_success "Node.js ${node_version} found"

  # Check pnpm
  print_step "Checking pnpm..."
  if ! command -v pnpm >/dev/null 2>&1; then
    print_error "pnpm not found. Please install pnpm: npm install -g pnpm"
    exit 1
  fi
  local pnpm_version
  pnpm_version=$(pnpm --version)
  print_success "pnpm ${pnpm_version} found"

  # Check npx (for Verdaccio)
  print_step "Checking npx..."
  if ! command -v npx >/dev/null 2>&1; then
    print_error "npx not found"
    exit 1
  fi
  print_success "npx found"

  # Check repo structure
  print_step "Checking repository structure..."
  if [[ ! -d "${REPO_ROOT}/packages/springboard" ]]; then
    print_error "Springboard package not found at ${REPO_ROOT}/packages/springboard"
    exit 1
  fi
  if [[ ! -f "${BUILD_SCRIPT}" ]]; then
    print_error "Build script not found at ${BUILD_SCRIPT}"
    exit 1
  fi
  print_success "Repository structure validated"

  print_info "Test app dir: ${TEST_APP_DIR}"
  print_info "Repo root: ${REPO_ROOT}"
  print_info "Springboard package: ${SPRINGBOARD_PKG}"
}

###############################################################################
# Verdaccio Functions
###############################################################################

start_verdaccio() {
  print_header "Starting Verdaccio"

  # Check if Verdaccio is already running on the port
  if lsof -ti:"${VERDACCIO_PORT}" >/dev/null 2>&1; then
    print_warning "Port ${VERDACCIO_PORT} is already in use"
    print_step "Attempting to kill existing process..."
    lsof -ti:"${VERDACCIO_PORT}" | xargs kill -9 2>/dev/null || true
    sleep 2

    if lsof -ti:"${VERDACCIO_PORT}" >/dev/null 2>&1; then
      print_error "Failed to free port ${VERDACCIO_PORT}"
      exit 1
    fi
  fi

  # Clean up any existing Verdaccio storage to start fresh
  print_step "Cleaning Verdaccio storage..."
  rm -rf "/tmp/verdaccio-storage-${VERDACCIO_PORT}"
  rm -f "/tmp/verdaccio-htpasswd-${VERDACCIO_PORT}"
  rm -f "/tmp/verdaccio-config-${VERDACCIO_PORT}.yaml"
  print_success "Storage cleaned"

  print_step "Starting Verdaccio on port ${VERDACCIO_PORT}..."

  # Create a custom Verdaccio config that allows anonymous publishing
  local verdaccio_config="/tmp/verdaccio-config-${VERDACCIO_PORT}.yaml"
  cat > "${verdaccio_config}" <<EOF
storage: /tmp/verdaccio-storage-${VERDACCIO_PORT}
auth:
  htpasswd:
    file: /tmp/verdaccio-htpasswd-${VERDACCIO_PORT}
    max_users: -1
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '**':
    access: \$all
    publish: \$all
    proxy: npmjs
logs: { type: stdout, format: pretty, level: warn }
EOF

  # Start Verdaccio in background and capture PID
  npx verdaccio --config "${verdaccio_config}" --listen "${VERDACCIO_PORT}" > /tmp/verdaccio-${VERDACCIO_PORT}.log 2>&1 &
  VERDACCIO_PID=$!

  print_info "Verdaccio PID: ${VERDACCIO_PID}"
  print_info "Log file: /tmp/verdaccio-${VERDACCIO_PORT}.log"

  # Wait for Verdaccio to be ready
  print_step "Waiting for Verdaccio to be ready (timeout: ${VERDACCIO_TIMEOUT}s)..."
  local count=0
  local ready=false

  while [[ $count -lt $((VERDACCIO_TIMEOUT * 2)) ]]; do
    if curl -s "${VERDACCIO_URL}" >/dev/null 2>&1; then
      ready=true
      break
    fi

    # Check if process is still running
    if ! kill -0 "${VERDACCIO_PID}" 2>/dev/null; then
      print_error "Verdaccio process died unexpectedly"
      print_info "Last 20 lines of log:"
      tail -n 20 /tmp/verdaccio-${VERDACCIO_PORT}.log
      exit 1
    fi

    sleep 0.5
    count=$((count + 1))
  done

  if [[ "${ready}" != "true" ]]; then
    print_error "Verdaccio failed to start within ${VERDACCIO_TIMEOUT} seconds"
    print_info "Last 20 lines of log:"
    tail -n 20 /tmp/verdaccio-${VERDACCIO_PORT}.log
    exit 1
  fi

  print_success "Verdaccio is ready at ${VERDACCIO_URL}"
}

###############################################################################
# Build and Publish Functions
###############################################################################

build_springboard() {
  print_header "Building Springboard Package"

  print_step "Running build-for-publish.ts..."
  print_info "This will build all platform bundles and generate TypeScript declarations"

  cd "${REPO_ROOT}"

  if ! npx tsx "${BUILD_SCRIPT}"; then
    print_error "Springboard build failed"
    exit 1
  fi

  print_success "Springboard package built successfully"

  # Verify dist directory exists
  if [[ ! -d "${SPRINGBOARD_PKG}/dist" ]]; then
    print_error "dist directory not found after build"
    exit 1
  fi

  # Verify package.publish.json exists
  if [[ ! -f "${SPRINGBOARD_PKG}/package.publish.json" ]]; then
    print_error "package.publish.json not found after build"
    exit 1
  fi

  print_info "Build artifacts verified"
}

publish_springboard() {
  print_header "Publishing Springboard to Verdaccio"

  cd "${SPRINGBOARD_PKG}"

  # Backup original package.json
  print_step "Backing up original package.json..."
  cp package.json package.json.backup
  print_success "Backup created"

  # Replace package.json with publish version
  print_step "Using package.publish.json for publishing..."
  cp package.publish.json package.json
  print_success "package.json updated"

  # Verify dependencies were resolved
  print_step "Verifying dependencies in package.json..."
  if grep -q '"json-rpc-2.0": "catalog:"' package.json; then
    print_error "package.json still contains catalog: dependencies!"
    print_info "Dependencies section:"
    grep -A5 '"dependencies"' package.json
    exit 1
  fi
  print_success "Dependencies resolved correctly"

  # Create .npmrc for publishing
  print_step "Creating .npmrc for Verdaccio..."
  cat > .npmrc <<EOF
registry=${VERDACCIO_URL}/
//${VERDACCIO_URL#http://}/:_authToken="dummy-token"
EOF
  print_success ".npmrc created"

  # Debug: Check what will be packaged
  print_step "Creating test package tarball for inspection..."
  npm pack 2>&1 | tee /tmp/npm-pack.log
  local tarball_name
  tarball_name=$(ls -t *.tgz | head -1)
  if [[ -f "${tarball_name}" ]]; then
    print_step "Inspecting tarball package.json..."
    tar -xzf "${tarball_name}" package/package.json
    if grep -q '"json-rpc-2.0": "catalog:"' package/package.json; then
      print_error "Tarball contains catalog: dependencies!"
      print_info "Dependencies in tarball:"
      cat package/package.json | grep -A10 '"dependencies"'
      rm -rf package "${tarball_name}"
      exit 1
    fi
    print_success "Tarball dependencies are resolved correctly"
    rm -rf package "${tarball_name}"
  fi

  # Publish to Verdaccio
  print_step "Publishing to Verdaccio..."
  if ! npm publish --registry="${VERDACCIO_URL}" --force 2>&1 | tee /tmp/npm-publish.log; then
    print_error "Failed to publish package"
    print_info "npm publish output:"
    cat /tmp/npm-publish.log

    # Restore package.json before exiting
    mv package.json.backup package.json
    rm -f .npmrc
    exit 1
  fi

  print_success "Package published to Verdaccio"

  # Clean up .npmrc
  print_step "Cleaning up .npmrc..."
  rm -f .npmrc

  # Restore original package.json
  print_step "Restoring original package.json..."
  mv package.json.backup package.json
  print_success "Original package.json restored"

  # Verify package is in registry
  print_step "Verifying package in registry..."
  if curl -s "${VERDACCIO_URL}/springboard" >/dev/null 2>&1; then
    print_success "Package 'springboard' verified in Verdaccio"
  else
    print_error "Package not found in Verdaccio registry"
    exit 1
  fi

  # Check package metadata in Verdaccio
  print_step "Checking package metadata in Verdaccio..."
  local pkg_metadata
  pkg_metadata=$(curl -s "${VERDACCIO_URL}/springboard")
  if echo "${pkg_metadata}" | grep -q '"json-rpc-2.0":"catalog:"'; then
    print_error "Verdaccio has catalog: in package metadata!"
    print_info "Package dependencies in Verdaccio:"
    echo "${pkg_metadata}" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data['versions']['0.0.1-autogenerated']['dependencies'], indent=2))" 2>/dev/null || echo "Could not parse metadata"
    exit 1
  fi
  print_success "Verdaccio metadata looks correct"
}

###############################################################################
# Test App Functions
###############################################################################

install_dependencies() {
  print_header "Installing Dependencies from Verdaccio"

  cd "${TEST_APP_DIR}"

  # Verify .npmrc exists
  print_step "Verifying .npmrc configuration..."
  if [[ ! -f .npmrc ]]; then
    print_warning ".npmrc not found. Creating one..."
    cat > .npmrc <<EOF
registry=${VERDACCIO_URL}/
//${VERDACCIO_URL#http://}/:_authToken="dummy"
EOF
  fi

  local npmrc_content
  npmrc_content=$(cat .npmrc)
  print_info ".npmrc content:"
  echo "${npmrc_content}"

  # Clean node_modules, lockfile and pnpm cache for fresh install
  print_step "Cleaning existing node_modules, lockfile and pnpm cache..."
  rm -rf node_modules pnpm-lock.yaml
  pnpm store prune 2>/dev/null || true
  print_success "Clean complete"

  # Install base dependencies first
  print_step "Running pnpm install..."
  print_info "This will install base dependencies from Verdaccio registry"

  if ! pnpm install --no-frozen-lockfile 2>&1 | tee /tmp/pnpm-install.log; then
    print_error "Failed to install base dependencies"
    print_info "pnpm install output:"
    cat /tmp/pnpm-install.log
    exit 1
  fi

  print_success "Base dependencies installed successfully"

  # Install springboard package from Verdaccio
  print_step "Installing springboard package from Verdaccio..."
  print_info "Using --no-workspace to avoid monorepo catalog resolution"
  if ! pnpm add -D --no-workspace springboard@0.0.1-autogenerated 2>&1 | tee /tmp/pnpm-add-springboard.log; then
    print_error "Failed to install springboard package"
    print_info "pnpm add output:"
    cat /tmp/pnpm-add-springboard.log
    exit 1
  fi

  print_success "Springboard package installed"

  # Verify springboard is installed
  print_step "Verifying springboard package installation..."
  if [[ ! -d "node_modules/springboard" ]]; then
    print_error "springboard package not found in node_modules"
    exit 1
  fi

  local installed_version
  installed_version=$(node -e "console.log(require('./node_modules/springboard/package.json').version)")
  print_success "springboard version ${installed_version} installed"

  # Verify it's from Verdaccio (check for dist files)
  if [[ ! -d "node_modules/springboard/dist" ]]; then
    print_error "springboard dist directory not found - may not be published version"
    exit 1
  fi
  print_success "Verified published version with dist files"
}

build_test_app() {
  print_header "Building Test App with esbuild"

  cd "${TEST_APP_DIR}"

  # Clean existing dist
  print_step "Cleaning existing dist directory..."
  rm -rf dist
  print_success "Dist cleaned"

  # Run build
  print_step "Running pnpm build (tsx esbuild.ts)..."
  print_info "This tests the legacy esbuild-based build workflow"
  print_info "Building tic-tac-toe app from platform-agnostic source (src/tic_tac_toe.tsx)"
  print_info "Generating both browser and node bundles from the same entry point"

  if ! pnpm build 2>&1 | tee /tmp/esbuild-build.log; then
    print_error "Build failed"
    print_info "Build output:"
    cat /tmp/esbuild-build.log
    exit 1
  fi

  print_success "Build completed successfully"
}

verify_output() {
  print_header "Verifying Build Output"

  cd "${TEST_APP_DIR}"

  local all_exist=true

  for output_file in "${EXPECTED_OUTPUTS[@]}"; do
    print_step "Checking ${output_file}..."

    # Special handling for browser index.js which may be fingerprinted
    if [[ "${output_file}" == "dist/browser/dist/index.js" ]]; then
      # Check for fingerprinted files (e.g., index-NVANENJ5.js)
      local fingerprinted_js
      fingerprinted_js=$(find dist/browser/dist -name "index-*.js" -not -name "*.map" | head -n 1)
      if [[ -n "${fingerprinted_js}" ]]; then
        local size
        size=$(du -h "${fingerprinted_js}" | cut -f1)
        print_success "Found ${fingerprinted_js} (${size}) [fingerprinted]"
        if [[ ! -s "${fingerprinted_js}" ]]; then
          print_error "${fingerprinted_js} exists but is empty"
          all_exist=false
        fi
      else
        # Fallback to non-fingerprinted name
        if [[ -f "${output_file}" ]]; then
          local size
          size=$(du -h "${output_file}" | cut -f1)
          print_success "Found ${output_file} (${size})"
          if [[ ! -s "${output_file}" ]]; then
            print_error "${output_file} exists but is empty"
            all_exist=false
          fi
        else
          print_error "${output_file} not found (and no fingerprinted version found)"
          all_exist=false
        fi
      fi
    elif [[ -f "${output_file}" ]]; then
      local size
      size=$(du -h "${output_file}" | cut -f1)
      print_success "Found ${output_file} (${size})"

      # Check file is not empty
      if [[ ! -s "${output_file}" ]]; then
        print_error "${output_file} exists but is empty"
        all_exist=false
      fi
    else
      print_error "${output_file} not found"
      all_exist=false
    fi
  done

  if [[ "${all_exist}" != "true" ]]; then
    print_error "Some expected output files are missing or empty"
    print_info "Contents of dist directory:"
    ls -lR dist/ || true
    exit 1
  fi

  print_success "All expected output files exist and are not empty"

  # Additional verification: check for source maps
  print_step "Checking for source maps..."
  local sourcemap_count
  sourcemap_count=$(find dist -name "*.js.map" | wc -l | xargs)
  if [[ $sourcemap_count -gt 0 ]]; then
    print_success "Found ${sourcemap_count} source map file(s)"
  else
    print_warning "No source maps found (this may be expected)"
  fi

  # Display dist structure
  print_info "Final dist structure:"
  tree dist/ 2>/dev/null || find dist -type f | sort
}

###############################################################################
# Main Execution
###############################################################################

main() {
  local start_time
  start_time=$(date +%s)

  print_header "esbuild Legacy Test - Verdaccio Workflow"
  print_info "Starting automated test at $(date)"

  # Run all steps
  validate_environment
  start_verdaccio
  build_springboard
  publish_springboard
  install_dependencies
  build_test_app
  verify_output

  local end_time
  end_time=$(date +%s)
  local duration
  duration=$((end_time - start_time))

  print_header "Test Summary"
  echo -e "${GREEN}${BOLD}All steps completed successfully!${RESET}"
  echo ""
  echo -e "${CYAN}Summary:${RESET}"
  echo -e "  ${GREEN}✓${RESET} Environment validated"
  echo -e "  ${GREEN}✓${RESET} Verdaccio started and ready"
  echo -e "  ${GREEN}✓${RESET} Springboard package built"
  echo -e "  ${GREEN}✓${RESET} Springboard published to Verdaccio"
  echo -e "  ${GREEN}✓${RESET} Dependencies installed from Verdaccio"
  echo -e "  ${GREEN}✓${RESET} Test app built with esbuild"
  echo -e "  ${GREEN}✓${RESET} Output files verified"
  echo ""
  echo -e "${MAGENTA}Total time: ${duration}s${RESET}"
  echo ""
}

# Run main function
main "$@"
