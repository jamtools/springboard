/**
 * Springboard Vite Plugin
 *
 * A single, simple Vite plugin that handles multi-platform builds for Springboard apps.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { springboard } from 'springboard/vite-plugin';
 *
 * export default springboard({
 *   entry: './src/index.tsx',
 *   platforms: ['browser', 'node'],
 *   documentMeta: {
 *     title: 'My App',
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { Plugin, PluginOption, UserConfig } from 'vite';
import type {
    SpringboardOptions,
    NormalizedOptions,
    Platform,
} from './types.js';
import { normalizeOptions, validateOptions } from './utils/normalize-options.js';
import { springboardInit } from './plugins/init.js';
import { springboardVirtual } from './plugins/virtual.js';
import { springboardPlatform } from './plugins/platform-inject.js';
import { springboardHtml } from './plugins/html.js';
import { springboardBuild } from './plugins/build.js';
import { springboardDev } from './plugins/dev.js';

/**
 * Create a Springboard Vite configuration.
 *
 * This function returns a Vite configuration object that works for multi-platform builds.
 * It includes plugins that:
 * - Generate virtual entry points for each platform
 * - Transform @platform comment blocks
 * - Generate HTML for browser platforms
 * - Orchestrate multi-platform builds
 * - Handle HMR and watch mode
 *
 * @param options - Springboard configuration options
 * @returns Vite UserConfig object
 *
 * @example
 * // Minimal configuration
 * export default springboard({
 *   entry: './src/index.tsx',
 * });
 *
 * @example
 * // Multi-platform configuration
 * export default springboard({
 *   entry: './src/index.tsx',
 *   platforms: ['browser', 'node', 'partykit'],
 *   documentMeta: {
 *     title: 'My App',
 *     description: 'A multi-platform Springboard app',
 *   },
 *   partykitName: 'my-partykit-app',
 * });
 *
 * @example
 * // With custom Vite config per platform
 * export default springboard({
 *   entry: './src/index.tsx',
 *   platforms: ['browser', 'node'],
 *   viteConfig: {
 *     browser: {
 *       build: { outDir: 'dist/web' },
 *     },
 *     node: {
 *       build: { outDir: 'dist/server' },
 *     },
 *   },
 * });
 */
export function springboard(options: SpringboardOptions): PluginOption[] {
    // Validate options early
    validateOptions(options);

    // Normalize options
    const normalized = normalizeOptions(options);

    // Create and return plugins array
    // Note: Vite expects Plugin | Plugin[], so returning an array is valid
    // Users can use it as: plugins: [springboard({ ... })] or plugins: springboard({ ... })
    const plugins = [
        springboardInit(normalized),
        springboardVirtual(normalized),
        springboardPlatform(normalized),
        springboardHtml(normalized),
        springboardBuild(normalized),
        springboardDev(normalized),
    ];

    // Filter out null plugins and return
    return plugins.filter((p): p is Plugin => p !== null);
}

/**
 * Create Springboard plugins for a specific platform.
 *
 * This is useful when you need more control over the build process
 * or want to integrate with existing Vite configurations.
 *
 * @param options - Springboard configuration options
 * @param platform - Specific platform to build for
 * @returns Array of Vite plugins
 */
export function springboardPlugins(
    options: SpringboardOptions,
    platform?: Platform
): Plugin[] {
    validateOptions(options);
    const normalized = normalizeOptions(options, platform);

    return [
        springboardInit(normalized),
        springboardVirtual(normalized),
        springboardPlatform(normalized),
        springboardHtml(normalized),
        springboardBuild(normalized),
        springboardDev(normalized),
    ].filter((p): p is Plugin => p !== null);
}

/**
 * Helper to create a Vite config with Springboard plugins.
 *
 * @param options - Springboard options
 * @returns Vite UserConfig with Springboard plugins
 */
export function defineSpringboardConfig(options: SpringboardOptions): UserConfig {
    return {
        plugins: springboard(options),
    };
}

// Re-export types
export type {
    SpringboardOptions,
    NormalizedOptions,
    Platform,
    PlatformMacroTarget,
    DocumentMeta,
    EntryConfig,
    PlatformViteConfig,
    PlatformConfigFunction,
    NodeEntryModule,
} from './types.js';

// Re-export virtual module constants
export { VIRTUAL_MODULES, RESOLVED_VIRTUAL_MODULES } from './types.js';

// Re-export individual plugins for advanced usage
export { springboardInit } from './plugins/init.js';
export { springboardVirtual } from './plugins/virtual.js';
export { springboardPlatform } from './plugins/platform-inject.js';
export { springboardHtml } from './plugins/html.js';
export { springboardBuild } from './plugins/build.js';
export { springboardDev } from './plugins/dev.js';

// Re-export utilities
export { normalizeOptions, createOptionsForPlatform } from './utils/normalize-options.js';
export {
    generateEntryCode,
    generateModulesCode,
    generatePlatformCode,
    loadBrowserDevTemplate,
    loadBrowserBuildTemplate,
    loadNodeTemplate,
    loadHtmlTemplate,
    generateBrowserDevEntry,
    generateBrowserBuildEntry,
    generateNodeEntry,
    generateHtml,
} from './utils/generate-entry.js';
export { getPlatformConfig, isBrowserPlatform, isServerPlatform } from './config/platform-configs.js';
export { detectPlatform, setPlatformEnv, clearPlatformEnv } from './config/detect-platform.js';

// Default export
export default springboard;
