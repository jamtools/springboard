/**
 * Example 6b: Multi-Platform with Vite Plugin Approach
 *
 * When using springboard as a plugin (not config wrapper), you need
 * separate config files for each platform.
 *
 * This example shows the pattern for multi-platform builds.
 */

// =============================================================================
// File: vite.config.browser.ts
// =============================================================================

import { defineConfig } from 'vite';
import { springboardPlugins } from 'springboard/vite-plugin';
import react from '@vitejs/plugin-react';

export const browserConfig = defineConfig({
  plugins: [
    react(),
    ...springboardPlugins({
      entry: './src/index.tsx',
      platform: 'browser',
      documentMeta: {
        title: 'My App',
      },
    }),
  ],

  build: {
    outDir: 'dist/browser',
  },

  // Browser-specific config
  server: {
    port: 3000,
  },
});

// =============================================================================
// File: vite.config.node.ts
// =============================================================================

export const nodeConfig = defineConfig({
  plugins: [
    ...springboardPlugins({
      entry: './src/index.tsx',
      platform: 'node',
    }),
  ],

  build: {
    outDir: 'dist/node',
    ssr: true,
    rollupOptions: {
      external: ['fs', 'path', 'http', /* Node builtins */],
    },
  },
});

// =============================================================================
// File: vite.config.partykit.ts
// =============================================================================

export const partykitConfig = defineConfig({
  plugins: [
    ...springboardPlugins({
      entry: './src/index.tsx',
      platform: 'partykit',
      partykitName: 'my-app',
    }),
  ],

  build: {
    outDir: 'dist/partykit',
    ssr: true,
    rollupOptions: {
      external: ['cloudflare:*'],
      output: {
        format: 'esm',
      },
    },
  },

  resolve: {
    conditions: ['workerd', 'worker', 'browser'],
  },
});

// =============================================================================
// Usage in package.json scripts:
// =============================================================================

/*
{
  "scripts": {
    "dev": "concurrently \"npm:dev:*\"",
    "dev:browser": "vite --config vite.config.browser.ts",
    "dev:node": "vite build --watch --config vite.config.node.ts",

    "build": "npm run build:browser && npm run build:node && npm run build:partykit",
    "build:browser": "vite build --config vite.config.browser.ts",
    "build:node": "vite build --config vite.config.node.ts",
    "build:partykit": "vite build --config vite.config.partykit.ts"
  }
}
*/

// =============================================================================
// OR: Use a single vite.config.ts that exports based on env var
// =============================================================================

// File: vite.config.ts (dynamic)
const platform = process.env.VITE_PLATFORM || 'browser';

export default platform === 'browser' ? browserConfig
  : platform === 'node' ? nodeConfig
  : platform === 'partykit' ? partykitConfig
  : browserConfig;

// Then run:
// VITE_PLATFORM=browser vite dev
// VITE_PLATFORM=node vite build
// VITE_PLATFORM=partykit vite build

// =============================================================================
// Recommendation: Use springboard() wrapper for multi-platform
// =============================================================================

/*
For multi-platform apps, the springboard() config wrapper (Example 1-5) is
simpler because it handles all platforms in one config:

import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node', 'partykit'],
  viteConfig: (platform, baseConfig) => {
    // Customize per platform
  }
});

Use the plugin approach (this example) only if you need maximum control
over the Vite config and prefer managing separate config files.
*/
