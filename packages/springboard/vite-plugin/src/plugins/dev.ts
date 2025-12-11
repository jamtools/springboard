/**
 * Springboard Dev Plugin
 *
 * Handles development server setup with HMR and multi-platform watch mode.
 */

import type { Plugin, ViteDevServer, ResolvedConfig } from 'vite';
import type { NormalizedOptions, Platform } from '../types.js';
import { createOptionsForPlatform } from '../utils/normalize-options.js';
import { setPlatformEnv, clearPlatformEnv } from '../config/detect-platform.js';
import { isServerPlatform } from '../config/platform-configs.js';
import { createLogger } from './shared.js';

// Track watch builds to prevent duplicates
const activeWatchers = new Map<string, { close: () => Promise<void> }>();

/**
 * Create the springboard dev plugin.
 *
 * Responsibilities:
 * - Configure HMR for browser platforms
 * - Start watch builds for other platforms
 * - Handle hot module replacement
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin
 */
export function springboardDev(options: NormalizedOptions): Plugin {
    const logger = createLogger('dev', options.debug);
    let resolvedConfig: ResolvedConfig;
    let server: ViteDevServer | null = null;

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
         * Configure the dev server
         */
        configureServer(devServer: ViteDevServer) {
            server = devServer;

            logger.info(`Dev server starting for platform: ${options.platform}`);

            // Start watch builds for other platforms
            const otherPlatforms = options.platforms.filter(
                p => p !== options.platform
            );

            if (otherPlatforms.length > 0) {
                // Delay starting watch builds to let server initialize
                setTimeout(() => {
                    startWatchBuilds(otherPlatforms, options, logger);
                }, 1000);
            }

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
            // Stop all watch builds when dev server stops
            await stopAllWatchBuilds(logger);
        },
    };
}

/**
 * Start watch builds for additional platforms
 */
async function startWatchBuilds(
    platforms: Platform[],
    options: NormalizedOptions,
    logger: ReturnType<typeof createLogger>
): Promise<void> {
    for (const platform of platforms) {
        // Skip non-server platforms - they don't need watch builds
        // (browser platforms use the dev server)
        if (!isServerPlatform(platform)) {
            logger.debug(`Skipping watch build for non-server platform: ${platform}`);
            continue;
        }

        // Don't start duplicate watchers
        if (activeWatchers.has(platform)) {
            logger.debug(`Watch build already active for: ${platform}`);
            continue;
        }

        logger.info(`Starting watch build for: ${platform}`);

        try {
            const watcher = await startWatchBuild(platform, options, logger);
            activeWatchers.set(platform, watcher);
        } catch (error) {
            logger.error(`Failed to start watch build for ${platform}: ${error}`);
        }
    }
}

/**
 * Start a watch build for a specific platform
 */
async function startWatchBuild(
    platform: Platform,
    options: NormalizedOptions,
    logger: ReturnType<typeof createLogger>
): Promise<{ close: () => Promise<void> }> {
    // Set environment variable for the platform
    setPlatformEnv(platform);

    try {
        // Dynamic import vite
        const { build } = await import('vite');

        // Import springboard to get plugins
        const { springboard } = await import('../index.js');

        // Start build in watch mode
        const watcher = await build({
            configFile: false,
            plugins: springboard({
                entry: options.entryConfig,
                platforms: [platform],
                documentMeta: options.documentMeta,
                debug: options.debug,
                partykitName: options.partykitName,
                outDir: options.outDir,
            }),
            root: options.root,
            build: {
                watch: {
                    // Watch options
                    include: ['src/**/*', 'lib/**/*'],
                    exclude: ['node_modules/**', 'dist/**'],
                },
            },
            logLevel: options.debug ? 'info' : 'warn',
        });

        // The watcher is returned when build.watch is set
        if (watcher && 'close' in watcher) {
            logger.info(`Watch build started for: ${platform}`);
            return watcher as { close: () => Promise<void> };
        }

        // Fallback if no watcher returned
        return { close: async () => {} };
    } finally {
        clearPlatformEnv();
    }
}

/**
 * Stop all active watch builds
 */
async function stopAllWatchBuilds(
    logger: ReturnType<typeof createLogger>
): Promise<void> {
    for (const [platform, watcher] of activeWatchers) {
        logger.debug(`Stopping watch build for: ${platform}`);
        try {
            await watcher.close();
        } catch (error) {
            logger.error(`Error stopping watch build for ${platform}: ${error}`);
        }
    }
    activeWatchers.clear();
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
            active: [options.platform, ...Array.from(activeWatchers.keys())],
        }, null, 2));
        return;
    }

    // 404 for unknown routes
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
}

export default springboardDev;
