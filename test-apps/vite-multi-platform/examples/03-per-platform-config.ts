/**
 * Example 3: Per-Platform Custom Configuration
 *
 * Shows how to customize Vite config differently per platform.
 * Use a function that receives (platform, baseConfig) and returns custom config.
 */

import { springboard } from 'springboard/vite-plugin';
import { mergeConfig } from 'vite';
import type { Platform } from 'springboard/vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node', 'partykit'],

  // Option B: Function - different config per platform
  viteConfig: (platform, baseConfig) => {
    // Browser: Add PWA plugin, specific optimizations
    if (platform === 'browser') {
      return mergeConfig(baseConfig, {
        plugins: [
          // Add browser-specific plugins
          // VitePWA({ ... }),
        ],
        build: {
          rollupOptions: {
            output: {
              manualChunks: {
                vendor: ['react', 'react-dom'],
                ui: ['@mantine/core', '@mantine/hooks'],
              },
            },
          },
        },
      });
    }

    // Node: Externalize native modules, CJS output
    if (platform === 'node') {
      return mergeConfig(baseConfig, {
        build: {
          rollupOptions: {
            external: [
              'better-sqlite3',
              'sharp',
              // Any native modules
            ],
          },
        },
        ssr: {
          noExternal: ['@springboardjs/*'], // Bundle our packages
        },
      });
    }

    // PartyKit: Cloudflare Workers specific
    if (platform === 'partykit') {
      return mergeConfig(baseConfig, {
        build: {
          rollupOptions: {
            external: [
              'cloudflare:*', // Cloudflare runtime APIs
            ],
          },
        },
      });
    }

    // Default: return base config
    return baseConfig;
  },
});
