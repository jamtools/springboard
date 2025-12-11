/**
 * Example 4: Environment-Based Configuration
 *
 * Shows how to:
 * - Only build specific platform via env var (SPRINGBOARD_PLATFORM)
 * - Different config for dev vs prod
 * - Use environment variables for configuration
 */

import { springboard } from 'springboard/vite-plugin';
import type { Platform } from 'springboard/vite-plugin';

// Get platform from env var, or default to all platforms
const platformEnv = process.env.SPRINGBOARD_PLATFORM as Platform | undefined;
const platforms: Platform[] = platformEnv
  ? [platformEnv]  // Build only specified platform
  : ['browser', 'node']; // Build all platforms

const isDev = process.env.NODE_ENV !== 'production';

export default springboard({
  entry: './src/index.tsx',
  platforms, // Dynamic based on env var

  viteConfig: {
    // Development-specific config
    server: isDev ? {
      port: 3000,
      hmr: true,
    } : undefined,

    // Production-specific config
    build: !isDev ? {
      minify: 'terser',
      sourcemap: false,
    } : {
      minify: false,
      sourcemap: true,
    },

    define: {
      __DEV__: JSON.stringify(isDev),
    },
  },
});

// Usage:
// pnpm dev                           # Builds all platforms in dev mode
// SPRINGBOARD_PLATFORM=browser pnpm dev    # Only browser platform
// SPRINGBOARD_PLATFORM=node pnpm build     # Only node platform for production
