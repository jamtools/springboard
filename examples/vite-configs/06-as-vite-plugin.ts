/**
 * Example 6: Using Springboard as a Vite Plugin
 *
 * Alternative approach: Use springboard as a plugin instead of config wrapper.
 * This gives you FULL control over the Vite config.
 */

import { defineConfig } from 'vite';
import { springboardPlugins } from 'springboard/vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // You have complete control over Vite config
  plugins: [
    react(),

    // Add Springboard as a plugin
    ...springboardPlugins({
      entry: './src/index.tsx',
      platform: 'browser', // Specify one platform
      documentMeta: {
        title: 'My App',
      },
    }),

    // Add more plugins after
  ],

  // Full Vite config - customize to your heart's content!
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },

  build: {
    outDir: 'dist/browser',
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // Any other Vite options...
});

// For multi-platform builds, you'd create separate config files:
// - vite.config.browser.ts
// - vite.config.node.ts
// - vite.config.partykit.ts
//
// Then run: vite build --config vite.config.browser.ts
