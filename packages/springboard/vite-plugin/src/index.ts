/**
 * Springboard Vite Plugin
 *
 * A single, unified Vite plugin that handles multi-platform builds for Springboard apps.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { springboard } from 'springboard/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: springboard({
 *     entry: './src/index.tsx',
 *     platforms: ['browser', 'node'],
 *     documentMeta: {
 *       title: 'My App',
 *     },
 *     nodeServerPort: 3001,
 *   }),
 * });
 * ```
 *
 * @packageDocumentation
 */

import { Plugin, ViteDevServer } from 'vite';
import * as path from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { applyPlatformTransform } from './plugins/platform-inject.js';

// Vite 6+ types (ModuleRunner not exported from vite types but available at runtime)
type ModuleRunner = {
  import: (url: string) => Promise<any>;
  close: () => void;
};

type ViteEnvironments = {
  ssr: unknown;
};

type ViteDevServerWithEnvironments = ViteDevServer & {
  environments: ViteEnvironments;
};

export type SpringboardOptions = {
  entry: string;
  documentMeta?: Record<string, string>;
  /** Port for the node dev server (default: 1337) */
  nodeServerPort?: number;
  /** Platforms to build for (default: ['node', 'browser']) */
  platforms?: Array<'node' | 'browser' | 'web'>;
};

export function springboard(options: SpringboardOptions): Plugin {
  // Parse platforms from options or env var
  const platformsFromOptions = options.platforms || [];
  const platformsEnv = process.env.SPRINGBOARD_PLATFORM || '';
  const platformsFromEnv = platformsEnv ? platformsEnv.split(',').map(p => p.trim()) : [];

  // Combine and normalize platforms (web -> browser)
  const platforms = [...platformsFromOptions, ...platformsFromEnv]
    .map(p => p === 'web' ? 'browser' : p)
    .filter((p, i, arr) => arr.indexOf(p) === i); // dedupe

  // Default to both platforms if none specified
  const finalPlatforms = platforms.length > 0 ? platforms : ['node', 'browser'];

  const hasNode = finalPlatforms.includes('node');
  const hasWeb = finalPlatforms.includes('browser');

  console.log(`Springboard Vite Plugin: Building for platforms: ${finalPlatforms.join(', ')}`);

  // Track whether we're in dev mode (set by config hook)
  let isDevMode = false;

  // Get the directory where this file is located (will be in dist/ when built)
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // Templates are in src/templates/ relative to the package root
  // When running from dist/, we need to go up one level and into src/templates/
  const templatesDir = path.resolve(currentDir, '../src/templates');

  // Helper to get project root (where .springboard/ will be created)
  const getProjectRoot = () => {
    // __dirname would be the test app directory in dev, or node_modules in production
    // We need to find the actual project root
    return process.cwd();
  };

  const projectRoot = getProjectRoot();
  const SPRINGBOARD_DIR = path.resolve(projectRoot, '.springboard');
  const DEV_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'dev-entry.js');
  const BUILD_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'build-entry.js');
  const NODE_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'node-entry.ts');

  // Load HTML template
  const htmlTemplate = readFileSync(
    path.join(templatesDir, 'index.template.html'),
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
    path.join(templatesDir, 'browser-dev-entry.template.ts'),
    'utf-8'
  );
  const buildEntryTemplate = readFileSync(
    path.join(templatesDir, 'browser-build-entry.template.ts'),
    'utf-8'
  );
  const nodeEntryTemplate = readFileSync(
    path.join(templatesDir, 'node-entry.template.ts'),
    'utf-8'
  );

  return {
    name: 'springboard',

    applyToEnvironment(environment) {
      // Apply to all environments (we'll check which one in transform hook)
      const envName = 'name' in environment ? (environment as { name: string }).name : 'unknown';
      console.log('[springboard] applyToEnvironment called for environment:', envName);
      return true;
    },

    buildStart() {
      // Create .springboard directory if it doesn't exist
      if (!existsSync(SPRINGBOARD_DIR)) {
        mkdirSync(SPRINGBOARD_DIR, { recursive: true });
      }

      // Generate physical entry files based on platform
      const buildPlatform = hasWeb ? 'browser' : hasNode ? 'node' : null;

      // Calculate the correct import path from .springboard/ to the user's entry file
      const absoluteEntryPath = path.isAbsolute(options.entry)
        ? options.entry
        : path.resolve(projectRoot, options.entry);

      // Then calculate the relative path from .springboard/ to the entry file
      const relativeEntryPath = path.relative(SPRINGBOARD_DIR, absoluteEntryPath);

      if (buildPlatform === 'browser') {
        // Generate dev and build entry files for web platform
        const devEntryCode = devEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);
        const buildEntryCode = buildEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);

        writeFileSync(DEV_ENTRY_FILE, devEntryCode, 'utf-8');
        writeFileSync(BUILD_ENTRY_FILE, buildEntryCode, 'utf-8');

        console.log('[springboard] Generated web entry files in .springboard/');
      } else if (buildPlatform === 'node') {
        // Generate node entry file with user entry injected and port configured
        const port = options.nodeServerPort ?? 1337;
        const nodeEntryCode = nodeEntryTemplate
          .replace('__USER_ENTRY__', relativeEntryPath)
          .replace('__PORT__', String(port));
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
            ],
          }
        };
      }

      // Determine which platform to build based on SPRINGBOARD_PLATFORM
      const buildPlatform = hasWeb ? 'browser' : hasNode ? 'node' : null;

      if (!buildPlatform) {
        throw new Error('No valid platform specified');
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
          console.log('[springboard] Browser-only mode - not starting node server');
          return;
        }

      // Generate node entry file for dev mode
      if (!existsSync(SPRINGBOARD_DIR)) {
        mkdirSync(SPRINGBOARD_DIR, { recursive: true });
      }

      // Calculate the correct import path from .springboard/ to the user's entry file
      const absoluteEntryPath = path.isAbsolute(options.entry)
        ? options.entry
        : path.resolve(projectRoot, options.entry);
      const relativeEntryPath = path.relative(SPRINGBOARD_DIR, absoluteEntryPath);

      const port = options.nodeServerPort ?? 1337;
      const nodeEntryCode = nodeEntryTemplate
        .replace('__USER_ENTRY__', relativeEntryPath)
        .replace('__PORT__', String(port));
      writeFileSync(NODE_ENTRY_FILE, nodeEntryCode, 'utf-8');
      console.log('[springboard] Generated node entry file for dev mode');

      let runner: ModuleRunner | null = null;
      let nodeEntryModule: { start?: () => Promise<void>; stop?: () => Promise<void> } | null = null;

      // Start the node server using Vite 6+ ModuleRunner API
      const startNodeServer = async () => {
        try {
          // Dynamically import createServerModuleRunner (Vite 6+ API)
          // Type assertion needed because we're building with Vite 5 types but running with Vite 6+
          const viteModule = await import('vite') as unknown as {
            createServerModuleRunner: (env: unknown) => ModuleRunner;
          };

          // Create module runner with HMR support
          const serverWithEnv = server as ViteDevServerWithEnvironments;
          runner = viteModule.createServerModuleRunner(serverWithEnv.environments.ssr);

          // Load and execute the node entry module
          nodeEntryModule = await runner.import(NODE_ENTRY_FILE);

          // Call the exported start() function
          if (nodeEntryModule && typeof nodeEntryModule.start === 'function') {
            await nodeEntryModule.start();
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
            if (nodeEntryModule?.stop && typeof nodeEntryModule.stop === 'function') {
              await nodeEntryModule.stop();
              console.log('[springboard] Node server stopped manually');
            }

            // Then close the runner (renamed from destroy() in Vite 6+)
            runner.close();
            runner = null;
            nodeEntryModule = null;
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

    transform(code: string, id: string) {
      // Debug: Log that transform was called
      if (id.includes('tic_tac_toe')) {
        console.log(`[springboard] Transform called for: ${id}`);
      }

      // Determine target platform based on the current environment
      // Vite has 'client' and 'ssr' environments by default
      // @ts-ignore - this.environment is available in Vite 6+
      const environmentName = this.environment?.name || 'client';

      // Map environment name to platform
      // 'client' environment = browser code
      // 'ssr' environment = node code
      const buildPlatform = environmentName === 'ssr' ? 'node' : 'browser';

      // Debug logging
      if (code.includes('// @platform')) {
        console.log(`[springboard] Transform detected @platform in ${id}`);
        console.log(`[springboard] Environment: ${environmentName}, Platform: ${buildPlatform}`);
      }

      // Apply platform transform (all logic is in platform-inject.ts)
      return applyPlatformTransform(code, id, buildPlatform);
    },

    transformIndexHtml() {
      // For build mode, return the HTML so Vite can inject the fingerprinted script
      return generateHtml();
    },
  };
}

// Default export
export default springboard;
