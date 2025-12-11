# Quick Start Guide - Springboard Vite E2E Tests

## Prerequisites

Before running tests, ensure you have:

```bash
# Node.js 20+
node --version

# pnpm 9+
pnpm --version

# Install dependencies
pnpm install
```

## Quick Test Commands

### Run Plugin API Tests (Fast - ~5 seconds)

```bash
pnpm test:vite tests/e2e/plugin-api.test.ts
```

This validates the plugin API without building anything.

### Run Integration Tests (Fast - ~10 seconds)

```bash
pnpm test:integration
```

Unit tests for individual plugin components.

### Run All E2E Tests (Slow - ~15-20 minutes)

```bash
pnpm test:e2e
```

This runs the complete workflow including Verdaccio publishing.

### Run Specific Test Suite

```bash
# Platform builds only
pnpm test:vite tests/e2e/platform-builds.test.ts

# Dev server only
pnpm test:vite tests/e2e/dev-server.test.ts

# Verdaccio workflow (most comprehensive)
pnpm test:vite tests/e2e/verdaccio-workflow.test.ts
```

### Watch Mode (for development)

```bash
# Watch E2E tests
pnpm test:e2e:watch

# Watch specific file
pnpm test:vite tests/e2e/plugin-api.test.ts --watch
```

### UI Mode (Interactive)

```bash
pnpm test:vite:ui
```

Opens a browser-based UI to run and debug tests interactively.

## Test Execution Order (Recommended)

When developing or debugging, run tests in this order:

1. **Plugin API tests** (fastest, no build)
   ```bash
   pnpm test:vite tests/e2e/plugin-api.test.ts
   ```

2. **Integration tests** (fast, unit tests)
   ```bash
   pnpm test:integration
   ```

3. **Platform builds** (medium speed, individual platform tests)
   ```bash
   pnpm test:vite tests/e2e/platform-builds.test.ts
   ```

4. **Dev server tests** (medium speed, tests HMR)
   ```bash
   pnpm test:vite tests/e2e/dev-server.test.ts
   ```

5. **Verdaccio workflow** (slowest, full integration)
   ```bash
   pnpm test:vite tests/e2e/verdaccio-workflow.test.ts
   ```

## Common Issues

### Port 4873 already in use (Verdaccio)

```bash
# Kill existing Verdaccio process
lsof -ti:4873 | xargs kill -9

# Run tests again
pnpm test:e2e
```

### Port 5173 already in use (Vite dev server)

```bash
# Kill existing Vite process
lsof -ti:5173 | xargs kill -9

# Run tests again
```

### Tests timing out

E2E tests have long timeouts because they do real builds:
- Test timeout: 5 minutes
- Setup timeout: 2 minutes

If tests still timeout:
1. Check your internet connection
2. Make sure you have enough disk space
3. Close other resource-intensive applications

### Cleanup temp directories

Tests should clean up automatically, but if they don't:

```bash
# Manual cleanup
rm -rf /tmp/springboard-test-*
rm -rf /tmp/verdaccio-test-*
rm -rf /tmp/dev-server-test-*
rm -rf /tmp/platform-builds-test-*
```

## Understanding Test Output

### Successful test output

```
✓ tests/e2e/plugin-api.test.ts (15)
  ✓ Springboard Vite Plugin API (15)
    ✓ springboard() function (10)
      ✓ should export springboard function
      ✓ should return array of plugins
      ...

Test Files  1 passed (1)
     Tests  15 passed (15)
  Start at  12:00:00
  Duration  5.23s
```

### Failed test output

Tests provide detailed error messages:

```
✗ should build browser platform with HTML output
  Expected: true
  Received: false

  Error: HTML file not found at dist/browser/index.html

  Output:
  <build command output>
```

## Debugging Tests

### Verbose output

```bash
# Run with verbose logging
pnpm test:vite tests/e2e/verdaccio-workflow.test.ts --reporter=verbose
```

### Run single test

```bash
# Run only one test within a file
pnpm test:vite tests/e2e/plugin-api.test.ts -t "should export springboard function"
```

### Keep test artifacts

Modify test files to skip cleanup:

```typescript
afterAll(async () => {
  // Comment out cleanup to inspect artifacts
  // await cleanupDir(testAppDir);
  console.log('Test artifacts at:', testAppDir);
});
```

### Inspect Verdaccio registry

While Verdaccio workflow test is running:

```bash
# In another terminal
curl http://localhost:4873/springboard
```

## Performance Benchmarks

Expected test durations:

| Test Suite | Duration | Description |
|------------|----------|-------------|
| Plugin API | ~5s | Fast, no builds |
| Integration | ~10s | Unit tests |
| Platform Builds | ~2-3min | Builds each platform |
| Dev Server | ~1-2min | Starts/stops servers |
| Verdaccio Workflow | ~5-10min | Full publish cycle |

**Total E2E Suite**: ~15-20 minutes

## CI/CD Usage

For continuous integration:

```bash
# Run all tests in CI mode
pnpm test:e2e

# With coverage
pnpm test:vite:coverage

# Fail fast (stop on first error)
pnpm test:vite tests/e2e --bail=1
```

## Coverage Reports

```bash
# Generate coverage report
pnpm test:vite:coverage

# View HTML report
open coverage/index.html
```

## Next Steps

After running tests:

1. Check the [full test documentation](./README.md)
2. Review test implementation for examples
3. Add new tests for your features
4. Run tests before committing changes

## Getting Help

If tests fail:

1. Check error messages carefully
2. Look at test output for debugging info
3. Check the test README for troubleshooting
4. Inspect temp directories (before cleanup)
5. Run tests in UI mode for step-by-step debugging

## Tips

- **Start small**: Run plugin API tests first
- **Use watch mode**: For development workflow
- **Use UI mode**: For debugging specific tests
- **Check logs**: Tests log progress to console
- **Clean ports**: Kill processes using test ports before running
- **Serial execution**: Tests run serially to avoid conflicts
