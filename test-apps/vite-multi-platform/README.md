# Vite Multi-Platform Test Application

This is an **isolated** test application that validates Springboard works correctly with Vite across multiple platforms. It simulates a real user's experience by installing Springboard packages from a local Verdaccio registry.

## Purpose

This test app verifies:

1. **Package Resolution**: All Springboard export conditions resolve correctly
2. **Browser Platform**: Vite can build a browser app with HMR support
3. **Node.js Platform**: Vite can build a Node.js server with proper externals
4. **PartyKit Platform**: Vite can build for workerd/edge runtime
5. **Production Builds**: All platforms produce valid production bundles

## Key Design Decisions

### Isolation from Main Repository

This test app is **deliberately isolated** from the main Springboard monorepo:

- Has its own `pnpm-workspace.yaml` (empty packages list)
- Does NOT use `workspace:*` protocol
- Installs packages from Verdaccio (local npm registry)
- Has its own `.npmrc` pointing to Verdaccio

This isolation is critical because:
- It simulates a real user installing from npm
- Tests actual package exports, not local file resolution
- Catches issues with `package.json` exports configuration
- Validates that published packages work independently

### Multi-Platform Vite Configuration

The `vite.config.ts` supports three build modes:

| Mode | Target | Export Conditions | Output |
|------|--------|-------------------|--------|
| `browser` | ESM for browsers | `browser`, `import`, `module` | `dist/browser/` |
| `server` | Node.js 20+ | `node`, `import`, `module` | `dist/server/` |
| `partykit` | Workerd/Edge | `workerd`, `worker`, `import` | `dist/partykit/` |

## Running Tests

### Prerequisites

1. Node.js 20+
2. pnpm 9+
3. Main repo dependencies installed (`pnpm install` at repo root)

### Full Test (Recommended)

Run the complete test suite with Verdaccio:

```bash
./scripts/test-with-verdaccio.sh
```

This will:
1. Start Verdaccio
2. Publish all Springboard packages
3. Install in this test app
4. Run Vite dev server test
5. Build for all platforms
6. Run export verification tests

### Options

```bash
# Use a specific version
./scripts/test-with-verdaccio.sh --version 0.3.0

# Skip Verdaccio startup (if already running)
./scripts/test-with-verdaccio.sh --skip-verdaccio

# Skip publishing (if packages already published)
./scripts/test-with-verdaccio.sh --skip-publish

# Keep node_modules after test
./scripts/test-with-verdaccio.sh --keep-node-modules
```

### Manual Testing

If you want to test manually:

```bash
# 1. Start Verdaccio (from repo root)
cd ../..
docker compose -f verdaccio/docker-compose.yml up -d
# Or: npx verdaccio --config verdaccio/config/config.yaml

# 2. Publish packages (from repo root)
./scripts/run-all-folders.sh 0.2.0 --mode verdaccio

# 3. Install in test app
cd test-apps/vite-multi-platform
pnpm install

# 4. Run dev server
pnpm dev

# 5. Build all platforms
pnpm build

# 6. Run export tests
pnpm test:exports
```

## Project Structure

```
vite-multi-platform/
├── pnpm-workspace.yaml    # Empty - isolates from parent workspace
├── package.json           # Dependencies from Verdaccio
├── .npmrc                 # Points to Verdaccio registry
├── vite.config.ts         # Multi-platform Vite configuration
├── tsconfig.json          # TypeScript configuration
├── index.html             # Browser entry HTML
├── src/
│   ├── browser/
│   │   └── main.tsx       # Browser platform entry
│   ├── server/
│   │   └── index.ts       # Node.js server entry
│   └── partykit/
│       └── server.ts      # PartyKit server entry
├── scripts/
│   ├── test-with-verdaccio.sh    # Main test script
│   └── test-exports.mjs          # Export verification
└── README.md
```

## What Gets Tested

### Export Resolution

The following imports are tested:

```typescript
// Main package
import springboard from 'springboard';
import { Springboard } from 'springboard/engine/engine';
import type { CoreDependencies } from 'springboard/types/module_types';

// Server package
import serverRegistry from 'springboard-server';

// Platform packages
import '@springboardjs/platforms-browser';
import { startNodeApp } from '@springboardjs/platforms-node/entrypoints/main';
import '@springboardjs/platforms-partykit';
import '@springboardjs/data-storage';
```

### Build Verification

Each platform build is verified for:
- Output files exist in correct location
- ESM format is preserved
- Source maps generated
- No runtime errors on import

### HMR Testing

The browser dev server is tested for:
- Vite starts successfully
- HMR websocket connects
- Module hot replacement works

## Troubleshooting

### Verdaccio Connection Issues

If Verdaccio fails to start:
```bash
# Check if port is in use
lsof -i :4873

# View logs
cat verdaccio.log

# Try manual start
npx verdaccio --config ../../verdaccio/config/config.yaml
```

### Package Not Found

If packages aren't found in Verdaccio:
```bash
# Verify package was published
curl http://localhost:4873/springboard

# Re-publish
cd ../..
./scripts/run-all-folders.sh 0.2.0 --mode verdaccio
```

### Build Failures

Check platform-specific issues:
```bash
# Browser only
pnpm build:browser

# Server only
pnpm build:server

# PartyKit only
pnpm build:partykit
```

## CI Integration

This test is designed to run in CI. Example GitHub Actions step:

```yaml
- name: Run Vite Multi-Platform Test
  run: |
    cd test-apps/vite-multi-platform
    ./scripts/test-with-verdaccio.sh --version ${{ github.event.inputs.version || '0.2.0' }}
```

## Related Files

- `/verdaccio/` - Verdaccio configuration
- `/scripts/run-all-folders.sh` - Package publishing script
- `/.github/workflows/cli_test.yml` - Existing CI workflow using Verdaccio
