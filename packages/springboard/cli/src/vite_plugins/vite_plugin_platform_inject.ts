/**
 * Vite Plugin: Platform Inject
 *
 * Port of esbuild_plugin_platform_inject.ts to Vite.
 *
 * This plugin handles platform-specific code injection for USERLAND code only.
 * It transforms code blocks marked with `// @platform "platform"` comments
 * based on the target platform.
 *
 * IMPORTANT: Dependencies are pre-compiled and do NOT go through this transformation.
 * This plugin only processes userland code (user's src/ directory).
 *
 * Supported platform macro targets:
 * - browser: Web browser environment
 * - node: Node.js runtime
 * - fetch: Cloudflare Workers / PartyKit server (neutral environment)
 * - react-native: React Native mobile
 *
 * @example
 * // Source code with platform blocks:
 * // @platform "browser"
 * export function getStorage() {
 *   return localStorage;
 * }
 * // @platform end
 *
 * // @platform "node"
 * export function getStorage() {
 *   return nodeFsBasedStorage();
 * }
 * // @platform end
 *
 * // When building for 'browser', only the browser block is kept.
 */

import type { Plugin, FilterPattern } from 'vite';
import type { PlatformMacroTarget } from '../types.js';
import {
    isUserlandCode,
    transformPlatformBlocks,
    createPluginLogger,
    createFilter,
} from './utils.js';

/**
 * Options for the platform inject plugin
 */
export interface VitePluginPlatformInjectOptions {
    /**
     * Target platform macro for the build.
     * This determines which @platform blocks are kept.
     */
    platform: PlatformMacroTarget;

    /**
     * Custom include patterns (defaults to all .ts/.tsx/.js/.jsx files in userland).
     * Files matching these patterns will be transformed.
     */
    include?: FilterPattern;

    /**
     * Custom exclude patterns (defaults to node_modules).
     * Files matching these patterns will NOT be transformed.
     */
    exclude?: FilterPattern;

    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;

    /**
     * Also process @springboardjs packages in node_modules.
     * Useful during development of Springboard itself.
     * @default false
     */
    processSpringboardPackages?: boolean;
}

/**
 * Create a Vite plugin that transforms platform-specific code blocks.
 *
 * This is the Vite equivalent of esbuild_plugin_platform_inject.
 * It uses the Rollup plugin API's `transform` hook to process code.
 *
 * @param optionsOrPlatform - Plugin configuration options or just the platform string
 * @returns Vite plugin
 *
 * @example
 * // Simple usage with just platform
 * plugins: [vitePluginPlatformInject('browser')]
 *
 * @example
 * // With full options
 * plugins: [vitePluginPlatformInject({
 *   platform: 'browser',
 *   debug: true,
 *   exclude: [/test\//]
 * })]
 */
export function vitePluginPlatformInject(
    optionsOrPlatform: VitePluginPlatformInjectOptions | PlatformMacroTarget
): Plugin {
    // Normalize options - support simple platform string argument for convenience
    const options: VitePluginPlatformInjectOptions =
        typeof optionsOrPlatform === 'string'
            ? { platform: optionsOrPlatform }
            : optionsOrPlatform;

    const {
        platform,
        include,
        exclude,
        debug = false,
        processSpringboardPackages = false,
    } = options;

    const logger = createPluginLogger('platform-inject');

    // Create custom filter if include/exclude provided
    const customFilter = (include || exclude) ? createFilter(include, exclude) : null;

    if (debug) {
        logger.info(`Initialized for platform: ${platform}`);
    }

    return {
        name: 'springboard:platform-inject',

        // Run before other plugins (enforce: 'pre')
        // This ensures platform code is stripped before other transformations
        enforce: 'pre',

        /**
         * Transform hook - processes each file
         *
         * This is the Vite/Rollup equivalent of esbuild's onLoad hook.
         * It receives the source code and can return transformed code.
         */
        transform(code: string, id: string) {
            // Only process TypeScript/JavaScript files
            if (!/\.[tj]sx?$/.test(id)) {
                return null;
            }

            // Handle node_modules
            if (id.includes('node_modules')) {
                // Only process @springboardjs packages if enabled
                if (processSpringboardPackages && id.includes('@springboardjs')) {
                    // Allow processing
                } else {
                    return null;
                }
            }

            // Check if it's userland code (when not processing springboard packages)
            if (!processSpringboardPackages && !isUserlandCode(id)) {
                return null;
            }

            // Apply custom include/exclude filter if provided
            if (customFilter && !customFilter(id)) {
                return null;
            }

            // Quick check: skip if file doesn't contain platform markers
            if (!code.includes('// @platform')) {
                return null;
            }

            if (debug) {
                logger.debug(`Transforming: ${id}`);
            }

            // Transform the platform blocks using the utility function
            const transformedCode = transformPlatformBlocks(code, platform);

            // Only return if the code was actually changed
            if (transformedCode === code) {
                return null;
            }

            if (debug) {
                const originalLines = code.split('\n').length;
                const transformedLines = transformedCode.split('\n').length;
                const removedLines = originalLines - transformedLines;
                logger.debug(`  Removed ${removedLines} lines from ${id}`);
            }

            return {
                code: transformedCode,
                // Return null for map to let Vite handle source maps automatically
                // Vite will generate correct source maps based on the transformation
                map: null,
            };
        },
    };
}

/**
 * Convenience export - same function with shorter name
 */
export const platformInject = vitePluginPlatformInject;

export default vitePluginPlatformInject;
