import { defineConfig } from 'vite';
import springboard from './springboard-vite-plugin';

/**
 * Vite configuration for Springboard test app.
 *
 * This validates that the same tic-tac-toe app works with both:
 * - Legacy esbuild CLI (esbuild.ts)
 * - Modern Vite plugin (this file)
 *
 * Build with:
 *   SPRINGBOARD_PLATFORM=web vite build
 *   SPRINGBOARD_PLATFORM=node vite build
 *   SPRINGBOARD_PLATFORM=node,web vite build  (default)
 */
export default defineConfig({
  plugins: [
    springboard({
      entry: './src/tic_tac_toe.tsx',
      // No platform specified - uses SPRINGBOARD_PLATFORM env var
      // Default: node,web
    })
  ]
});
