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

import { PluginOption, ViteDevServer } from 'vite';
import * as path from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, type Duplex } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { applyPlatformTransform } from './plugins/platform-inject.js';

// Vite 6+ types (ModuleRunner not exported from vite types but available at runtime)
type ModuleRunner = {
  import: <TModule>(url: string) => Promise<TModule>;
  close: () => void;
};

type ViteEnvironments = {
  ssr: unknown;
};

type ViteDevServerWithEnvironments = ViteDevServer & {
  environments: ViteEnvironments;
};

type WsAdapter = {
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;
  closeAll: (code?: number, data?: string | Buffer, force?: boolean) => void;
};

type DevServerHandle = {
  fetch: (request: Request) => Promise<Response>;
  ws?: WsAdapter;
  dispose?: () => Promise<void> | void;
};

type DevServerModule = {
  createDevServer: () => Promise<DevServerHandle> | DevServerHandle;
};

type RequestInitWithDuplex = RequestInit & {
  duplex?: 'half';
};

type PlatformKey = 'node' | 'browser' | 'web';

const FALLBACK_HEADER = 'x-springboard-fallback';
const SPRINGBOARD_GENERATED_DIR = path.join('node_modules', '.springboard');

const createRequestFromNode = (req: IncomingMessage): Request => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
    }
  }

  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    const requestBody = Readable.toWeb(req) as unknown as BodyInit;
    const requestInit: RequestInitWithDuplex = {
      method,
      headers,
      body: requestBody,
      duplex: 'half',
    };
    return new Request(url, requestInit);
  }

  return new Request(url, { method, headers });
};

const applyResponseToNode = async (res: ServerResponse, response: Response, method: string): Promise<void> => {
  res.statusCode = response.status;
  if (response.statusText) {
    res.statusMessage = response.statusText;
  }

  const headers = response.headers;
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') {
      continue;
    }
    res.setHeader(key, value);
  }

  const setCookie = 'getSetCookie' in headers
    ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
    : [];
  if (setCookie.length > 0) {
    res.setHeader('set-cookie', setCookie);
  }

  if (method === 'HEAD' || response.body === null) {
    res.end();
    return;
  }

  const webStream = response.body as unknown as NodeReadableStream<Uint8Array>;
  const body = Readable.fromWeb(webStream);
  body.on('error', (err) => {
    res.destroy(err);
  });
  body.pipe(res);
};

export type SpringboardOptions = {
  entry: string | Partial<Record<PlatformKey, string>>;
  documentMeta?: Record<string, string>;
  /** Port for the node dev server (default: 1337) */
  nodeServerPort?: number;
  /** Platforms to build for (default: ['node', 'browser']) */
  platforms?: Array<'node' | 'browser' | 'web'>;
};

export function springboard(options: SpringboardOptions): PluginOption {
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
  let originalWebHtml: string | null | undefined;
  let generatedWebHtml = false;

  // Get the directory where this file is located (will be in dist/ when built)
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // Templates are in src/templates/ relative to the package root
  // When running from dist/, we need to go up one level and into src/templates/
  const templatesDir = path.resolve(currentDir, '../src/templates');

  // Helper to get project root (where node_modules/.springboard/ will be created)
  const getProjectRoot = () => {
    // __dirname would be the test app directory in dev, or node_modules in production
    // We need to find the actual project root
    return process.cwd();
  };

  const projectRoot = getProjectRoot();

  const resolveEntry = (platform: 'node' | 'browser'): string => {
    if (typeof options.entry === 'string') {
      return options.entry;
    }

    const platformKey = platform === 'browser' ? 'browser' : 'node';
    const entry = options.entry[platformKey] ?? options.entry.web ?? options.entry.browser ?? options.entry.node;
    if (!entry) {
      throw new Error(`No entry configured for Springboard ${platform} platform`);
    }
    return entry;
  };
  const SPRINGBOARD_DIR = path.resolve(projectRoot, SPRINGBOARD_GENERATED_DIR);
  const WEB_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'web-entry.js');
  const WEB_HTML_FILE = path.join(projectRoot, 'index.html'); // At project root for Vite
  const NODE_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'node-entry.ts');
  const NODE_DEV_ENTRY_FILE = path.join(SPRINGBOARD_DIR, 'node-dev-entry.ts');

  // Load HTML template
  const htmlTemplate = readFileSync(
    path.join(templatesDir, 'index.template.html'),
    'utf-8'
  );

  // Generate HTML for dev and build modes
  const generateHtml = (entryScriptSrc: string): string => {
    const meta = options.documentMeta || {};
    const title = meta.title || 'Springboard App';
    const description = meta.description || '';

    return htmlTemplate
      .replace('{{TITLE}}', title)
      .replace('{{DESCRIPTION_META}}', description ? `<meta name="description" content="${description}">` : '')
      .replace('{{ENTRY_SCRIPT_SRC}}', entryScriptSrc);
  };

  // Load entry templates
  const webEntryTemplate = readFileSync(
    path.join(templatesDir, 'web-entry.template.ts'),
    'utf-8'
  );
  const nodeEntryTemplate = readFileSync(
    path.join(templatesDir, 'node-entry.template.ts'),
    'utf-8'
  );
  const nodeDevEntryTemplate = readFileSync(
    path.join(templatesDir, 'node-dev-entry.template.ts'),
    'utf-8'
  );
  const restoreGeneratedWebHtml = () => {
    if (!generatedWebHtml || isDevMode) {
      return;
    }

    if (typeof originalWebHtml === 'string') {
      writeFileSync(WEB_HTML_FILE, originalWebHtml, 'utf-8');
    } else if (originalWebHtml === null && existsSync(WEB_HTML_FILE)) {
      unlinkSync(WEB_HTML_FILE);
    }

    generatedWebHtml = false;
    originalWebHtml = undefined;
  };

  return {
    name: 'springboard',
    enforce: 'pre', // Run before other plugins (especially before TypeScript transformation)

    applyToEnvironment(environment) {
      // Apply to all environments (we'll check which one in transform hook)
      const envName = 'name' in environment ? (environment as { name: string }).name : 'unknown';
      console.log('[springboard] applyToEnvironment called for environment:', envName);
      return true;
    },

    buildStart() {
      // Create node_modules/.springboard directory if it doesn't exist
      if (!existsSync(SPRINGBOARD_DIR)) {
        mkdirSync(SPRINGBOARD_DIR, { recursive: true });
      }

      // Generate physical entry files based on platform
      const buildPlatform = hasWeb ? 'browser' : hasNode ? 'node' : null;

      // Calculate the correct import path from node_modules/.springboard/ to the user's entry file
      const platformEntry = resolveEntry(buildPlatform ?? 'browser');
      const absoluteEntryPath = path.isAbsolute(platformEntry)
        ? platformEntry
        : path.resolve(projectRoot, platformEntry);

      // Then calculate the relative path from node_modules/.springboard/ to the entry file
      const relativeEntryPath = path.relative(SPRINGBOARD_DIR, absoluteEntryPath);

      if (buildPlatform === 'browser') {
        // Generate web entry file
        const webEntryCode = webEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);
        writeFileSync(WEB_ENTRY_FILE, webEntryCode, 'utf-8');

        // Generate HTML file at project root that references the web entry (relative path for Vite processing)
        if (!generatedWebHtml) {
          originalWebHtml = existsSync(WEB_HTML_FILE) ? readFileSync(WEB_HTML_FILE, 'utf-8') : null;
        }
        const buildHtml = generateHtml(`./${SPRINGBOARD_GENERATED_DIR}/web-entry.js`);
        writeFileSync(WEB_HTML_FILE, buildHtml, 'utf-8');
        generatedWebHtml = true;

        console.log('[springboard] Generated web entry file in node_modules/.springboard/');
      } else if (buildPlatform === 'node') {
        // Generate node entry file with user entry injected and port configured
        const port = options.nodeServerPort ?? 1337;
        const nodeEntryCode = nodeEntryTemplate
          .replace('__USER_ENTRY__', relativeEntryPath)
          .replace('__PORT__', String(port));
        writeFileSync(NODE_ENTRY_FILE, nodeEntryCode, 'utf-8');

        console.log('[springboard] Generated node entry file in node_modules/.springboard/');
      }
    },

    writeBundle() {
      restoreGeneratedWebHtml();
    },

    closeBundle() {
      restoreGeneratedWebHtml();
    },

    config(config, env) {
      // Set dev mode flag based on Vite's command
      isDevMode = env.command === 'serve';

      const existingOutput = Array.isArray(config.build?.rollupOptions?.output)
        ? config.build?.rollupOptions?.output[0] ?? {}
        : config.build?.rollupOptions?.output ?? {};

      if (isDevMode && hasNode) {
        return {
          server: {
            perEnvironmentStartEndDuringDev: true,
            perEnvironmentWatchChangeDuringDev: true,
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
              output: {
                ...existingOutput,
                format: existingOutput.format ?? 'esm',
                entryFileNames: existingOutput.entryFileNames ?? 'node-entry.mjs',
              },
              external: [
                'better-sqlite3',
              ],
            },
          },
        };
      } else {
        // Web builds use standard client mode with HTML entry
        return {
          build: {
            rollupOptions: {
              input: WEB_HTML_FILE, // HTML file so Vite can process and hash assets
            },
          },
        };
      }
    },

    configureServer(server: ViteDevServer) {
      let runner: ModuleRunner | null = null;
      let currentFetch: ((request: Request) => Promise<Response>) | null = null;
      let currentWs: WsAdapter | null = null;
      let currentDispose: (() => Promise<void> | void) | null = null;
      let reloadInFlight: Promise<void> | null = null;

      const stopDevServer = async () => {
        if (currentDispose) {
          await currentDispose();
        }
        if (currentWs) {
          currentWs.closeAll();
        }
        currentFetch = null;
        currentWs = null;
        currentDispose = null;
        if (runner) {
          runner.close();
          runner = null;
        }
      };

      const startDevServer = async () => {
        try {
          const viteModule = await import('vite') as unknown as {
            createServerModuleRunner: (env: ViteDevServerWithEnvironments['environments']['ssr']) => ModuleRunner;
          };

          const serverWithEnv = server as ViteDevServerWithEnvironments;
          runner = viteModule.createServerModuleRunner(serverWithEnv.environments.ssr);

          const mod = await runner.import<DevServerModule>(NODE_DEV_ENTRY_FILE);
          if (!mod || typeof mod.createDevServer !== 'function') {
            console.error('[springboard] Node dev entry does not export createDevServer()');
            return;
          }

          const handle = await mod.createDevServer();
          currentFetch = handle.fetch;
          currentWs = handle.ws ?? null;
          currentDispose = handle.dispose ?? null;
        } catch (err) {
          console.error('[springboard] Failed to start node dev server:', err);
        }
      };

      const reloadDevServer = async () => {
        if (reloadInFlight) {
          return reloadInFlight;
        }

        reloadInFlight = (async () => {
          await stopDevServer();
          await startDevServer();
        })();

        try {
          await reloadInFlight;
        } finally {
          reloadInFlight = null;
        }

        return undefined;
      };

      server.middlewares.use(async (req, res, next) => {
        if (!currentFetch) {
          next();
          return;
        }

        try {
          const request = createRequestFromNode(req);
          const response = await currentFetch(request);

          if (response.headers.get(FALLBACK_HEADER) === '1') {
            next();
            return;
          }

          await applyResponseToNode(res, response, request.method);
        } catch (err) {
          next(err as Error);
        }
      });

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!currentWs) {
          return;
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname !== '/ws') {
          return;
        }

        void currentWs.handleUpgrade(req, socket, head);
      });

      // Clean up when Vite dev server closes
      server.httpServer?.on('close', () => {
        void stopDevServer();
      });

      return async () => {
        // Serve HTML for / and /index.html
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            const devEntrySrc = `/@fs/${WEB_ENTRY_FILE.split(path.sep).join('/')}`;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            // Let Vite transform the HTML (for HMR injection)
            server.transformIndexHtml(req.url, generateHtml(devEntrySrc)).then(transformed => {
              res.end(transformed);
            }).catch(next);
            return;
          }
          next();
        });

        if (!hasNode) {
          console.log('[springboard] Browser-only mode - not starting node server');
          return;
        }

        if (!existsSync(SPRINGBOARD_DIR)) {
          mkdirSync(SPRINGBOARD_DIR, { recursive: true });
        }

        // Calculate the correct import path from node_modules/.springboard/ to the user's entry file
        const platformEntry = resolveEntry('node');
        const absoluteEntryPath = path.isAbsolute(platformEntry)
          ? platformEntry
          : path.resolve(projectRoot, platformEntry);
        const relativeEntryPath = path.relative(SPRINGBOARD_DIR, absoluteEntryPath);

        const nodeDevEntryCode = nodeDevEntryTemplate.replace('__USER_ENTRY__', relativeEntryPath);
        writeFileSync(NODE_DEV_ENTRY_FILE, nodeDevEntryCode, 'utf-8');
        console.log('[springboard] Generated node dev entry file for single-port mode');

        await startDevServer();

        server.watcher.on('change', (file) => {
          const ssrModuleGraph = server.environments.ssr.moduleGraph;
          const changedModules = ssrModuleGraph.getModulesByFile(file);
          if (!changedModules || changedModules.size === 0) {
            return;
          }

          for (const moduleNode of changedModules) {
            ssrModuleGraph.invalidateModule(moduleNode);
          }
          void reloadDevServer();
        });
      };
    },

    transform(code: string, id: string) {
      const env = this.environment;
      const environmentName = env?.name || 'client';
      const buildPlatform = environmentName === 'ssr' ? 'node' : 'browser';

      // Debug logging (can be removed later)
      if (id.includes('tic_tac_toe.tsx') && code.includes('// @platform')) {
        console.log(`[springboard] Platform transform for ${buildPlatform} environment`);
      }

      // Apply platform transform (all logic is in platform-inject.ts)
      return applyPlatformTransform(code, id, buildPlatform);
    },

    transformIndexHtml(html, ctx) {
      return html;
    },
  };
}

// Default export
export default springboard;
