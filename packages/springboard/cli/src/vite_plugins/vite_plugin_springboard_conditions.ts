/**
 * Vite Plugin: Springboard Conditions
 *
 * NEW plugin specific to Springboard for handling platform-specific code branches.
 *
 * This plugin works differently from platform_inject:
 * - platform_inject: Strips @platform comment blocks at compile time
 * - springboard_conditions: Configures Vite's resolve.conditions for package exports
 *
 * The conditions plugin helps Vite resolve the correct entry points from
 * pre-compiled Springboard packages based on the target platform.
 *
 * When packages use export conditions in their package.json:
 * ```json
 * {
 *   "exports": {
 *     ".": {
 *       "browser": "./dist/browser/index.js",
 *       "node": "./dist/node/index.js",
 *       "default": "./dist/browser/index.js"
 *     }
 *   }
 * }
 * ```
 *
 * This plugin ensures Vite uses the correct condition based on the target platform.
 *
 * Additionally, it provides compile-time constants for conditional code:
 * - __PLATFORM__: The current platform ('browser', 'node', etc.)
 * - __IS_BROWSER__: true if building for browser
 * - __IS_NODE__: true if building for Node.js
 * - __IS_SERVER__: true if building for server (node or fetch)
 * - __IS_MOBILE__: true if building for React Native
 *
 * @example
 * // vite.config.ts
 * import { vitePluginSpringboardConditions } from './vite_plugins';
 *
 * export default defineConfig({
 *   plugins: [
 *     vitePluginSpringboardConditions({ target: 'browser' })
 *   ]
 * })
 *
 * @example
 * // In userland code:
 * if (__IS_BROWSER__) {
 *   // Browser-specific code - stripped in node builds
 *   localStorage.setItem('key', 'value');
 * }
 */

import type { Plugin, UserConfig } from 'vite';
import type { PlatformMacroTarget, SpringboardPlatform } from '../types.js';
import { PLATFORM_TARGET_MAP, createPluginLogger } from './utils.js';

/**
 * Options for the Springboard conditions plugin
 */
export interface VitePluginSpringboardConditionsOptions {
    /**
     * Target platform for the build.
     * This affects both resolve conditions and compile-time constants.
     */
    target: SpringboardPlatform | PlatformMacroTarget;

    /**
     * Additional resolve conditions to include.
     * These are appended to the default conditions.
     */
    additionalConditions?: string[];

    /**
     * Custom define values to add.
     * These are merged with the platform-specific defines.
     */
    additionalDefines?: Record<string, string>;

    /**
     * Enable debug logging.
     * @default false
     */
    debug?: boolean;

    /**
     * Disable platform defines (__PLATFORM__, __IS_BROWSER__, etc.)
     * @default false
     */
    disableDefines?: boolean;
}

/**
 * Get the resolve conditions for a platform
 */
function getConditionsForPlatform(platform: PlatformMacroTarget): string[] {
    switch (platform) {
        case 'browser':
            return ['browser', 'import', 'module', 'default'];
        case 'node':
            return ['node', 'require', 'import', 'module', 'default'];
        case 'fetch':
            // Cloudflare Workers / PartyKit
            return ['workerd', 'worker', 'import', 'module', 'default'];
        case 'react-native':
            return ['react-native', 'import', 'module', 'default'];
        default:
            return ['import', 'module', 'default'];
    }
}

/**
 * Get compile-time defines for a platform
 */
function getDefinesForPlatform(platform: PlatformMacroTarget): Record<string, string> {
    return {
        __PLATFORM__: JSON.stringify(platform),
        __IS_BROWSER__: String(platform === 'browser'),
        __IS_NODE__: String(platform === 'node'),
        __IS_SERVER__: String(platform === 'node' || platform === 'fetch'),
        __IS_MOBILE__: String(platform === 'react-native'),
        __IS_FETCH__: String(platform === 'fetch'),
        // Legacy compatibility
        'import.meta.env.PLATFORM': JSON.stringify(platform),
    };
}

/**
 * Create a Vite plugin that configures platform-specific resolve conditions.
 *
 * This plugin modifies Vite's configuration to:
 * 1. Set resolve.conditions based on target platform
 * 2. Add platform-specific compile-time constants
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin
 */
export function vitePluginSpringboardConditions(
    options: VitePluginSpringboardConditionsOptions
): Plugin {
    const {
        target,
        additionalConditions = [],
        additionalDefines = {},
        debug = false,
        disableDefines = false,
    } = options;

    const logger = createPluginLogger('springboard-conditions');

    // Resolve the platform macro target
    const platformTarget = PLATFORM_TARGET_MAP[target] || (target as PlatformMacroTarget);

    if (debug) {
        logger.info(`Initialized for target: ${target} (resolved: ${platformTarget})`);
    }

    return {
        name: 'springboard:conditions',

        // Run early to affect resolution
        enforce: 'pre',

        /**
         * Config hook - modify Vite configuration
         *
         * This runs before Vite processes the config.
         */
        config(config: UserConfig, env) {
            const conditions = [
                ...getConditionsForPlatform(platformTarget),
                ...additionalConditions,
            ];

            const defines = disableDefines
                ? additionalDefines
                : {
                      ...getDefinesForPlatform(platformTarget),
                      ...additionalDefines,
                  };

            if (debug) {
                logger.debug(`Setting conditions: ${conditions.join(', ')}`);
                logger.debug(`Setting defines: ${JSON.stringify(defines)}`);
            }

            return {
                resolve: {
                    conditions,
                },
                define: defines,
            };
        },
    };
}

/**
 * Create a plugin that sets up the full Springboard platform configuration.
 *
 * This is a convenience function that combines:
 * - Platform conditions for package resolution
 * - Platform-specific defines
 * - SSR configuration for server platforms
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin
 */
export function vitePluginSpringboardPlatform(
    options: VitePluginSpringboardConditionsOptions & {
        /** External dependencies to exclude from bundle */
        externals?: string[];
        /** Whether this is an SSR build */
        ssr?: boolean;
    }
): Plugin {
    const {
        target,
        externals = [],
        ssr,
        ...conditionsOptions
    } = options;

    const logger = createPluginLogger('springboard-platform');
    const platformTarget = PLATFORM_TARGET_MAP[target] || (target as PlatformMacroTarget);

    // Determine if this should be an SSR build
    const isServerBuild = ssr ?? (platformTarget === 'node' || platformTarget === 'fetch');

    return {
        name: 'springboard:platform',
        enforce: 'pre',

        config(config, env) {
            const conditionsPlugin = vitePluginSpringboardConditions({
                target,
                ...conditionsOptions,
            });

            // Get base config from conditions plugin
            const configHook = conditionsPlugin.config;
            let baseConfig: UserConfig = {};
            if (typeof configHook === 'function') {
                baseConfig = configHook.call(this, config, env) as UserConfig || {};
            }

            // Add SSR-specific configuration
            if (isServerBuild) {
                return {
                    ...baseConfig,
                    ssr: {
                        target: platformTarget === 'node' ? 'node' : 'webworker',
                        external: externals,
                    },
                    build: {
                        ssr: true,
                        rollupOptions: {
                            external: externals,
                        },
                    },
                };
            }

            return baseConfig;
        },
    };
}

/**
 * Convenience export - same function with shorter name
 */
export const springboardConditions = vitePluginSpringboardConditions;

export default vitePluginSpringboardConditions;
