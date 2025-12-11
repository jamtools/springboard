/**
 * Springboard Vite Plugin Test App
 *
 * This demonstrates the simple, zero-config approach:
 * - Single entrypoint for ALL platforms
 * - Framework handles platform differences
 * - Minimal configuration required
 */

import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';

export default defineConfig({
  plugins: springboard({
    // Single entrypoint - works on browser, node, partykit, etc.
    entry: './src/index.tsx',

    // Target platforms to build for
    platforms: ['browser', 'node', 'partykit'],

    // Document metadata for browser platforms
    documentMeta: {
      title: 'Springboard Test App',
      description: 'Multi-platform test application built with Springboard',
    },
  }),
});
