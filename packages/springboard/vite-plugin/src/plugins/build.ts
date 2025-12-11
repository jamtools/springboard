/**
 * Springboard Build Plugin
 *
 * Orchestrates multi-platform builds and handles build-specific tasks.
 */

import type { Plugin, ResolvedConfig } from 'vite';
import type { NormalizedOptions, Platform } from '../types.js';
import { createOptionsForPlatform } from '../utils/normalize-options.js';
import { setPlatformEnv, clearPlatformEnv } from '../config/detect-platform.js';
import { createLogger } from './shared.js';

/**
 * Create the springboard build plugin.
 *
 * Responsibilities:
 * - Track build progress
 * - Trigger additional platform builds
 * - Generate platform-specific outputs (like partykit.json)
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin
 */
export function springboardBuild(options: NormalizedOptions): Plugin {
    const logger = createLogger('build', options.debug);
    let resolvedConfig: ResolvedConfig;
    let buildStartTime: number;

    return {
        name: 'springboard:build',
        apply: 'build',

        /**
         * Store resolved config
         */
        configResolved(config) {
            resolvedConfig = config;
        },

        /**
         * Build start hook
         */
        buildStart() {
            buildStartTime = Date.now();
            logger.info(`Building for platform: ${options.platform}`);
        },

        /**
         * Build end hook - trigger additional platform builds
         * Use writeBundle instead of closeBundle to ensure the current build
         * completes fully before triggering additional platform builds
         */
        async writeBundle() {
            const duration = Date.now() - buildStartTime;
            logger.info(`Build completed in ${duration}ms`);

            // Generate PartyKit config if needed
            if (options.platform === 'partykit') {
                await generatePartykitConfig(options, logger);
            }

            // Check if we need to build additional platforms
            const remainingPlatforms = options.platforms.filter(
                p => p !== options.platform
            );

            if (remainingPlatforms.length > 0 && isFirstPlatform(options)) {
                logger.info(`Building additional platforms: ${remainingPlatforms.join(', ')}`);

                for (const platform of remainingPlatforms) {
                    await buildPlatform(platform, options, logger);
                }
            }
        },
    };
}

/**
 * Check if this is the first platform being built
 * (to avoid infinite loops when building additional platforms)
 */
function isFirstPlatform(options: NormalizedOptions): boolean {
    return options.platform === options.platforms[0];
}

/**
 * Build a specific platform
 */
async function buildPlatform(
    platform: Platform,
    options: NormalizedOptions,
    logger: ReturnType<typeof createLogger>
): Promise<void> {
    logger.info(`Starting build for platform: ${platform}`);

    // Set environment variable for the new platform
    setPlatformEnv(platform);

    try {
        // Dynamic import vite to avoid bundling issues
        const { build } = await import('vite');

        // Create options for this platform
        const platformOptions = createOptionsForPlatform(options, platform);

        // Import the springboardPlugins function and getPlatformConfig
        const { springboardPlugins } = await import('../index.js');
        const { getPlatformConfig } = await import('../config/platform-configs.js');

        // Get platform-specific Vite configuration
        const platformConfig = getPlatformConfig(platformOptions);

        await build({
            configFile: false,
            plugins: springboardPlugins({
                entry: options.entryConfig,
                platforms: [platform], // Single platform to avoid recursion
                documentMeta: options.documentMeta,
                debug: options.debug,
                partykitName: options.partykitName,
                outDir: options.outDir,
            }, platform),
            // Apply platform-specific configuration
            ...platformConfig,
            // Prevent loading user's vite.config which might cause issues
            root: options.root,
        });

        logger.info(`Completed build for platform: ${platform}`);
    } catch (error) {
        logger.error(`Failed to build platform ${platform}: ${error}`);
        throw error;
    } finally {
        clearPlatformEnv();
    }
}

/**
 * Generate PartyKit configuration file
 */
async function generatePartykitConfig(
    options: NormalizedOptions,
    logger: ReturnType<typeof createLogger>
): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const config = {
        $schema: 'https://www.partykit.io/schema.json',
        name: options.partykitName || 'springboard-app',
        main: `./${options.outDir}/partykit/server/index.js`,
        compatibilityDate: new Date().toISOString().split('T')[0],
        serve: {
            path: `${options.outDir}/browser`,
        },
    };

    const configPath = path.join(options.root, 'partykit.json');

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    logger.info(`Generated ${configPath}`);
}

export default springboardBuild;
