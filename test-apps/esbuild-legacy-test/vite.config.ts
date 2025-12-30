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
      nodeServerPort: 3001, // Use port 3001 for node dev server
      // No platform specified - uses SPRINGBOARD_PLATFORM env var
      // Default: node,web
    })
  ],
  optimizeDeps: {
    // Explicitly include React since it's imported inside the springboard package
    // which is being optimized. Vite's dependency scanner doesn't traverse
    // optimized dependencies to find their transitive dependencies.
    // React needs to be pre-bundled from CommonJS to ESM for browser compatibility.
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime'
    ]
  }
});
