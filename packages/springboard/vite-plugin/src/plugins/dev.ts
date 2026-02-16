/**
 * Springboard Dev Plugin
 *
 * Handles development server setup with HMR and ModuleRunner for node platform.
 */

import type { Plugin, ViteDevServer, ResolvedConfig } from 'vite';
import type { NormalizedOptions, NodeEntryModule, Platform } from '../types.js';
import { createLogger } from './shared.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Vite 6+ types (not available in Vite 5 types but available at runtime with Vite 6+)
type ModuleRunner = {
    import: (url: string) => Promise<NodeEntryModule>;
    close: () => void;
};

type ViteEnvironments = {
    ssr: unknown;
};

type ViteDevServerWithEnvironments = ViteDevServer & {
    environments: ViteEnvironments;
};

/**
 * Load the node entry template from the templates directory
 */
function loadNodeEntryTemplate(): string {
    // Get the directory of this file (will be in dist/plugins/ when built)
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    // Templates are in src/templates/, so from dist/plugins/ we go up to package root, then into src/templates/
    const templatePath = path.resolve(currentDir, '../../src/templates/node-entry.template.ts');
    return readFileSync(templatePath, 'utf-8');
}

/**
 * Generate node entry code with user entry path and port injected
 */
function generateNodeEntryCode(userEntryPath: string, port: number = 3000): string {
    const template = loadNodeEntryTemplate();
    return template
        .replace('__USER_ENTRY__', userEntryPath)
        .replace('__PORT__', String(port));
}

/**
 * Create the springboard dev plugin.
 *
 * Responsibilities:
 * - Configure HMR for browser platforms
 * - Start node server via ModuleRunner for server platforms
 * - Handle hot module replacement
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin
 */
export function springboardDev(options: NormalizedOptions): Plugin {
    const logger = createLogger('dev', options.debug);
    let resolvedConfig: ResolvedConfig;
    let server: ViteDevServer | null = null;
    let runner: ModuleRunner | null = null;
    let nodeEntryModule: NodeEntryModule | null = null;

    // Check if node platform is active
    const hasNode = options.platforms.includes('node');
    const hasBrowser = options.platforms.includes('browser');
    const nodePort = options.nodeServerPort;

    return {
        name: 'springboard:dev',
        apply: 'serve',

        /**
         * Store resolved config
         */
        configResolved(config) {
            resolvedConfig = config;
        },

        /**
         * Configure dev server with proxy and SSR for multi-platform setup
         */
        config(config, env) {
            // Only configure proxy and SSR when both node and browser platforms are active
            if (hasNode && hasBrowser) {
                logger.info('Configuring Vite proxy and SSR for multi-platform dev mode');

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
                    ssr: {
                        // noExternal fixes missing .js extensions in springboard imports
                        noExternal: ['springboard'],
                        // Only externalize true native modules
                        external: ['better-sqlite3'],
                    },
                };
            }

            return {};
        },

        /**
         * Configure the dev server
         */
        configureServer(devServer: ViteDevServer) {
            server = devServer;

            logger.info(`Dev server starting for platform: ${options.platform}`);

            // Return middleware setup function
            return () => {
                // Custom middleware for Springboard-specific routes
                devServer.middlewares.use((req, res, next) => {
                    // Handle /__springboard/ routes for debugging
                    if (req.url?.startsWith('/__springboard/')) {
                        handleSpringboardRoute(req, res, options);
                        return;
                    }
                    next();
                });

                // Only start node server if 'node' is one of the target platforms
                if (!hasNode) {
                    logger.debug('Node platform not active - skipping node server startup');
                    return;
                }

                // Generate and start node server
                const springboardDir = path.resolve(options.root, '.springboard');
                const nodeEntryFile = path.join(springboardDir, 'node-entry.ts');

                // Ensure .springboard directory exists
                if (!existsSync(springboardDir)) {
                    mkdirSync(springboardDir, { recursive: true });
                }

                // Calculate relative path from .springboard/ to user entry
                const absoluteEntryPath = path.isAbsolute(options.entry)
                    ? options.entry
                    : path.resolve(options.root, options.entry);
                const relativeEntryPath = path.relative(springboardDir, absoluteEntryPath);

                // Generate node entry file
                const nodeEntryCode = generateNodeEntryCode(relativeEntryPath, nodePort);
                writeFileSync(nodeEntryFile, nodeEntryCode, 'utf-8');
                logger.info('Generated node entry file for dev mode');

                // Start the node server using ModuleRunner
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
                        nodeEntryModule = await runner.import(nodeEntryFile);

                        // Call the exported start() function
                        if (nodeEntryModule && typeof nodeEntryModule.start === 'function') {
                            await nodeEntryModule.start();
                            logger.info('Node server started via ModuleRunner');
                        } else {
                            logger.error('Node entry does not export a start() function');
                        }
                    } catch (err) {
                        logger.error(`Failed to start node server: ${err}`);
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
                                logger.info('Node server stopped manually');
                            }

                            // Then close the runner (renamed from destroy() in Vite 6+)
                            runner.close();
                            runner = null;
                            nodeEntryModule = null;
                            logger.info('Node server runner closed');
                        } catch (err) {
                            logger.error(`Failed to stop node server: ${err}`);
                        }
                    }
                };

                // Start the node server when Vite dev server starts
                startNodeServer();

                logger.info('Vite proxy configured via server.proxy:');
                logger.info(`  /rpc/* -> http://localhost:${nodePort}/rpc/*`);
                logger.info(`  /kv/*  -> http://localhost:${nodePort}/kv/*`);
                logger.info(`  /ws    -> ws://localhost:${nodePort}/ws (WebSocket)`);

                // Clean up when Vite dev server closes
                server!.httpServer?.on('close', () => {
                    stopNodeServer();
                });
            };
        },

        /**
         * Handle HMR updates
         */
        handleHotUpdate({ file, server, modules }) {
            // Log file changes in debug mode
            if (options.debug) {
                logger.debug(`HMR update: ${file}`);
            }

            // Let Vite handle HMR normally
            return undefined;
        },

        /**
         * Cleanup on server close
         */
        async buildEnd() {
            // Cleanup handled in configureServer hook
        },
    };
}

/**
 * Handle Springboard debug routes
 */
function handleSpringboardRoute(
    req: { url?: string },
    res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void },
    options: NormalizedOptions
): void {
    const url = req.url || '';

    if (url === '/__springboard/info') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            platform: options.platform,
            platforms: options.platforms,
            entry: options.entry,
            debug: options.debug,
        }, null, 2));
        return;
    }

    if (url === '/__springboard/platforms') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            current: options.platform,
            available: options.platforms,
            active: options.platforms,
        }, null, 2));
        return;
    }

    // 404 for unknown routes
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
}

export default springboardDev;
