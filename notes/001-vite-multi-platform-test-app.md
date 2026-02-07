# Vite Multi-Platform Test App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a comprehensive test app in `test-apps/vite-multi-platform` that validates the springboard Vite plugin across all 6 Songdrive platform targets, using Verdaccio for package installation.

**Architecture:** The test app will mirror Songdrive's multi-entrypoint structure with separate entry files for each platform variant. Each platform will have its own vite config or use environment variables to switch targets. The app will install `springboard` from local Verdaccio registry (not workspace).

**Tech Stack:** Vite 7+, springboard (from Verdaccio), React 19, TypeScript, Hono (for node server)

---

## Platform Targets

| Platform | Description | Entry Point | Build Output |
|----------|-------------|-------------|--------------|
| browser_online | Web app with server connection | `src/entrypoints/browser_online/init.ts` | `dist/browser/` |
| browser_offline | PWA with local SQLite | `src/entrypoints/browser_offline/init.ts` | `dist/browser_offline/` |
| node_maestro | Node.js backend server | `src/entrypoints/node_maestro/init.ts` | `dist/node/` |
| tauri | Desktop app (Tauri webview) | `src/entrypoints/tauri/init.ts` | `dist/tauri/` |
| rn_webview | React Native webview content | `src/entrypoints/rn_webview/init.ts` | `dist/rn_webview/` |
| rn_main | React Native host bundle | `src/entrypoints/rn_main/init.ts` | `dist/rn_main/` |

---

### Task 1: Create Base Project Structure

**Files:**
- Create: `test-apps/vite-multi-platform/.npmrc`
- Create: `test-apps/vite-multi-platform/.gitignore`
- Create: `test-apps/vite-multi-platform/package.json`
- Create: `test-apps/vite-multi-platform/tsconfig.json`
- Create: `test-apps/vite-multi-platform/pnpm-workspace.yaml`

**Step 1: Create .npmrc for Verdaccio**

```
registry=http://localhost:4873/
//localhost:4873/:_authToken="dummy"
```

**Step 2: Create .gitignore**

```
node_modules/
dist/
.springboard/
*.log
```

**Step 3: Create package.json**

```json
{
  "name": "vite-multi-platform-test",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Multi-platform test app validating Springboard Vite plugin across all platform targets",
  "scripts": {
    "dev": "vite",
    "dev:browser": "SPRINGBOARD_PLATFORM=browser vite",
    "dev:node": "SPRINGBOARD_PLATFORM=node vite",
    "build": "npm run build:browser_online && npm run build:node_maestro",
    "build:browser_online": "SPRINGBOARD_PLATFORM_VARIANT=browser_online vite build",
    "build:browser_offline": "SPRINGBOARD_PLATFORM_VARIANT=browser_offline vite build --outDir dist/browser_offline",
    "build:node_maestro": "SPRINGBOARD_PLATFORM_VARIANT=node_maestro vite build --outDir dist/node",
    "build:tauri": "SPRINGBOARD_PLATFORM_VARIANT=tauri vite build --outDir dist/tauri",
    "build:rn_webview": "SPRINGBOARD_PLATFORM_VARIANT=rn_webview vite build --outDir dist/rn_webview",
    "build:rn_main": "SPRINGBOARD_PLATFORM_VARIANT=rn_main vite build --outDir dist/rn_main",
    "build:all": "npm run build:browser_online && npm run build:browser_offline && npm run build:node_maestro && npm run build:tauri && npm run build:rn_webview && npm run build:rn_main",
    "preview": "vite preview",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "springboard": "^0.15.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.19.0",
    "rxjs": "^7.8.0",
    "immer": "^10.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.3.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 5: Create pnpm-workspace.yaml (empty, standalone project)**

```yaml
# Standalone test app - uses Verdaccio, not workspace packages
packages: []
```

**Step 6: Commit**

```bash
git add test-apps/vite-multi-platform/
git commit -m "feat(test-apps): create vite-multi-platform base structure"
```

---

### Task 2: Create Vite Configuration

**Files:**
- Create: `test-apps/vite-multi-platform/vite.config.ts`

**Step 1: Create vite.config.ts with multi-platform support**

```typescript
import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';
import path from 'node:path';

// Get platform variant from environment
const platformVariant = process.env.SPRINGBOARD_PLATFORM_VARIANT || 'browser_online';

// Map platform variants to entry points
const entryMap: Record<string, string> = {
  browser_online: './src/entrypoints/browser_online/init.ts',
  browser_offline: './src/entrypoints/browser_offline/init.ts',
  node_maestro: './src/entrypoints/node_maestro/init.ts',
  tauri: './src/entrypoints/tauri/init.ts',
  rn_webview: './src/entrypoints/rn_webview/init.ts',
  rn_main: './src/entrypoints/rn_main/init.ts',
};

// Determine which entry to use
const entry = entryMap[platformVariant] || entryMap.browser_online;

// Determine platform type (browser or node)
const browserPlatforms = ['browser_online', 'browser_offline', 'tauri', 'rn_webview'];
const nodePlatforms = ['node_maestro'];
const neutralPlatforms = ['rn_main'];

const platforms: ('browser' | 'node')[] = browserPlatforms.includes(platformVariant)
  ? ['browser']
  : nodePlatforms.includes(platformVariant)
  ? ['node']
  : ['browser']; // default

console.log(`Building for platform variant: ${platformVariant}`);
console.log(`Entry: ${entry}`);
console.log(`Platforms: ${platforms.join(', ')}`);

export default defineConfig({
  plugins: [
    springboard({
      entry,
      platforms,
      documentMeta: {
        title: 'Springboard Multi-Platform Test',
        description: 'Testing all platform targets',
      },
      nodeServerPort: 1337,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: true,
  },
});
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/vite.config.ts
git commit -m "feat(test-apps): add vite config with multi-platform support"
```

---

### Task 3: Create Shared App Code

**Files:**
- Create: `test-apps/vite-multi-platform/src/app/App.tsx`
- Create: `test-apps/vite-multi-platform/src/app/modules/counter_module.ts`

**Step 1: Create simple App component**

```tsx
// src/app/App.tsx
import React from 'react';

interface AppProps {
  platform: string;
}

export const App: React.FC<AppProps> = ({ platform }) => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Springboard Multi-Platform Test</h1>
      <p>Platform: <strong>{platform}</strong></p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
};
```

**Step 2: Create a simple springboard module for testing**

```typescript
// src/app/modules/counter_module.ts
import springboard from 'springboard';

springboard.registerModule('Counter', {}, async (moduleAPI) => {
  let count = 0;

  const increment = () => {
    count++;
    console.log(`[Counter] Count is now: ${count}`);
    return count;
  };

  const getCount = () => count;

  return {
    increment,
    getCount,
  };
});
```

**Step 3: Commit**

```bash
git add test-apps/vite-multi-platform/src/app/
git commit -m "feat(test-apps): add shared App component and counter module"
```

---

### Task 4: Create Browser Online Entrypoint

**Files:**
- Create: `test-apps/vite-multi-platform/src/entrypoints/browser_online/init.ts`

**Step 1: Create browser_online init**

```typescript
// src/entrypoints/browser_online/init.ts
import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the main browser online module
springboard.registerModule('BrowserOnlineInit', {}, async (moduleAPI) => {
  console.log('[BrowserOnlineInit] Initializing browser online platform');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'browser_online' }));
  }

  return {};
});

// Start springboard
springboard.start().catch(console.error);
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/src/entrypoints/browser_online/
git commit -m "feat(test-apps): add browser_online entrypoint"
```

---

### Task 5: Create Node Maestro Entrypoint

**Files:**
- Create: `test-apps/vite-multi-platform/src/entrypoints/node_maestro/init.ts`

**Step 1: Create node_maestro init**

```typescript
// src/entrypoints/node_maestro/init.ts
import springboard from 'springboard';
import '@/app/modules/counter_module';

// Register the node maestro module
springboard.registerModule('NodeMaestroInit', {}, async (moduleAPI) => {
  console.log('[NodeMaestroInit] Initializing node maestro platform');

  // Node-specific initialization
  console.log('[NodeMaestroInit] Running on Node.js:', process.version);

  return {};
});

// Start springboard
springboard.start().catch(console.error);
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/src/entrypoints/node_maestro/
git commit -m "feat(test-apps): add node_maestro entrypoint"
```

---

### Task 6: Create Browser Offline Entrypoint

**Files:**
- Create: `test-apps/vite-multi-platform/src/entrypoints/browser_offline/init.ts`

**Step 1: Create browser_offline init**

```typescript
// src/entrypoints/browser_offline/init.ts
import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the browser offline module
springboard.registerModule('BrowserOfflineInit', {}, async (moduleAPI) => {
  console.log('[BrowserOfflineInit] Initializing browser offline platform');
  console.log('[BrowserOfflineInit] This platform uses local SQLite for offline storage');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'browser_offline' }));
  }

  return {};
});

// Start springboard
springboard.start().catch(console.error);
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/src/entrypoints/browser_offline/
git commit -m "feat(test-apps): add browser_offline entrypoint"
```

---

### Task 7: Create Tauri Entrypoint

**Files:**
- Create: `test-apps/vite-multi-platform/src/entrypoints/tauri/init.ts`

**Step 1: Create tauri init**

```typescript
// src/entrypoints/tauri/init.ts
import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the tauri module
springboard.registerModule('TauriInit', {}, async (moduleAPI) => {
  console.log('[TauriInit] Initializing Tauri desktop platform');
  console.log('[TauriInit] Running in Tauri webview');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'tauri' }));
  }

  return {};
});

// Start springboard
springboard.start().catch(console.error);
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/src/entrypoints/tauri/
git commit -m "feat(test-apps): add tauri entrypoint"
```

---

### Task 8: Create React Native Webview Entrypoint

**Files:**
- Create: `test-apps/vite-multi-platform/src/entrypoints/rn_webview/init.ts`

**Step 1: Create rn_webview init**

```typescript
// src/entrypoints/rn_webview/init.ts
import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the RN webview module
springboard.registerModule('RNWebviewInit', {}, async (moduleAPI) => {
  console.log('[RNWebviewInit] Initializing React Native webview platform');
  console.log('[RNWebviewInit] Running in RN WebView component');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'rn_webview' }));
  }

  return {};
});

// Start springboard
springboard.start().catch(console.error);
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/src/entrypoints/rn_webview/
git commit -m "feat(test-apps): add rn_webview entrypoint"
```

---

### Task 9: Create React Native Main Entrypoint

**Files:**
- Create: `test-apps/vite-multi-platform/src/entrypoints/rn_main/init.ts`

**Step 1: Create rn_main init**

```typescript
// src/entrypoints/rn_main/init.ts
import springboard from 'springboard';
import '@/app/modules/counter_module';

// Register the RN main module
// This bundle runs in the React Native runtime, not in a webview
springboard.registerModule('RNMainInit', {}, async (moduleAPI) => {
  console.log('[RNMainInit] Initializing React Native main platform');
  console.log('[RNMainInit] Running in React Native runtime');

  // Note: No DOM rendering here - this is the RN host bundle
  // It exports modules that the RN app can use

  return {};
});

// Export for RN to consume
export { springboard };

// Start springboard
springboard.start().catch(console.error);
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/src/entrypoints/rn_main/
git commit -m "feat(test-apps): add rn_main entrypoint"
```

---

### Task 10: Create Test/Publish Workflow Script

**Files:**
- Create: `test-apps/vite-multi-platform/scripts/test-publish-workflow.sh`

**Step 1: Create test-publish-workflow.sh**

```bash
#!/bin/bash

# Test the complete publish and build workflow for the vite multi-platform test app
# This script:
# 1. Publishes springboard to local Verdaccio registry
# 2. Updates the test app to use the new version
# 3. Builds all platform targets
# 4. Reports success/failure for each

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEST_APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$TEST_APP_DIR/../.." && pwd)"
SPRINGBOARD_DIR="$PROJECT_ROOT/packages/springboard"
VITE_PLUGIN_DIR="$SPRINGBOARD_DIR/vite-plugin"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Vite Multi-Platform Test - Publish Workflow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Publish springboard to Verdaccio
echo -e "${YELLOW}Step 1: Publishing springboard to Verdaccio...${NC}"
cd "$SPRINGBOARD_DIR"

# Bump patch version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

npm version patch --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Build TypeScript
echo "Building TypeScript..."
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

# Build vite-plugin
echo "Building vite-plugin..."
cd "$VITE_PLUGIN_DIR"
npm run build
echo -e "${GREEN}✓ Vite plugin build complete${NC}"
cd "$SPRINGBOARD_DIR"

# Publish to local registry
echo "Publishing to http://localhost:4873..."
pnpm publish --registry http://localhost:4873 --no-git-checks

echo -e "${GREEN}✓ Published springboard@${NEW_VERSION}${NC}"
echo ""

# Step 2: Update test app dependencies
echo -e "${YELLOW}Step 2: Updating test app to springboard@${NEW_VERSION}...${NC}"
cd "$TEST_APP_DIR"

# Update to latest version from Verdaccio
pnpm update springboard@latest

echo -e "${GREEN}✓ Updated dependencies${NC}"
echo ""

# Step 3: Build all platform targets
echo -e "${YELLOW}Step 3: Building all platform targets...${NC}"

declare -a PLATFORMS=("browser_online" "browser_offline" "node_maestro" "tauri" "rn_webview" "rn_main")
declare -a FAILED_BUILDS=()

for platform in "${PLATFORMS[@]}"; do
  echo -e "${BLUE}Building ${platform}...${NC}"
  if npm run build:${platform} 2>&1; then
    echo -e "${GREEN}✓ ${platform} build succeeded${NC}"
  else
    echo -e "${RED}✗ ${platform} build failed${NC}"
    FAILED_BUILDS+=("$platform")
  fi
  echo ""
done

# Summary
echo -e "${BLUE}========================================${NC}"
if [ ${#FAILED_BUILDS[@]} -eq 0 ]; then
  echo -e "${GREEN}All platform builds succeeded!${NC}"
else
  echo -e "${RED}Failed builds: ${FAILED_BUILDS[*]}${NC}"
  exit 1
fi
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Summary:"
echo "  • Published: springboard@${NEW_VERSION}"
echo "  • Built platforms: ${PLATFORMS[*]}"
echo ""
```

**Step 2: Make script executable**

```bash
chmod +x test-apps/vite-multi-platform/scripts/test-publish-workflow.sh
```

**Step 3: Commit**

```bash
git add test-apps/vite-multi-platform/scripts/
git commit -m "feat(test-apps): add test-publish-workflow script"
```

---

### Task 11: Create README

**Files:**
- Create: `test-apps/vite-multi-platform/README.md`

**Step 1: Create README**

```markdown
# Vite Multi-Platform Test App

This test app validates the Springboard Vite plugin across all 6 platform targets:

| Platform | Description | Command |
|----------|-------------|---------|
| browser_online | Web app with server connection | `npm run build:browser_online` |
| browser_offline | PWA with local SQLite | `npm run build:browser_offline` |
| node_maestro | Node.js backend server | `npm run build:node_maestro` |
| tauri | Desktop app (Tauri webview) | `npm run build:tauri` |
| rn_webview | React Native webview content | `npm run build:rn_webview` |
| rn_main | React Native host bundle | `npm run build:rn_main` |

## Prerequisites

- Node.js 20+
- pnpm
- Verdaccio running at http://localhost:4873

## Setup

```bash
# Start Verdaccio (in another terminal)
verdaccio

# Install dependencies (from Verdaccio)
pnpm install

# Run dev server
npm run dev
```

## Testing

Run the full test workflow:

```bash
./scripts/test-publish-workflow.sh
```

This will:
1. Publish springboard to local Verdaccio
2. Update dependencies
3. Build all platform targets
4. Report success/failure

## Development

```bash
# Dev server (browser + node)
npm run dev

# Dev server (browser only)
npm run dev:browser

# Build all platforms
npm run build:all

# Type check
npm run check-types
```
```

**Step 2: Commit**

```bash
git add test-apps/vite-multi-platform/README.md
git commit -m "docs(test-apps): add vite-multi-platform README"
```

---

## Summary

This plan creates a comprehensive multi-platform test app that:

1. **Uses Verdaccio** - Installs springboard from local registry, not workspace
2. **Mirrors Songdrive** - Same 6 platform targets with separate entrypoints
3. **Vite-based** - Uses springboard/vite-plugin with environment-based platform selection
4. **Testable** - Includes scripts to publish, update, and build all targets
5. **Self-contained** - Standalone project that can be tested independently

Total: 11 tasks with incremental commits.
