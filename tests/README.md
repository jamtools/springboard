# Springboard Vite Plugin E2E Tests

Comprehensive end-to-end test suite for the Springboard Vite integration.

## Overview

This test suite validates the entire Springboard Vite workflow from package publishing to consumer usage. It uses real package publishing (via Verdaccio), actual builds, and live dev servers to ensure production-like testing.

## Test Structure

```
tests/
├── e2e/                              # End-to-end tests
│   ├── verdaccio-workflow.test.ts   # Full publish → install → build workflow
│   ├── plugin-api.test.ts           # Plugin API validation
│   ├── platform-builds.test.ts      # Platform-specific build tests
│   └── dev-server.test.ts           # Dev server and HMR tests
├── integration/                      # Integration tests
│   └── vite-plugin.test.ts          # Plugin unit tests (future)
├── fixtures/                         # Test fixtures and sample apps
│   └── test-app/                    # Minimal test apps (future)
└── utils/                            # Test utilities
    ├── verdaccio.ts                 # Verdaccio management
    ├── file-system.ts               # File system utilities
    ├── exec.ts                      # Command execution helpers
    └── index.ts                     # Exports

```

## Test Categories

### 1. Verdaccio E2E Workflow (`verdaccio-workflow.test.ts`)

**Most Important Test Suite**

This test validates the complete package lifecycle:

1. Build Springboard package with `pnpm build:publish`
2. Publish to local Verdaccio registry
3. Install in consumer app from Verdaccio
4. Build consumer app for multiple platforms
5. Run dev server
6. Verify build artifacts and TypeScript types

**Why it matters:** This ensures the published package works exactly as a real consumer would use it.

### 2. Plugin API Tests (`plugin-api.test.ts`)

Tests the Vite plugin API:

- Function exports (`springboard`, `springboardPlugins`, `defineSpringboardConfig`)
- Configuration validation
- Option normalization
- Platform configuration utilities
- TypeScript type exports

### 3. Platform Build Tests (`platform-builds.test.ts`)

Tests building for each platform individually:

- **Browser**: HTML generation, ES modules, client-side bundles
- **Node**: SSR configuration, server-compatible output
- **PartyKit**: Workerd runtime compatibility, fetch-based APIs
- **Tauri**: Dual browser/node builds
- **React Native**: React Native specific builds
- **Multi-platform**: Building multiple platforms simultaneously

### 4. Dev Server Tests (`dev-server.test.ts`)

Tests development server functionality:

- Server startup and accessibility
- HMR (Hot Module Replacement)
- Platform code transformation in dev mode
- Error handling and recovery
- Performance benchmarks
- Virtual module serving

## Running Tests

### Run all tests
```bash
pnpm test:vite
```

### Run E2E tests only
```bash
pnpm test:e2e
```

### Run specific test file
```bash
pnpm test:vite tests/e2e/verdaccio-workflow.test.ts
```

### Watch mode
```bash
pnpm test:e2e:watch
```

### With UI
```bash
pnpm test:vite:ui
```

### With coverage
```bash
pnpm test:vite:coverage
```

## Test Utilities

### Verdaccio Utilities (`utils/verdaccio.ts`)

- `startVerdaccio()`: Start local npm registry
- `publishToVerdaccio()`: Publish package to registry
- `installFromVerdaccio()`: Install from registry
- `packageExists()`: Check if package is published
- `getPackageInfo()`: Get package metadata

### File System Utilities (`utils/file-system.ts`)

- `createTempDir()`: Create temporary test directory
- `cleanupDir()`: Clean up test artifacts
- `copyDir()`: Recursive directory copy
- `fileExists()`, `dirExists()`: Check existence
- `readJson()`, `writeJson()`: JSON file operations
- `findFiles()`: Find files matching pattern

### Execution Utilities (`utils/exec.ts`)

- `execute()`: Run command and capture output
- `spawnProcess()`: Spawn long-running process
- `runBuild()`: Run Vite build with proper setup
- `runDevServer()`: Start dev server and wait for ready
- `waitForUrl()`: Wait for URL to be accessible

## Configuration

Tests are configured in `/vitest.config.ts`:

```typescript
{
  test: {
    testTimeout: 300000,      // 5 minutes for E2E tests
    hookTimeout: 60000,       // 1 minute for setup/teardown
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,    // Serial execution to avoid conflicts
      },
    },
  },
}
```

## Writing New Tests

### E2E Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDir, cleanupDir } from '../utils/file-system.js';
import { runBuild } from '../utils/exec.js';

describe('My E2E Test', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await createTempDir('my-test-');
    // Setup test app
  });

  afterAll(async () => {
    await cleanupDir(testDir);
  });

  it('should do something', async () => {
    const result = await runBuild(testDir);
    expect(result.exitCode).toBe(0);
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { springboard } from '../../packages/springboard/vite-plugin/src/index.js';

describe('Plugin Feature', () => {
  it('should behave correctly', () => {
    const plugins = springboard({ entry: './src/index.tsx' });
    expect(plugins.length).toBeGreaterThan(0);
  });
});
```

## CI/CD Integration

Tests can be run in CI with:

```bash
# Run all tests
pnpm test:e2e

# Run with coverage
pnpm test:vite:coverage
```

**Note:** E2E tests require:
- Node.js 20+
- pnpm 9+
- Sufficient disk space for temporary test apps
- Network access for Verdaccio (localhost)

## Troubleshooting

### Verdaccio fails to start

```bash
# Kill existing Verdaccio processes
lsof -ti:4873 | xargs kill -9

# Then run tests again
pnpm test:e2e
```

### Port conflicts

Tests use these ports:
- 4873: Verdaccio registry
- 5173: Vite dev server (default)
- 5174: Custom port tests

Make sure these ports are available.

### Timeout errors

E2E tests have extended timeouts:
- Test timeout: 5 minutes
- Setup timeout: 2 minutes
- Dev server timeout: 1 minute

If tests timeout, check:
1. Network connectivity
2. System resources
3. No conflicting processes

### Cleanup issues

If temp directories aren't cleaned up:

```bash
# Manual cleanup
rm -rf /tmp/springboard-test-*
rm -rf /tmp/verdaccio-test-*
```

## Performance

Typical test execution times:

- **Plugin API tests**: ~5 seconds
- **Platform build tests**: ~2-3 minutes per platform
- **Dev server tests**: ~1-2 minutes per test
- **Verdaccio workflow**: ~5-10 minutes (full cycle)

**Total E2E suite**: ~15-20 minutes

## Best Practices

1. **Isolation**: Each test should clean up after itself
2. **Timeouts**: Use appropriate timeouts for build operations
3. **Real Operations**: Use actual file system, builds, and servers
4. **Error Messages**: Provide clear error messages with context
5. **Artifacts**: Clean up temporary directories
6. **Deterministic**: Tests should produce consistent results
7. **Serial Execution**: Use single fork to avoid conflicts

## Future Improvements

- [ ] Add visual regression tests
- [ ] Add bundle size validation
- [ ] Test TypeScript declaration generation
- [ ] Add performance benchmarks
- [ ] Test error scenarios more thoroughly
- [ ] Add integration tests for individual plugins
- [ ] Test with different Node.js versions
- [ ] Add tests for package exports resolution
