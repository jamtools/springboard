/**
 * Springboard Init Plugin
 *
 * One-time setup, validates config, and provides base configuration.
 * This plugin runs first and establishes the foundation for other plugins.
 */

import type { Plugin, UserConfig } from 'vite';
import type { NormalizedOptions } from '../types.js';
import { getPlatformConfig, getResolveConditions } from '../config/platform-configs.js';
import { createLogger } from './shared.js';
import { generateBrowserDevEntry, generateBrowserBuildEntry, generateNodeEntry } from '../utils/generate-entry.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';

/**
 * Create the springboard init plugin.
 *
 * Responsibilities:
 * - Set appType to 'custom' (we handle HTML ourselves)
 * - Configure resolve conditions for platform
 * - Set up compile-time defines
 * - Apply platform-specific base config
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin
 */
export function springboardInit(options: NormalizedOptions): Plugin {
    const logger = createLogger('init', options.debug);

    logger.debug(`Initializing for platform: ${options.platform}`);

    return {
        name: 'springboard:init',
        enforce: 'pre',

        /**
         * Config hook - modify Vite configuration
         */
        config(config: UserConfig, env) {
            logger.debug(`Config hook called - command: ${env.command}, mode: ${env.mode}`);

            // Get platform-specific base config
            const platformConfig = getPlatformConfig(options);

            // Get resolve conditions
            const conditions = getResolveConditions(options.platform);

            // Build the enforced configuration
            const enforcedConfig: UserConfig = {
                // Use custom app type - we handle HTML ourselves
                appType: 'custom',

                // Set root directory
                root: options.root,

                // Resolve configuration
                resolve: {
                    conditions,
                    alias: {
                        // Allow importing platform info
                        'virtual:springboard-platform': '\0virtual:springboard-platform',
                    },
                },

                // Compile-time defines
                define: {
                    __PLATFORM__: JSON.stringify(options.platform),
                    __PLATFORM_MACRO__: JSON.stringify(options.platformMacro),
                    __IS_BROWSER__: String(options.platform === 'browser' || options.platform === 'tauri'),
                    __IS_NODE__: String(options.platform === 'node'),
                    __IS_SERVER__: String(options.platform === 'node' || options.platform === 'partykit'),
                    __IS_MOBILE__: String(options.platform === 'react-native'),
                    __IS_TAURI__: String(options.platform === 'tauri'),
                    __IS_PARTYKIT__: String(options.platform === 'partykit'),
                    __SPRINGBOARD_DEV__: String(env.command === 'serve'),
                    'import.meta.env.PLATFORM': JSON.stringify(options.platform),
                },

                // Merge platform-specific build config
                build: platformConfig.build,

                // SSR config for server platforms
                ...(platformConfig.ssr ? { ssr: platformConfig.ssr } : {}),
            };

            // Apply user's custom viteConfig if provided
            if (options.viteConfig) {
                const customConfig = options.viteConfig(options.platform, enforcedConfig);
                return mergeConfigs(enforcedConfig, customConfig);
            }

            return enforcedConfig;
        },

        /**
         * Config resolved hook - verify final configuration
         */
        configResolved(resolvedConfig) {
            logger.debug(`Config resolved - outDir: ${resolvedConfig.build.outDir}`);

            // Warn if user overrode critical settings
            if (resolvedConfig.appType !== 'custom') {
                logger.warn(
                    'appType was changed from "custom". This may cause issues with HTML generation.'
                );
            }
        },

        /**
         * Build start hook - generate physical entry files
         */
        buildStart() {
            logger.debug('Generating physical entry files in .springboard/');

            // Create .springboard directory if it doesn't exist
            const springboardDir = path.resolve(options.root, '.springboard');
            if (!existsSync(springboardDir)) {
                mkdirSync(springboardDir, { recursive: true });
            }

            // Calculate the relative path from .springboard/ to the user's entry file
            const absoluteEntryPath = path.isAbsolute(options.entry)
                ? options.entry
                : path.resolve(options.root, options.entry);
            const relativeEntryPath = path.relative(springboardDir, absoluteEntryPath);

            logger.debug(`Entry path: ${options.entry} -> ${relativeEntryPath}`);

            // Generate entry files based on platform
            if (options.platform === 'browser' || options.platform === 'tauri') {
                // Generate both dev and build entry files for browser platforms
                const devEntryCode = generateBrowserDevEntry(relativeEntryPath);
                const buildEntryCode = generateBrowserBuildEntry(relativeEntryPath);

                const devEntryFile = path.join(springboardDir, 'dev-entry.js');
                const buildEntryFile = path.join(springboardDir, 'build-entry.js');

                writeFileSync(devEntryFile, devEntryCode, 'utf-8');
                writeFileSync(buildEntryFile, buildEntryCode, 'utf-8');

                logger.debug('Generated browser entry files: dev-entry.js, build-entry.js');
            } else if (options.platform === 'node') {
                // Generate node entry file (TypeScript!)
                const nodeEntryCode = generateNodeEntry(relativeEntryPath, options.nodeServerPort);
                const nodeEntryFile = path.join(springboardDir, 'node-entry.ts');

                writeFileSync(nodeEntryFile, nodeEntryCode, 'utf-8');

                logger.debug('Generated node entry file: node-entry.ts');
            }
        },
    };
}

/**
 * Simple config merger
 * For deep merging, users should use Vite's mergeConfig
 */
function mergeConfigs(base: UserConfig, override: UserConfig): UserConfig {
    return {
        ...base,
        ...override,
        resolve: {
            ...base.resolve,
            ...override.resolve,
            conditions: override.resolve?.conditions ?? base.resolve?.conditions,
            alias: {
                ...base.resolve?.alias,
                ...override.resolve?.alias,
            },
        },
        define: {
            ...base.define,
            ...override.define,
        },
        build: {
            ...base.build,
            ...override.build,
            rollupOptions: {
                ...base.build?.rollupOptions,
                ...override.build?.rollupOptions,
            },
        },
    };
}

export default springboardInit;
