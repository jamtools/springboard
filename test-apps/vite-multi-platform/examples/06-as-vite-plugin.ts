/**
 * Example 6a: Using Springboard as a Vite Plugin (Single Platform)
 *
 * Alternative approach: Use springboard as a plugin instead of config wrapper.
 * This gives you FULL control over the Vite config.
 *
 * ❓ Why multiple plugins (...spread)?
 * Springboard is composed of several focused plugins for better separation:
 * - springboard:init (base config)
 * - springboard:virtual (virtual modules)
 * - springboard:platform-inject (code transformation)
 * - springboard:html (HTML generation)
 * - etc.
 *
 * The spread operator (...) adds all of them to your plugin array.
 * This follows the Nitro.js pattern of plugin composition.
 */

import { defineConfig } from 'vite';
import { springboardPlugins } from 'springboard/vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // You have complete control over Vite config
  plugins: [
    react(),

    // Add Springboard plugins (spreads multiple focused plugins)
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

// For multi-platform builds with this approach, see 06b-multi-platform-plugin.ts
