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

// const platforms: ('browser' | 'node')[] = browserPlatforms.includes(platformVariant)
//   ? ['browser']
//   : nodePlatforms.includes(platformVariant)
//   ? ['node']
//   : ['browser']; // default

const platforms = ['browser', 'node'] as ['browser', 'node'];

console.log(`Building for platform variant: ${platformVariant}`);
console.log(`Entry: ${entry}`);
console.log(`Platforms: ${platforms.join(', ')}`);

export default defineConfig({
  plugins: [
    springboard({
      entry: {
        web: entryMap.browser_online,
        browser: entryMap.browser_online,
        node: entryMap.node_maestro,
      },
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
  define: {
    'process.env.DEBUG_LOG_PERFORMANCE': '""',
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: true,
  },
});
