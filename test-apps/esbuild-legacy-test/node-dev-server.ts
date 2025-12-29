/**
 * Node Dev Server Entrypoint for Vite Dev Mode
 *
 * This is a PHYSICAL file (not virtual) that can be spawned as a background
 * process during Vite dev mode. It handles:
 *
 * 1. SQLite database initialization (async, ~100ms)
 * 2. Hono app creation with all routes
 * 3. HTTP server startup
 * 4. WebSocket injection for real-time features
 * 5. Springboard engine initialization
 * 6. Graceful shutdown handling
 *
 * Why this file exists:
 * - @hono/vite-dev-server requires a physical file, not a virtual module
 * - We spawn Node server separately (not through Vite middleware)
 * - Gives full control over initialization order and error handling
 *
 * Usage:
 *   npx tsx node-dev-server.ts
 *   # or with environment variables:
 *   PORT=3001 SQLITE_DATABASE_FILE=data/dev.db npx tsx node-dev-server.ts
 */

import { serve } from '@hono/node-server';
import {
  initApp,
  makeWebsocketServerCoreDependenciesWithSqlite,
} from 'springboard/server';
import { startNodeApp } from 'springboard/platforms/node';

// Configuration from environment
const PORT = parseInt(process.env.PORT || '1337', 10);
const DEV_MODE = process.env.NODE_ENV !== 'production';

/**
 * Main server initialization function.
 *
 * This is an async IIFE that handles the full initialization sequence:
 * 1. Create SQLite-backed core dependencies
 * 2. Initialize Hono app with routes and WebSocket support
 * 3. Start HTTP server
 * 4. Inject WebSocket handler
 * 5. Start Springboard engine
 * 6. Set up shutdown handlers
 */
const main = async (): Promise<void> => {
  const startTime = Date.now();

  console.log('');
  console.log('========================================');
  console.log('Springboard Node Dev Server');
  console.log('========================================');
  console.log('');

  try {
    // Step 1: Initialize SQLite database
    // This is async and takes ~100ms on first run (creates tables)
    console.log('[1/5] Initializing SQLite database...');
    const coreDeps = await makeWebsocketServerCoreDependenciesWithSqlite();
    console.log('      Database ready');

    // Step 2: Create Hono app with all routes
    console.log('[2/5] Creating Hono app...');
    const { app, injectWebSocket, nodeAppDependencies } = initApp(coreDeps);
    console.log('      App created with routes: /ws, /kv/*, /rpc/*');

    // Step 3: Start HTTP server
    console.log(`[3/5] Starting HTTP server on port ${PORT}...`);
    const server = serve(
      {
        fetch: app.fetch,
        port: PORT,
      },
      (info) => {
        console.log(`      Server listening on http://localhost:${info.port}`);
      }
    );

    // Step 4: Inject WebSocket support
    console.log('[4/5] Injecting WebSocket handler...');
    injectWebSocket(server);
    console.log('      WebSocket ready at ws://localhost:' + PORT + '/ws');

    // Step 5: Initialize Springboard engine
    console.log('[5/5] Starting Springboard engine...');

    // Import the application module to register it
    // In dev mode, this would be the user's app entry point
    // For now, we import it dynamically if it exists
    try {
      await import('./src/tic_tac_toe.tsx');
      console.log('      Application module loaded');
    } catch (e) {
      // App module is optional in dev mode
      if (DEV_MODE) {
        console.log('      No application module found (this is OK in dev mode)');
      } else {
        throw e;
      }
    }

    const engine = await startNodeApp(nodeAppDependencies);
    console.log('      Engine initialized');

    // Startup complete
    const duration = Date.now() - startTime;
    console.log('');
    console.log('========================================');
    console.log(`Server ready in ${duration}ms`);
    console.log('========================================');
    console.log('');
    console.log(`  HTTP:      http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`  RPC:       http://localhost:${PORT}/rpc/*`);
    console.log(`  KV Store:  http://localhost:${PORT}/kv/*`);
    console.log('');
    if (DEV_MODE) {
      console.log('  Mode: Development');
      console.log('  Press Ctrl+C to stop');
    }
    console.log('');

    // Set up graceful shutdown handlers
    let isShuttingDown = false;

    const shutdown = (signal: string) => {
      if (isShuttingDown) {
        console.log('Force shutting down...');
        process.exit(1);
      }
      isShuttingDown = true;

      console.log('');
      console.log(`Received ${signal}, shutting down...`);

      // Force exit after 5 seconds if graceful shutdown fails
      const forceExitTimeout = setTimeout(() => {
        console.log('Graceful shutdown timed out, forcing exit...');
        process.exit(1);
      }, 5000);

      // Close the server
      server.close(() => {
        clearTimeout(forceExitTimeout);
        console.log('Server closed successfully');
        process.exit(0);
      });

      // Stop accepting new connections immediately (Node.js 18.2+)
      // Cast to any to handle type variance across Node.js versions
      (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Keep the process alive
    return;
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('Failed to start server');
    console.error('========================================');
    console.error('');
    console.error(error);
    console.error('');
    process.exit(1);
  }
};

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Start the server
main();
