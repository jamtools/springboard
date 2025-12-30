/**
 * Springboard Vite Plugin (Local Development Version)
 *
 * This is a simplified version for testing in the test app.
 * Once working, it will be moved to packages/springboard/vite-plugin/
 */

import { Plugin, ViteDevServer } from 'vite';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';

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

  // Virtual module IDs
  const VIRTUAL_ENTRY_ID = 'virtual:springboard-entry';
  const RESOLVED_VIRTUAL_ENTRY_ID = '\0' + VIRTUAL_ENTRY_ID;

  // Generate HTML for dev and build modes
  const generateHtml = (): string => {
    const meta = options.documentMeta || {};
    const title = meta.title || 'Springboard App';
    const description = meta.description || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${description ? `<meta name="description" content="${description}">` : ''}
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
      }
      #root:empty::before {
        content: 'Loading...';
        display: block;
        text-align: center;
        padding: 40px;
        font-family: system-ui, sans-serif;
        color: #718096;
      }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/@id/__x00__virtual:springboard-entry"></script>
</body>
</html>`;
  };

  // Generate virtual entry module code
  const generateEntryCode = (platform: 'node' | 'web', isDev: boolean): string => {
    if (platform === 'web') {
      if (isDev) {
        // In dev mode, use online_entrypoint which connects to the node server
        // The Vite proxy will forward /ws and /rpc to the node server at localhost:1337
        return `
import { startAndRenderBrowserApp } from 'springboard/platforms/browser/entrypoints/react_entrypoint';
import { BrowserJsonRpcClientAndServer } from 'springboard/platforms/browser/services/browser_json_rpc';
import { HttpKvStoreClient } from 'springboard/core/services/http_kv_store_client';
import { BrowserKVStoreService } from 'springboard/platforms/browser/services/browser_kvstore_service';
import '${options.entry}';

// Connect to node server via Vite proxy
// WebSocket will connect to ws://localhost:5173/ws (Vite dev server)
// which proxies to ws://localhost:1337/ws (node server)
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const httpProtocol = location.protocol === 'https:' ? 'https' : 'http';
const wsUrl = \`\${wsProtocol}://\${location.host}/ws\`;
const httpUrl = \`\${httpProtocol}://\${location.host}\`;

// Use 'http' protocol for RPC - it will send HTTP POST requests to /rpc/*
// The WebSocket is used for server-to-client notifications
const rpc = new BrowserJsonRpcClientAndServer(wsUrl, 'http');
const remoteKvStore = new HttpKvStoreClient(httpUrl);
const userAgentKvStore = new BrowserKVStoreService(localStorage);

startAndRenderBrowserApp({
  rpc: {
    remote: rpc,
    local: undefined,
  },
  storage: {
    userAgent: userAgentKvStore,
    remote: remoteKvStore,
  },
  dev: {
    reloadCss: false,
    reloadJs: false,
  },
});
`;
      } else {
        // In build mode, use mock implementations (offline mode)
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

    config(config, env) {
      // Set dev mode flag based on Vite's command
      isDevMode = env.command === 'serve';

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

        // Use isDevMode flag to determine which entry code to generate
        return generateEntryCode(buildPlatform, isDevMode);
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

      const port = options.nodeServerPort ?? 1337;
      let nodeProcess: ChildProcess | null = null;
      let isShuttingDown = false;
      let restartTimeout: NodeJS.Timeout | null = null;

      const startNodeServer = () => {
        if (isShuttingDown) {
          return;
        }

        const nodeServerPath = path.resolve(__dirname, 'node-dev-server.ts');

        console.log('[springboard] Starting node dev server...');
        console.log(`[springboard]   Path: ${nodeServerPath}`);
        console.log(`[springboard]   Port: ${port}`);

        nodeProcess = spawn('npx', ['tsx', nodeServerPath], {
          cwd: __dirname,
          env: {
            ...process.env,
            PORT: String(port),
            NODE_ENV: 'development',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        });

        // Pipe stdout with prefix
        nodeProcess.stdout?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              console.log(`[node-server] ${line}`);
            }
          }
        });

        // Pipe stderr with prefix
        nodeProcess.stderr?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              console.error(`[node-server] ${line}`);
            }
          }
        });

        // Handle process exit
        nodeProcess.on('close', (code: number | null) => {
          if (isShuttingDown) {
            console.log('[springboard] Node server stopped');
            return;
          }

          console.log(`[springboard] Node server exited with code ${code}`);

          // Restart on error after a delay
          if (code !== 0 && !isShuttingDown) {
            console.log('[springboard] Restarting node server in 2 seconds...');
            restartTimeout = setTimeout(() => {
              startNodeServer();
            }, 2000);
          }
        });

        nodeProcess.on('error', (error: Error) => {
          console.error('[springboard] Failed to start node server:', error.message);
        });
      };

      const stopNodeServer = () => {
        isShuttingDown = true;

        if (restartTimeout) {
          clearTimeout(restartTimeout);
          restartTimeout = null;
        }

        if (nodeProcess) {
          console.log('[springboard] Stopping node server...');
          nodeProcess.kill('SIGTERM');

          // Force kill after 5 seconds if graceful shutdown fails
          const forceKillTimeout = setTimeout(() => {
            if (nodeProcess && !nodeProcess.killed) {
              console.log('[springboard] Force killing node server...');
              nodeProcess.kill('SIGKILL');
            }
          }, 5000);

          nodeProcess.on('close', () => {
            clearTimeout(forceKillTimeout);
          });

          nodeProcess = null;
        }
      };

      // Start the node server when Vite dev server starts
      startNodeServer();

      // Configure proxy middleware to forward API requests to node server
      const nodeServerTarget = `http://localhost:${port}`;

      // Common proxy options for logging and error handling
      const createProxyOptions = (pathName: string): ProxyOptions => ({
        target: nodeServerTarget,
        changeOrigin: true,
        on: {
          proxyReq: (proxyReq, req) => {
            console.log(`[proxy] ${req.method} ${req.url} -> ${nodeServerTarget}${req.url}`);
          },
          proxyRes: (proxyRes, req) => {
            console.log(`[proxy] ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
          },
          error: (err, req, res) => {
            console.error(`[proxy] Error proxying ${req.url}:`, err.message);
            // Only send error response if res is a ServerResponse and headers not sent
            if (res && 'writeHead' in res && !res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
              (res as import('http').ServerResponse).end(JSON.stringify({
                error: 'Proxy Error',
                message: `Failed to connect to node server at ${nodeServerTarget}`,
                details: err.message,
              }));
            }
          },
        },
      });

      // WebSocket proxy options for /ws route
      const wsProxyOptions: ProxyOptions = {
        ...createProxyOptions('/ws'),
        ws: true,
        on: {
          ...createProxyOptions('/ws').on,
          proxyReqWs: (proxyReq, req, socket) => {
            console.log(`[proxy] WebSocket upgrade: ${req.url} -> ${nodeServerTarget}${req.url}`);
          },
        },
      };

      // Create proxy middleware instances
      const rpcProxy = createProxyMiddleware(createProxyOptions('/rpc'));
      const kvProxy = createProxyMiddleware(createProxyOptions('/kv'));
      const wsProxy = createProxyMiddleware(wsProxyOptions);

      // Add proxy middleware to Vite's connect server
      // Order matters: more specific routes first
      server.middlewares.use('/rpc', rpcProxy);
      server.middlewares.use('/kv', kvProxy);
      server.middlewares.use('/ws', wsProxy);

      console.log('[springboard] Proxy configured:');
      console.log(`[springboard]   /rpc/* -> ${nodeServerTarget}/rpc/*`);
      console.log(`[springboard]   /kv/*  -> ${nodeServerTarget}/kv/*`);
      console.log(`[springboard]   /ws    -> ${nodeServerTarget}/ws (WebSocket)`);

      // Handle WebSocket upgrade requests
      // Vite's httpServer needs to forward upgrade requests to our proxy
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws')) {
          console.log(`[proxy] WebSocket upgrade request: ${req.url}`);
          // The wsProxy middleware handles the upgrade via the 'ws: true' option
          // We need to manually trigger the upgrade since it's not going through middlewares
          (wsProxy as unknown as { upgrade: (req: import('http').IncomingMessage, socket: import('net').Socket, head: Buffer) => void }).upgrade(req, socket, head);
        }
      });

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
