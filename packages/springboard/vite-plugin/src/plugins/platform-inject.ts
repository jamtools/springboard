/**
 * Springboard Platform Inject Plugin
 *
 * Transforms @platform comment blocks based on target platform.
 * Keeps code for the current platform and removes code for other platforms.
 */

import type { Plugin } from 'vite';
import type { NormalizedOptions } from '../types.js';
import {
    createLogger,
    isUserlandCode,
    transformPlatformBlocks,
} from './shared.js';

/**
 * Create the springboard platform inject plugin.
 *
 * This plugin processes @platform comment blocks:
 *
 * ```ts
 * // @platform "browser"
 * export function getStorage() {
 *   return localStorage;
 * }
 * // @platform end
 *
 * // @platform "node"
 * export function getStorage() {
 *   return nodeStorage;
 * }
 * // @platform end
 * ```
 *
 * When building for browser, only the browser block is kept.
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin
 */
export function springboardPlatform(options: NormalizedOptions): Plugin {
    const logger = createLogger('platform', options.debug);
    const { platformMacro } = options;

    logger.debug(`Platform inject initialized for macro: ${platformMacro}`);

    return {
        name: 'springboard:platform-inject',

        // Run before other plugins to strip platform code early
        enforce: 'pre',

        /**
         * Transform hook - processes each file
         */
        transform(code: string, id: string) {
            // Only process TypeScript/JavaScript files
            if (!/\.[tj]sx?$/.test(id)) {
                return null;
            }

            // Handle node_modules - generally skip
            if (id.includes('node_modules')) {
                // Only process @springboardjs packages in development
                if (!id.includes('@springboardjs') && !id.includes('springboard')) {
                    return null;
                }
            }

            // Check if it's userland code
            if (!isUserlandCode(id) && !id.includes('springboard')) {
                return null;
            }

            // Quick check: skip if file doesn't contain platform markers
            if (!code.includes('// @platform')) {
                return null;
            }

            logger.debug(`Transforming: ${id}`);

            // Transform the platform blocks
            const transformedCode = transformPlatformBlocks(code, platformMacro);

            // Only return if the code was actually changed
            if (transformedCode === code) {
                return null;
            }

            if (options.debug) {
                const originalLines = code.split('\n').length;
                const transformedLines = transformedCode.split('\n').length;
                const removedLines = originalLines - transformedLines;
                logger.debug(`Removed ${removedLines} lines from ${id}`);
            }

            return {
                code: transformedCode,
                map: null, // Let Vite handle source maps
            };
        },
    };
}

export default springboardPlatform;
