/**
 * Example 5: Advanced Multi-Entry Configuration
 *
 * Shows advanced patterns:
 * - Per-platform entry points
 * - Conditional plugins
 * - Complex build configurations
 */

import { springboard } from 'springboard/vite-plugin';
import { mergeConfig, defineConfig } from 'vite';

export default springboard({
  // Different entry per platform (advanced use case)
  entry: {
    browser: './src/browser-entry.tsx',
    node: './src/server-entry.ts',
    partykit: './src/partykit-entry.ts',
  },

  platforms: ['browser', 'node', 'partykit'],

  viteConfig: (platform, baseConfig) => {
    const customConfig = defineConfig({
      // Shared config for all platforms
      resolve: {
        alias: {
          '@': '/src',
        },
      },
    });

    // Platform-specific additions
    const platformConfig = defineConfig(
      platform === 'browser' ? {
        // Browser-specific
        build: {
          rollupOptions: {
            input: {
              main: './index.html',
              // Additional entry points
              worker: './src/worker.ts',
            },
          },
        },
      } : platform === 'node' ? {
        // Node-specific
        build: {
          rollupOptions: {
            external: [/^node:/, 'better-sqlite3'],
          },
        },
      } : {
        // PartyKit-specific
        resolve: {
          conditions: ['workerd', 'worker', 'browser'],
        },
      }
    );

    // Merge: base -> custom -> platform-specific
    return mergeConfig(
      mergeConfig(baseConfig, customConfig),
      platformConfig
    );
  },
});
