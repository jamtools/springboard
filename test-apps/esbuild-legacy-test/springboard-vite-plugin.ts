/**
 * Springboard Vite Plugin (Local Development Version)
 *
 * This is a simplified version for testing in the test app.
 * Once working, it will be moved to packages/springboard/vite-plugin/
 */

import { Plugin } from 'vite';
import path from 'path';

type SpringboardPluginOptions = {
  entry: string;
  documentMeta?: Record<string, string>;
};

export default function springboard(options: SpringboardPluginOptions): Plugin {
  // Parse SPRINGBOARD_PLATFORM env var
  const platformsEnv = process.env.SPRINGBOARD_PLATFORM || 'node,web';
  const platforms = platformsEnv.split(',').map(p => p.trim());

  // Validate platforms
  const serverPlatforms = platforms.filter(p => p === 'node');
  const clientPlatforms = platforms.filter(p => p === 'web');

  if (serverPlatforms.length > 1) {
    throw new Error('Cannot specify more than one server-side platform');
  }
  if (clientPlatforms.length > 1) {
    throw new Error('Cannot specify more than one client-side platform');
  }

  const hasNode = serverPlatforms.length > 0;
  const hasWeb = clientPlatforms.length > 0;

  console.log(`Springboard Vite Plugin: Building for platforms: ${platforms.join(', ')}`);

  // Virtual module IDs
  const VIRTUAL_ENTRY_ID = 'virtual:springboard-entry';
  const RESOLVED_VIRTUAL_ENTRY_ID = '\0' + VIRTUAL_ENTRY_ID;

  // Generate virtual entry module code
  const generateEntryCode = (platform: 'node' | 'web'): string => {
    if (platform === 'web') {
      return `
import { startAndRenderBrowserApp } from 'springboard/platforms/browser/entrypoints/react_entrypoint';
import '${options.entry}';

startAndRenderBrowserApp({
  rpc: {
    send: () => {},
    receive: () => {},
  },
  storage: {
    get: async (key) => localStorage.getItem(key),
    set: async (key, value) => localStorage.setItem(key, value),
    delete: async (key) => localStorage.removeItem(key),
  },
  dev: {
    reloadCss: false,
    reloadJs: false,
  },
});
`;
    } else if (platform === 'node') {
      return `
import initApp from 'springboard/platforms/node/entrypoints/node_server_entrypoint';
import '${options.entry}';

initApp();
`;
    }
    throw new Error(`Unsupported platform: ${platform}`);
  };

  return {
    name: 'springboard',

    config(config, env) {
      // Determine which platform to build based on SPRINGBOARD_PLATFORM
      const buildPlatform = hasWeb ? 'web' : hasNode ? 'node' : null;

      if (!buildPlatform) {
        throw new Error('No valid platform specified in SPRINGBOARD_PLATFORM');
      }

      // Configure Vite based on platform
      if (buildPlatform === 'node') {
        // Node builds use SSR mode
        return {
          build: {
            ssr: true,
            rollupOptions: {
              input: VIRTUAL_ENTRY_ID,
              external: [
                'better-sqlite3',
                '@hono/node-server',
                'hono',
                'kysely',
              ],
            },
          },
        };
      } else {
        // Web builds use standard client mode
        return {
          build: {
            rollupOptions: {
              input: VIRTUAL_ENTRY_ID,
            },
          },
        };
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return RESOLVED_VIRTUAL_ENTRY_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ENTRY_ID) {
        // Determine which platform to build
        const buildPlatform = hasWeb ? 'web' : hasNode ? 'node' : null;

        if (!buildPlatform) {
          throw new Error('No valid platform specified in SPRINGBOARD_PLATFORM');
        }

        return generateEntryCode(buildPlatform);
      }
    },
  };
}
