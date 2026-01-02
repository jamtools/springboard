import {serve} from '@hono/node-server';

import {makeWebsocketServerCoreDependenciesWithSqlite} from '../services/ws_server_core_dependencies';
import {initApp} from '../../../server/hono_app';
import {startNodeApp} from './main';

/**
 * Self-contained Node.js server entrypoint.
 *
 * This entrypoint creates its own server infrastructure (Hono + WebSocket),
 * calls startNodeApp() with the created dependencies, starts the server,
 * and keeps running.
 *
 * This is designed to be used as the default export for bundled Node builds,
 * where no external dependency injection is needed.
 */
export default async () => {
    try {
        // Create core dependencies (SQLite-backed KV store)
        const coreDeps = await makeWebsocketServerCoreDependenciesWithSqlite();

        // Initialize Hono app with WebSocket support and get node app dependencies
        const {app, injectWebSocket, nodeAppDependencies} = initApp(coreDeps);

        // Get port from environment or use default
        const port = parseInt(process.env.PORT || '1337', 10);

        // Start the HTTP server
        const server = serve({
            fetch: app.fetch,
            port,
        }, (info) => {
            console.log(`Server listening on http://localhost:${info.port}`);
        });

        // Inject WebSocket support into the server
        injectWebSocket(server);

        // Start the Node application with the server dependencies
        const engine = await startNodeApp(nodeAppDependencies);
        console.log('Node application started successfully');

        // Set up graceful shutdown handlers
        let isShuttingDown = false;
        const shutdown = () => {
            if (isShuttingDown) {
                // Force exit if already shutting down
                console.log('Force shutting down...');
                process.exit(1);
            }
            isShuttingDown = true;

            console.log('Received shutdown signal, closing server...');

            // Force exit after 5 seconds if graceful shutdown fails
            const forceExitTimeout = setTimeout(() => {
                console.log('Graceful shutdown timed out, forcing exit...');
                process.exit(1);
            }, 5000);

            // Close the server and exit
            server.close(() => {
                clearTimeout(forceExitTimeout);
                console.log('Server closed successfully');
                process.exit(0);
            });

            // Also immediately stop accepting new connections
            // server.closeAllConnections?.();
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        return engine;
    } catch (error) {
        console.error('Failed to start node server:', error);
        process.exit(1);
    }
};
