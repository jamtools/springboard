/**
 * Springboard Vite Plugin (Local Development Version)
 *
 * This is a simplified version for testing in the test app.
 * Once working, it will be moved to packages/springboard/vite-plugin/
 */

import { Plugin, ViteDevServer, createServerModuleRunner, ModuleRunner } from 'vite';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

type SpringboardPluginOptions = {
  entry: string;
  documentMeta?: Record<string, string>;
  /** Port for the node dev server (default: 1337) */
  nodeServerPort?: number;
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

  // Track whether we're in dev mode (set by config hook)
  let isDevMode = false;

  // Physical entry file paths in .springboard/ directory
  const SPRINGBOARD_DIR = path.resolve(__dirname, '.springboard');
  const DEV_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'dev-entry.js');
  const BUILD_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'build-entry.js');
  const NODE_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'node-entry.ts');

  // Load HTML template
  const htmlTemplate = readFileSync(
    path.resolve(__dirname, 'virtual-entries/index.template.html'),
    'utf-8'
  );

  // Generate HTML for dev and build modes
  const generateHtml = (): string => {
    const meta = options.documentMeta || {};
    const title = meta.title || 'Springboard App';
    const description = meta.description || '';

    return htmlTemplate
      .replace('{{TITLE}}', title)
      .replace('{{DESCRIPTION_META}}', description ? `<meta name="description" content="${description}">` : '');
  };

  // Load entry templates
  const devEntryTemplate = readFileSync(
    path.resolve(__dirname, 'virtual-entries/dev-entry.template.ts'),
    'utf-8'
  );
  const buildEntryTemplate = readFileSync(
    path.resolve(__dirname, 'virtual-entries/build-entry.template.ts'),
    'utf-8'
  );
  const nodeEntryTemplate = readFileSync(
    path.resolve(__dirname, 'virtual-entries/node-entry.template.ts'),
    'utf-8'
  );

  // Generate virtual entry module code
  const generateEntryCode = (platform: 'node' | 'web', isDev: boolean): string => {
    if (platform === 'web') {
      if (isDev) {
        // In dev mode, connect to node server via Vite proxy
        return devEntryTemplate.replace('__USER_ENTRY__', options.entry);
      } else {
        // In build mode, use mock implementations (offline mode)
        return buildEntryTemplate.replace('__USER_ENTRY__', options.entry);
      }
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

    buildStart() {
      // Create .springboard directory if it doesn't exist
      if (!existsSync(SPRINGBOARD_DIR)) {
        mkdirSync(SPRINGBOARD_DIR, { recursive: true });
      }

      // Generate physical entry files based on platform
      const buildPlatform = hasWeb ? 'web' : hasNode ? 'node' : null;

      // Calculate the correct import path from .springboard/ to the user's entry file
      // First, resolve the absolute path to the entry file
      const absoluteEntryPath = path.isAbsolute(options.entry)
        ? options.entry
        : path.resolve(__dirname, options.entry);

      // Then calculate the relative path from .springboard/ to the entry file
      const relativeEntryPath = path.relative(SPRINGBOARD_DIR, absoluteEntryPath);

      if (buildPlatform === 'web') {
        // Generate dev and build entry files for web platform
        const devEntryCode = devEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);
        const buildEntryCode = buildEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);

        writeFileSync(DEV_ENTRY_FILE, devEntryCode, 'utf-8');
        writeFileSync(BUILD_ENTRY_FILE, buildEntryCode, 'utf-8');

        console.log('[springboard] Generated web entry files in .springboard/');
      } else if (buildPlatform === 'node') {
        // Generate node entry file with user entry injected
        const nodeEntryCode = nodeEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);
        writeFileSync(NODE_ENTRY_FILE, nodeEntryCode, 'utf-8');

        console.log('[springboard] Generated node entry file in .springboard/');
      }
    },

    config(config, env) {
      // Set dev mode flag based on Vite's command
      isDevMode = env.command === 'serve';

      // Dev mode with both platforms - configure Vite proxy and SSR
      if (isDevMode && hasNode && hasWeb) {
        const nodePort = options.nodeServerPort ?? 1337;

        return {
          server: {
            proxy: {
              '/rpc': {
                target: `http://localhost:${nodePort}`,
                changeOrigin: true,
              },
              '/kv': {
                target: `http://localhost:${nodePort}`,
                changeOrigin: true,
              },
              '/ws': {
                target: `ws://localhost:${nodePort}`,
                ws: true,
                changeOrigin: true,
              },
            },
          },
          build: {
            rollupOptions: {
              input: DEV_ENTRY_FILE,  // Browser entry
            }
          },
          ssr: {
            // External dependencies for SSR (node modules that shouldn't be bundled)
            noExternal: ['springboard'],
            external: [
              'better-sqlite3',
              // '@hono/node-server',
              // 'hono',
              // 'kysely',
            ],
          }
        };
      }

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
              input: NODE_ENTRY_FILE, // Physical file path
              external: [
                'better-sqlite3',
                // '@hono/node-server',
                // 'hono',
                // 'kysely',
              ],
            },
          },
        };
      } else {
        // Web builds use standard client mode
        // Use dev entry for dev server, build entry for production build
        const entryFile = isDevMode ? DEV_ENTRY_FILE : BUILD_ENTRY_FILE;

        return {
          build: {
            rollupOptions: {
              input: entryFile, // Physical file path
            },
          },
        };
      }
    },

    configureServer(server: ViteDevServer) {
      // First, add HTML serving middleware
      return () => {
        // Serve HTML for / and /index.html
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            // Let Vite transform the HTML (for HMR injection)
            server.transformIndexHtml(req.url, generateHtml()).then(transformed => {
              res.end(transformed);
            }).catch(next);
            return;
          }
          next();
        });

        // Only spawn node server if hasNode is true
        if (!hasNode) {
          console.log('[springboard] Web-only mode - not spawning node server');
          return;
        }

      // Generate node entry file for dev mode
      if (!existsSync(SPRINGBOARD_DIR)) {
        mkdirSync(SPRINGBOARD_DIR, { recursive: true });
      }

      // Calculate the correct import path from .springboard/ to the user's entry file
      const absoluteEntryPath = path.isAbsolute(options.entry)
        ? options.entry
        : path.resolve(__dirname, options.entry);
      const relativeEntryPath = path.relative(SPRINGBOARD_DIR, absoluteEntryPath);

      const nodeEntryCode = nodeEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);
      writeFileSync(NODE_ENTRY_FILE, nodeEntryCode, 'utf-8');
      console.log('[springboard] Generated node entry file for dev mode');

      const port = options.nodeServerPort ?? 1337;
      let runner: ModuleRunner | null = null;

      // Start the node server using Vite 6+ ModuleRunner API
      const startNodeServer = async () => {
        try {
          // Create module runner with HMR support (Vite 6+ API)
          runner = createServerModuleRunner(server.environments.ssr);

          // Load and execute the node entry module
          const nodeEntry = await runner.import(NODE_ENTRY_FILE);

          // Call the exported start() function
          if (typeof nodeEntry.start === 'function') {
            await nodeEntry.start();
            console.log('[springboard] Node server started via ModuleRunner');
          } else {
            console.error('[springboard] Node entry does not export a start() function');
          }
        } catch (err) {
          console.error('[springboard] Failed to start node server:', err);
        }
      };

      const stopNodeServer = async () => {
        if (runner) {
          try {
            // First, manually call stop() on the node entry module to close the HTTP server
            // This is necessary because when Vite restarts (e.g., config change),
            // the HMR dispose handler doesn't get called
            const nodeEntry = runner.moduleCache.get(NODE_ENTRY_FILE);
            if (nodeEntry?.exports?.stop && typeof nodeEntry.exports.stop === 'function') {
              await nodeEntry.exports.stop();
              console.log('[springboard] Node server stopped manually');
            }

            // Then close the runner (renamed from destroy() in Vite 6+)
            runner.close();
            runner = null;
            console.log('[springboard] Node server runner closed');
          } catch (err) {
            console.error('[springboard] Failed to stop node server:', err);
          }
        }
      };

      // Start the node server when Vite dev server starts
      startNodeServer();

      console.log('[springboard] Vite proxy configured via server.proxy:');
      console.log(`[springboard]   /rpc/* -> http://localhost:${port}/rpc/*`);
      console.log(`[springboard]   /kv/*  -> http://localhost:${port}/kv/*`);
      console.log(`[springboard]   /ws    -> ws://localhost:${port}/ws (WebSocket)`);

      // Clean up when Vite dev server closes
      server.httpServer?.on('close', () => {
        stopNodeServer();
      });

      // Note: We DON'T add our own SIGINT/SIGTERM handlers here
      // because Vite already handles those and will trigger the 'close' event
      // Adding our own handlers would interfere with Vite's shutdown process
      };
    },

    transformIndexHtml() {
      // For build mode, return the HTML so Vite can inject the fingerprinted script
      return generateHtml();
    },
  };
}
