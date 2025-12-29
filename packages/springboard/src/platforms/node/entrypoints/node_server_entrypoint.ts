import {serve} from '@hono/node-server';

import {makeWebsocketServerCoreDependenciesWithSqlite} from '../../../server/ws_server_core_dependencies';
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

        // Keep the process alive - the server will handle incoming requests
        // The server.close() would be called on SIGTERM/SIGINT if needed
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM, shutting down...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('Received SIGINT, shutting down...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        return engine;
    } catch (error) {
        console.error('Failed to start node server:', error);
        process.exit(1);
    }
};
