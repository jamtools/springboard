# Test Automation Scripts

## test-legacy-esbuild.sh

Comprehensive test automation script for validating the consolidated Springboard package with legacy esbuild-based builds using a local Verdaccio registry.

### Overview

This script automates the complete workflow of:
1. Starting a local Verdaccio npm registry
2. Building the Springboard package for publishing
3. Publishing Springboard to the local registry
4. Installing dependencies from the local registry
5. Building the test app using esbuild
6. Verifying output files
7. Cleaning up resources

### Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: Latest version (installed globally)
- **Repository**: Must be run from within the repository

### Usage

```bash
# From the test-apps/esbuild-legacy-test directory
./scripts/test-legacy-esbuild.sh
```

### What It Tests

The script validates:

1. **Package Build**: Springboard package builds correctly for publishing
2. **Package Publishing**: Package can be published to an npm registry
3. **Dependency Installation**: Consumer apps can install the package
4. **Legacy esbuild Support**: The package works with esbuild-based builds
5. **Platform Bundles**: Browser and Node.js platform bundles are generated from a single platform-agnostic source file
6. **Output Files**: Expected output files are created and not empty

### Test App Structure

The test app is a platform-agnostic tic-tac-toe game built with Springboard. Both browser and node platforms are built from the same source file (`src/tic_tac_toe.tsx`), demonstrating how the legacy CLI handles platform-specific bundling internally without requiring separate `src/browser/` or `src/node/` directories.

### Expected Output Files

The script verifies these files exist after the build:

- `dist/browser/dist/index.js` - Browser JavaScript bundle
- `dist/browser/dist/index.html` - Browser HTML file
- `dist/node/dist/index.js` - Node.js bundle

Note: The legacy CLI uses the path structure `dist/{platform}/dist/{file}` for its output.

### Exit Codes

- `0` - All tests passed successfully
- `1` - Test failure (see error messages for details)

### Error Handling

The script includes comprehensive error handling:

- **Cleanup on Exit**: Verdaccio is always stopped, even on failure
- **Package.json Restore**: Original package.json is always restored
- **Detailed Logging**: All operations are logged with clear status messages
- **Validation**: Environment and prerequisites are validated before running

### Logging

Logs are written to temporary files in `/tmp/`:

- `/tmp/verdaccio-4873.log` - Verdaccio server output
- `/tmp/npm-publish.log` - npm publish output
- `/tmp/pnpm-install.log` - pnpm install output
- `/tmp/esbuild-build.log` - esbuild build output

### Environment Variables

None required. The script auto-detects all necessary paths.

### Troubleshooting

#### Port 4873 Already in Use

If Verdaccio is already running on port 4873, the script will attempt to kill it. If this fails:

```bash
# Manually kill the process
lsof -ti:4873 | xargs kill -9
```

#### Verdaccio Won't Start

Check the Verdaccio log file:

```bash
tail -n 50 /tmp/verdaccio-4873.log
```

#### Build Failures

Check the build log:

```bash
cat /tmp/esbuild-build.log
```

#### Clean State

To ensure a clean state before running:

```bash
# Clean node_modules and dist
rm -rf node_modules dist pnpm-lock.yaml

# Kill any Verdaccio processes
lsof -ti:4873 | xargs kill -9 2>/dev/null || true
```

### Development

#### Modifying the Script

The script is organized into sections:

1. **Configuration**: Variables and constants
2. **Utility Functions**: Print functions for output
3. **Cleanup Function**: Registered with trap for guaranteed execution
4. **Validation Functions**: Environment checking
5. **Verdaccio Functions**: Start/stop Verdaccio
6. **Build and Publish Functions**: Springboard package build/publish
7. **Test App Functions**: Install and build test app
8. **Main Execution**: Orchestrates all steps

#### Adding New Checks

To add new output file verification:

```bash
# In the Configuration section, add to EXPECTED_OUTPUTS array
EXPECTED_OUTPUTS=(
  "dist/browser/dist/index.js"
  "dist/node/dist/index.js"
  "dist/browser/dist/new-file.js"  # New file
)
```

#### Debugging

Enable verbose output:

```bash
# Add at the top of the script after set -o pipefail
set -x  # Print each command before execution
```

### Integration with CI/CD

This script can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Test esbuild legacy support
  run: |
    cd test-apps/esbuild-legacy-test
    ./scripts/test-legacy-esbuild.sh
```

### Performance

Typical execution time:
- **Clean run**: ~2-3 minutes
- **With cache**: ~1-2 minutes

The longest steps are:
1. Springboard package build (~30-60s)
2. Dependency installation (~30-60s)
3. Verdaccio startup (~5-10s)

### Related Files

- `../esbuild.ts` - esbuild configuration for the test app
- `../../scripts/build-for-publish.ts` - Springboard build script
- `../../packages/springboard/package.json` - Springboard package configuration
- `../.npmrc` - npm registry configuration

### Version History

- **v1.0.0** (2025-12-28): Initial version with complete Verdaccio workflow
