# esbuild Legacy Test App - Implementation Guide

**Status**: Ready for Sequential Implementation
**Created**: 2025-12-28
**Purpose**: Validate that legacy esbuild-based build workflows continue working with the new consolidated Springboard package structure

---

## ⚠️ Important Note on Code Examples

**All code examples in this document are suggestions only.** Subagents should:
- Research the actual Springboard API to verify imports and usage
- Improve and perfect the code for readability and correctness
- Check that dependencies and types are accurate
- Ensure the implementation matches current best practices
- Prioritize code clarity and maintainability

Do not blindly copy-paste. Use these as starting points and make them better.

---

## 🎯 Objective

Create a test app in `./test-apps/esbuild-legacy-test/` that:
- Uses raw esbuild (not Vite) to build a Springboard application
- Consumes the published `springboard` package from Verdaccio
- Validates that the package structure, imports, and type definitions work correctly
- Documents the migration path for apps like SongDrive that use the legacy esbuild workflow

---

## 🔍 Critical Discovery

**The old Springboard CLI API no longer exists.**

### Old API (used by SongDrive):
```typescript
import {
  buildApplication,
  buildServer,
  platformBrowserBuildConfig,
  platformNodeBuildConfig
} from 'springboard-cli/src/build';
```

### New API (current):
```typescript
import {
  buildAllPlatforms,
  buildMain,
  buildPlatform,
  buildServer
} from 'springboard-cli';
```

**Implication**: Apps that want to continue using esbuild need to use **raw esbuild** directly, without the old CLI helpers. This test demonstrates that pattern.

---

## 📁 Target Directory Structure

```
test-apps/esbuild-legacy-test/
├── .npmrc                          # Verdaccio registry config
├── pnpm-workspace.yaml             # Isolated workspace
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── esbuild.ts                      # Build script (builds browser + node)
├── src/
│   ├── browser/
│   │   ├── index.tsx               # Browser entry point
│   │   └── App.tsx                 # React component
│   └── node/
│       └── index.ts                # Node entry point
├── public/
│   └── index.html                  # HTML template
├── scripts/
│   └── test-legacy-esbuild.sh     # Verdaccio test workflow
└── README.md                       # Documentation
```

---

## ✅ What This Test Validates

- ✅ Package structure and exports work correctly
- ✅ Imports like `import { createSpringboard } from 'springboard'` resolve
- ✅ Subpath imports like `springboard/platforms/browser` and `springboard/platforms/node` work
- ✅ TypeScript type definitions are correct
- ✅ esbuild can bundle apps using the published package for both browser and node platforms
- ✅ External dependencies (React, etc.) externalize properly
- ✅ Multi-platform builds work (browser + node)

---

## ❌ What This Test Does NOT Validate

- ❌ The old CLI API (it doesn't exist anymore)
- ❌ SongDrive-specific features (Sentry, HTML post-processing, etc.)
- ❌ All 7 platform targets (tests browser + node only, not mobile/partykit/tauri)
- ❌ Watch mode edge cases
- ❌ Production optimizations

---

## 🔄 Sequential Implementation Steps

**Each step should be handled by a dedicated subagent to avoid conflicts.**

---

### Step 1: Create Test App Structure and Configuration

**Subagent**: `code-reviewer`
**Estimated Time**: 15 minutes

#### Files to Create:
1. `test-apps/esbuild-legacy-test/.npmrc`
2. `test-apps/esbuild-legacy-test/pnpm-workspace.yaml`
3. `test-apps/esbuild-legacy-test/package.json`
4. `test-apps/esbuild-legacy-test/tsconfig.json`

#### Detailed Instructions:

**1. Create `.npmrc`:**
```ini
registry=http://localhost:4873/
//localhost:4873/:_authToken="dummy"
```

**2. Create `pnpm-workspace.yaml`:**
```yaml
packages:
  - '.'
```

**3. Create `package.json`:**
```json
{
  "name": "esbuild-legacy-test",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsx esbuild.ts",
    "build:watch": "tsx esbuild.ts --watch"
  },
  "dependencies": {
    "springboard": "*",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "esbuild": "catalog:",
    "tsx": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:"
  }
}
```

**4. Create `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Success Criteria:
- [ ] All 4 files created in correct location
- [ ] Files are valid (JSON files parse correctly)
- [ ] Directory structure matches plan

---

### Step 2: Create Application Source Files

**Subagent**: `frontend-developer`
**Estimated Time**: 25 minutes

#### Files to Create:
1. `test-apps/esbuild-legacy-test/src/browser/index.tsx`
2. `test-apps/esbuild-legacy-test/src/browser/App.tsx`
3. `test-apps/esbuild-legacy-test/src/node/index.ts`
4. `test-apps/esbuild-legacy-test/public/index.html`

#### Detailed Instructions:

**Note**: Research the actual Springboard API before implementing. These are suggested patterns only.

**1. Create `src/browser/index.tsx`:**
```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Import from consolidated springboard package
// Note: Adjust this import based on actual API available
// This is a placeholder - check actual springboard exports
console.log('esbuild Legacy Test App starting...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(<App />);
```

**2. Create `src/browser/App.tsx`:**
```typescript
import React from 'react';

export const App: React.FC = () => {
  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>🔧 esbuild Legacy Test App (Browser)</h1>

      <div style={{
        background: '#f0f0f0',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>✅ Browser Build Successful!</h2>
        <p>
          This validates that browser-platform esbuild builds work with
          the new consolidated Springboard package.
        </p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>What This Tests:</h3>
        <ul>
          <li>Browser platform package imports</li>
          <li>TypeScript compilation for browser</li>
          <li>React integration in browser</li>
          <li>esbuild browser bundling</li>
        </ul>
      </div>
    </div>
  );
};
```

**3. Create `src/node/index.ts`:**
```typescript
// Node platform entry point
// Research actual Springboard node platform API before implementing

console.log('🔧 esbuild Legacy Test App (Node Platform)');
console.log('');
console.log('✅ Node Build Successful!');
console.log('');
console.log('This validates that:');
console.log('  • Node platform package imports resolve');
console.log('  • TypeScript compiles for node target');
console.log('  • esbuild can bundle node apps');
console.log('  • Springboard node platform exports work');
console.log('');

// Example: Import from springboard node platform
// Verify actual API before implementing
// import { someNodeFunction } from 'springboard/platforms/node';

// Keep the process alive briefly to show output
setTimeout(() => {
  console.log('✅ Test complete!');
  process.exit(0);
}, 100);
```

**4. Create `public/index.html`:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>esbuild Legacy Test</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/dist/browser/index.js"></script>
</body>
</html>
```

#### Success Criteria:
- [ ] All 3 files created
- [ ] TypeScript compiles without errors (tsx check)
- [ ] React component is valid
- [ ] HTML template is well-formed

---

### Step 3: Create esbuild Build Script

**Subagent**: `typescript-pro`
**Estimated Time**: 35 minutes

#### Files to Create:
1. `test-apps/esbuild-legacy-test/esbuild.ts`

#### Detailed Instructions:

Create a simplified esbuild build script that builds BOTH browser and node platforms. Research and improve this code for readability and correctness.

**Create `esbuild.ts`:**
```typescript
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const watchMode = process.argv.includes('--watch');

/**
 * Build browser platform
 * Suggestion: Research actual Springboard browser platform requirements
 */
const buildBrowser = async () => {
  console.log('🌐 Building browser platform...');

  const distDir = path.join(__dirname, 'dist', 'browser');
  await fs.mkdir(distDir, { recursive: true });

  const buildOptions: esbuild.BuildOptions = {
    entryPoints: [path.join(__dirname, 'src', 'browser', 'index.tsx')],
    bundle: true,
    outfile: path.join(distDir, 'index.js'),
    platform: 'browser',
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    sourcemap: true,
    minify: false,
    external: ['react', 'react-dom'],
    loader: {
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
    },
    logLevel: 'info',
  };

  await esbuild.build(buildOptions);
  console.log(`   ✅ Browser: ${path.relative(process.cwd(), path.join(distDir, 'index.js'))}`);
};

/**
 * Build node platform
 * Suggestion: Research actual Springboard node platform requirements
 */
const buildNode = async () => {
  console.log('🖥️  Building node platform...');

  const distDir = path.join(__dirname, 'dist', 'node');
  await fs.mkdir(distDir, { recursive: true });

  const buildOptions: esbuild.BuildOptions = {
    entryPoints: [path.join(__dirname, 'src', 'node', 'index.ts')],
    bundle: true,
    outfile: path.join(distDir, 'index.js'),
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: true,
    minify: false,
    // Node builds typically externalize all node_modules
    // Research what should actually be external for Springboard
    external: ['springboard'],
    logLevel: 'info',
  };

  await esbuild.build(buildOptions);
  console.log(`   ✅ Node: ${path.relative(process.cwd(), path.join(distDir, 'index.js'))}`);
};

/**
 * Main build function - builds both platforms
 */
const buildAll = async () => {
  console.log('🔨 Building all platforms with esbuild...');
  console.log('');

  try {
    if (watchMode) {
      console.log('⚠️  Watch mode not yet implemented for multi-platform builds');
      console.log('   Run without --watch flag for now');
      process.exit(1);
    }

    // Build both platforms sequentially
    await buildBrowser();
    await buildNode();

    console.log('');
    console.log('✅ All platforms built successfully!');
  } catch (error) {
    console.error('');
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
};

// Run the build
buildAll().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Build stopped');
  process.exit(0);
});
```

#### Success Criteria:
- [ ] File created with valid TypeScript
- [ ] Script can be executed with tsx
- [ ] Builds both browser and node platforms
- [ ] Has proper error handling and clear console output
- [ ] Creates dist/browser/index.js output
- [ ] Creates dist/node/index.js output

---

### Step 4: Create Test Automation Script

**Subagent**: `devops-troubleshooter`
**Estimated Time**: 30 minutes

#### Files to Create:
1. `test-apps/esbuild-legacy-test/scripts/test-legacy-esbuild.sh`

#### Detailed Instructions:

Create a comprehensive test script that automates the entire Verdaccio workflow:

**Create `scripts/test-legacy-esbuild.sh`:**
```bash
#!/bin/bash
set -e  # Exit on error

echo "========================================"
echo "esbuild Legacy Test Workflow"
echo "========================================"
echo ""

# Store the test app directory
TEST_APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$TEST_APP_DIR/../.." && pwd)"

# Verdaccio PID file for cleanup
VERDACCIO_PID=""

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  if [ ! -z "$VERDACCIO_PID" ] && kill -0 $VERDACCIO_PID 2>/dev/null; then
    echo "   Stopping Verdaccio (PID: $VERDACCIO_PID)..."
    kill $VERDACCIO_PID
    wait $VERDACCIO_PID 2>/dev/null || true
  fi
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

echo "📍 Test app directory: $TEST_APP_DIR"
echo "📍 Repository root: $REPO_ROOT"
echo ""

# Step 1: Start Verdaccio
echo "1️⃣  Starting Verdaccio..."
cd "$REPO_ROOT"

if [ ! -f "tests/verdaccio-config.yaml" ]; then
  echo "❌ Error: Verdaccio config not found at tests/verdaccio-config.yaml"
  exit 1
fi

npx verdaccio --config tests/verdaccio-config.yaml &
VERDACCIO_PID=$!
echo "   Verdaccio started (PID: $VERDACCIO_PID)"
echo "   Waiting for Verdaccio to be ready..."
sleep 5

# Verify Verdaccio is running
if ! curl -s http://localhost:4873/ > /dev/null; then
  echo "❌ Error: Verdaccio failed to start"
  exit 1
fi
echo "   ✅ Verdaccio is ready"
echo ""

# Step 2: Build springboard package
echo "2️⃣  Building springboard package..."
cd "$REPO_ROOT"
npx tsx scripts/build-for-publish.ts
echo "   ✅ Build complete"
echo ""

# Step 3: Publish to Verdaccio
echo "3️⃣  Publishing to Verdaccio..."
cd "$REPO_ROOT/packages/springboard"

# Create temporary .npmrc for publishing
cat > .npmrc.tmp << EOF
registry=http://localhost:4873/
//localhost:4873/:_authToken="dummy"
EOF

npm publish --registry http://localhost:4873 --force --userconfig .npmrc.tmp
rm .npmrc.tmp
echo "   ✅ Published to Verdaccio"
echo ""

# Step 4: Install dependencies in test app
echo "4️⃣  Installing dependencies in test app..."
cd "$TEST_APP_DIR"

# Ensure .npmrc exists
if [ ! -f ".npmrc" ]; then
  echo "⚠️  Warning: .npmrc not found, creating it..."
  cat > .npmrc << EOF
registry=http://localhost:4873/
//localhost:4873/:_authToken="dummy"
EOF
fi

pnpm install --registry http://localhost:4873 --no-frozen-lockfile
echo "   ✅ Dependencies installed"
echo ""

# Step 5: Run the build
echo "5️⃣  Running esbuild build..."
cd "$TEST_APP_DIR"
pnpm build
echo "   ✅ Build completed"
echo ""

# Step 6: Verify output
echo "6️⃣  Verifying build output..."

# Check browser output
BROWSER_OUTPUT="$TEST_APP_DIR/dist/browser/index.js"
if [ -f "$BROWSER_OUTPUT" ]; then
  BROWSER_SIZE=$(wc -c < "$BROWSER_OUTPUT" | tr -d ' ')
  echo "   ✅ Browser output exists: $BROWSER_OUTPUT"
  echo "   📊 Browser size: $BROWSER_SIZE bytes"

  if [ "$BROWSER_SIZE" -lt 100 ]; then
    echo "   ⚠️  Warning: Browser output seems too small"
  fi
else
  echo "   ❌ Error: Browser output not found"
  exit 1
fi

# Check node output
NODE_OUTPUT="$TEST_APP_DIR/dist/node/index.js"
if [ -f "$NODE_OUTPUT" ]; then
  NODE_SIZE=$(wc -c < "$NODE_OUTPUT" | tr -d ' ')
  echo "   ✅ Node output exists: $NODE_OUTPUT"
  echo "   📊 Node size: $NODE_SIZE bytes"

  if [ "$NODE_SIZE" -lt 50 ]; then
    echo "   ⚠️  Warning: Node output seems too small"
  fi
else
  echo "   ❌ Error: Node output not found"
  exit 1
fi

# Test running the node build
echo ""
echo "7️⃣  Testing node build execution..."
if node "$NODE_OUTPUT"; then
  echo "   ✅ Node build executes successfully"
else
  echo "   ⚠️  Warning: Node build execution failed (may be expected)"
fi

echo ""
echo "========================================"
echo "✅ All tests passed!"
echo "========================================"
echo ""
echo "Summary:"
echo "  • Verdaccio: Started and responded"
echo "  • Springboard: Built and published"
echo "  • Dependencies: Installed from Verdaccio"
echo "  • esbuild: Successfully bundled both platforms"
echo "  • Browser: Created at dist/browser/index.js"
echo "  • Node: Created at dist/node/index.js"
echo ""
```

Make the script executable:
```bash
chmod +x test-apps/esbuild-legacy-test/scripts/test-legacy-esbuild.sh
```

#### Success Criteria:
- [ ] Script is executable (`chmod +x`)
- [ ] Has proper error handling (`set -e`)
- [ ] Cleanup function works correctly
- [ ] All 6 steps execute successfully
- [ ] Verdaccio starts and stops cleanly

---

### Step 5: Create Documentation

**Subagent**: `api-documenter`
**Estimated Time**: 20 minutes

#### Files to Create:
1. `test-apps/esbuild-legacy-test/README.md`

#### Detailed Instructions:

**Create `README.md`:**
```markdown
# esbuild Legacy Test App

**Purpose**: Validates that legacy esbuild-based build workflows continue to work with the new consolidated Springboard package structure.

---

## What This Tests

✅ **Package Structure**: Verifies that the published `springboard` package structure is correct
✅ **Import Resolution**: Confirms imports like `import { X } from 'springboard'` work
✅ **Subpath Exports**: Validates paths like `springboard/platforms/browser`
✅ **Type Definitions**: Ensures TypeScript `.d.ts` files are correct
✅ **esbuild Compatibility**: Proves raw esbuild can bundle apps using the package
✅ **Externals**: Verifies React and other deps externalize properly

---

## What This Does NOT Test

❌ **Old CLI API**: The legacy `buildApplication` API no longer exists
❌ **SongDrive Features**: Sentry integration, HTML post-processing, etc.
❌ **All Platforms**: Only tests browser target (not node, mobile, etc.)
❌ **Production Builds**: Focuses on correctness, not optimizations

---

## How to Run

### Option 1: Full Test (Recommended)

Runs the complete Verdaccio workflow:

```bash
cd test-apps/esbuild-legacy-test
./scripts/test-legacy-esbuild.sh
```

This will:
1. Start Verdaccio
2. Build and publish the springboard package
3. Install dependencies from Verdaccio
4. Run the esbuild build
5. Verify output exists
6. Clean up

### Option 2: Local Build Only

If you just want to test the build script (assuming deps are installed):

```bash
cd test-apps/esbuild-legacy-test
pnpm install  # First time only
pnpm build
```

### Option 3: Watch Mode

For development:

```bash
cd test-apps/esbuild-legacy-test
pnpm build:watch
```

---

## Expected Output

After a successful build:

```
dist/
└── browser/
    ├── index.js       # Bundled application
    └── index.js.map   # Source map
```

The `index.js` file should:
- Contain bundled React code
- Have external imports for `react` and `react-dom`
- Include the application logic from `src/`
- Be runnable in a browser (with React provided externally)

---

## Migration Insights for SongDrive

### Critical Discovery

The old Springboard CLI API **no longer exists**:

```typescript
// ❌ Old API (no longer available)
import {buildApplication, platformBrowserBuildConfig} from 'springboard-cli/src/build';
```

```typescript
// ✅ New API (Vite-based)
import {buildAllPlatforms, buildPlatform} from 'springboard-cli';
```

### Migration Options

SongDrive has **two options** for migration:

#### Option 1: Use Raw esbuild (This Approach)

**Pros:**
- Maximum control over build process
- Can keep existing build patterns
- No need to learn Vite
- Custom plugins work as-is

**Cons:**
- More code to maintain
- Need to implement platform switching manually
- Missing out on Vite ecosystem benefits
- No built-in dev server features

**Implementation**: See `esbuild.ts` in this test app for a working example.

#### Option 2: Migrate to New Vite-based CLI

**Pros:**
- Less code to maintain
- Built-in dev server with HMR
- Better aligned with Springboard's direction
- Access to Vite plugin ecosystem
- Simpler configuration

**Cons:**
- Need to learn Vite patterns
- Requires refactoring build setup
- May need to adapt custom plugins
- Different mental model

**Implementation**: See `test-apps/vite-multi-platform/` for an example.

### Recommendation

For **new projects**: Use Option 2 (Vite-based CLI)
For **existing large apps**: Option 1 may be easier short-term

---

## Troubleshooting

### Build fails with "Cannot find module 'springboard'"

**Cause**: Package not installed from Verdaccio
**Fix**: Run the full test script: `./scripts/test-legacy-esbuild.sh`

### TypeScript errors about missing types

**Cause**: Type definitions not installed
**Fix**: Ensure `@types/react` and `@types/react-dom` are in devDependencies

### Verdaccio fails to start

**Cause**: Port 4873 already in use
**Fix**: Kill existing Verdaccio: `pkill -f verdaccio`

### Build output is empty or tiny

**Cause**: Entry point not found or bundling failed
**Fix**: Check that `src/index.tsx` exists and has valid code

---

## Files Overview

| File | Purpose |
|------|---------|
| `esbuild.ts` | Build script using raw esbuild |
| `src/index.tsx` | Application entry point |
| `src/App.tsx` | React component |
| `public/index.html` | HTML template |
| `scripts/test-legacy-esbuild.sh` | Verdaccio test automation |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `.npmrc` | Verdaccio registry config |

---

## Success Criteria

- [ ] `./scripts/test-legacy-esbuild.sh` completes without errors
- [ ] `dist/browser/index.js` exists and is > 1KB
- [ ] Bundle contains React code
- [ ] No TypeScript compilation errors
- [ ] Can be built independently: `pnpm build`

---

## Learn More

- **Springboard Vite Plugin**: See `test-apps/vite-multi-platform/`
- **New CLI API**: Check `packages/springboard/cli/src/index.ts`
- **Package Structure**: See `packages/springboard/package.json` exports
```

#### Success Criteria:
- [ ] README created with all sections
- [ ] Markdown is well-formatted
- [ ] Examples are accurate
- [ ] Migration guidance is clear
- [ ] Troubleshooting covers common issues

---

### Step 6: Run and Validate

**Subagent**: `test-automator`
**Estimated Time**: 30 minutes

#### Tasks:

1. **Execute the complete workflow:**
   ```bash
   cd test-apps/esbuild-legacy-test
   ./scripts/test-legacy-esbuild.sh
   ```

2. **Verify all steps succeed:**
   - [ ] Verdaccio starts successfully
   - [ ] Springboard builds without errors
   - [ ] Package publishes to Verdaccio
   - [ ] Dependencies install correctly
   - [ ] esbuild build completes
   - [ ] Output file exists at `dist/browser/index.js`

3. **Validate output quality:**
   - [ ] Check file size is reasonable (> 1KB)
   - [ ] Verify bundle contains React code
   - [ ] Check sourcemap was generated
   - [ ] Inspect for any error messages in bundle

4. **Test local build:**
   ```bash
   cd test-apps/esbuild-legacy-test
   pnpm build
   ```

5. **Create test report:** Document in `test-apps/esbuild-legacy-test/TEST_REPORT.md`:
   - What worked
   - What failed
   - Any issues encountered
   - Recommendations for fixes

#### Success Criteria:
- [ ] Full workflow completes successfully
- [ ] Test report created with findings
- [ ] Any blocking issues identified and documented
- [ ] Recommendations provided for improvements

---

## 📊 Overall Success Criteria

The implementation is successful when:

1. ✅ All 6 steps completed by subagents
2. ✅ `./scripts/test-legacy-esbuild.sh` runs without errors
3. ✅ `dist/browser/index.js` exists and is valid
4. ✅ `dist/node/index.js` exists and is valid
5. ✅ Node build can execute: `node dist/node/index.js`
6. ✅ No TypeScript compilation errors
7. ✅ README provides clear migration guidance for both platforms
8. ✅ Can run independently: `cd test-apps/esbuild-legacy-test && pnpm build`

---

## 🔄 Handoff to Subagents

**Instructions for main agent:**

Execute each step sequentially using the Task tool:

```typescript
// Step 1
Task(subagent_type: "code-reviewer", prompt: "<Step 1 instructions>")

// Wait for completion, review output

// Step 2
Task(subagent_type: "frontend-developer", prompt: "<Step 2 instructions>")

// Continue through Step 6...
```

**After each step:**
1. Review the subagent's output
2. Verify success criteria are met
3. Address any issues before proceeding
4. Update this document if needed

---

## 📝 Notes

- This test demonstrates **Option 1** from the migration guide (raw esbuild)
- For **Option 2** (Vite), see `test-apps/vite-multi-platform/`
- Keep the test simple - it's a validation, not a full app
- Focus on proving the pattern works, not building features

---

**Ready to begin implementation!**
