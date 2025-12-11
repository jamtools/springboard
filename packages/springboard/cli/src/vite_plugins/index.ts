/**
 * Springboard Vite Plugins
 *
 * This module exports all Vite plugins for Springboard builds.
 *
 * IMPORTANT: These plugins transform USERLAND code only.
 * Dependencies are pre-compiled and come from npm - they do NOT go through
 * these transformations.
 *
 * Available Plugins:
 *
 * 1. vitePluginPlatformInject
 *    - Transforms @platform comment blocks based on target platform
 *    - Port of esbuild_plugin_platform_inject
 *
 * 2. vitePluginHtmlGenerate
 *    - Generates HTML with injected scripts and metadata
 *    - Port of esbuild_plugin_html_generate
 *
 * 3. vitePluginPartykitConfig
 *    - Generates partykit.json configuration
 *    - Port of esbuild_plugin_partykit_config
 *
 * 4. vitePluginSpringboardConditions
 *    - NEW: Configures platform-specific resolve conditions
 *    - Sets up __PLATFORM__, __IS_BROWSER__, etc. defines
 *
 * @example
 * // vite.config.ts
 * import {
 *   vitePluginPlatformInject,
 *   vitePluginHtmlGenerate,
 *   vitePluginSpringboardConditions,
 * } from '@springboardjs/cli/vite_plugins';
 *
 * export default defineConfig({
 *   plugins: [
 *     vitePluginSpringboardConditions({ target: 'browser' }),
 *     vitePluginPlatformInject('browser'),
 *     vitePluginHtmlGenerate({
 *       templatePath: 'node_modules/@springboardjs/platforms-browser/index.html',
 *     }),
 *   ]
 * })
 */

// =============================================================================
// Platform Inject Plugin
// =============================================================================

export {
    vitePluginPlatformInject,
    platformInject,
    type VitePluginPlatformInjectOptions,
} from './vite_plugin_platform_inject.js';

// =============================================================================
// HTML Generate Plugin
// =============================================================================

export {
    vitePluginHtmlGenerate,
    vitePluginHtmlTransformDev,
    vitePluginHtmlGenerateFull,
    htmlGenerate,
    type VitePluginHtmlGenerateOptions,
} from './vite_plugin_html_generate.js';

// =============================================================================
// PartyKit Config Plugin
// =============================================================================

export {
    vitePluginPartykitConfig,
    partykitConfig,
    type VitePluginPartykitConfigOptions,
    type PartykitConfig,
} from './vite_plugin_partykit_config.js';

// =============================================================================
// Springboard Conditions Plugin
// =============================================================================

export {
    vitePluginSpringboardConditions,
    vitePluginSpringboardPlatform,
    springboardConditions,
    type VitePluginSpringboardConditionsOptions,
} from './vite_plugin_springboard_conditions.js';

// =============================================================================
// Additional Utility Plugins
// =============================================================================

export { vitePluginLogBuildTime } from './vite_plugin_log_build_time.js';

export { vitePluginTransformAwaitImport } from './vite_plugin_transform_await_import.js';

export {
    vitePluginCopyFiles,
    type CopyFilesOptions,
} from './vite_plugin_copy_files.js';

// =============================================================================
// Utilities
// =============================================================================

export {
    // Platform helpers
    PLATFORM_TARGET_MAP,
    ALL_PLATFORM_MACRO_TARGETS,
    resolvePlatformTarget,
    transformPlatformBlocks,
    createPlatformBlockRegex,
    createAnyPlatformBlockRegex,

    // Filter helpers
    createFilter,
    isUserlandCode,
    DEFAULT_TS_FILTER,
    DEFAULT_USERLAND_INCLUDE,
    DEFAULT_EXCLUDE,

    // HTML helpers
    injectMetaTags,
    injectScriptTags,
    injectLinkTags,

    // General utilities
    createPluginLogger,
    findNodeModulesParentFolder,
    getAssetBasePath,
    extractBundleAssets,

    // Re-exported types
    type PlatformMacroTarget,
    type SpringboardPlatform,
    type DocumentMeta,
} from './utils.js';

// =============================================================================
// Convenience: Create all plugins for a platform
// =============================================================================

import type { Plugin } from 'vite';
import type { PlatformMacroTarget, SpringboardPlatform, DocumentMeta } from './utils.js';
import { vitePluginPlatformInject } from './vite_plugin_platform_inject.js';
import { vitePluginHtmlGenerate } from './vite_plugin_html_generate.js';
import { vitePluginSpringboardConditions } from './vite_plugin_springboard_conditions.js';
import { vitePluginPartykitConfig } from './vite_plugin_partykit_config.js';

/**
 * Options for creating a complete plugin set for a platform
 */
export interface CreateSpringboardPluginsOptions {
    /**
     * Target platform
     */
    platform: SpringboardPlatform | PlatformMacroTarget;

    /**
     * HTML template path (required for browser platforms)
     */
    htmlTemplatePath?: string;

    /**
     * Document metadata for HTML generation
     */
    documentMeta?: DocumentMeta;

    /**
     * PartyKit project name (only for PartyKit platform)
     */
    partykitName?: string;

    /**
     * Enable debug logging for all plugins
     */
    debug?: boolean;
}

/**
 * Create a complete set of Springboard Vite plugins for a platform.
 *
 * This is a convenience function that sets up all necessary plugins
 * for a specific platform build.
 *
 * @param options - Plugin configuration options
 * @returns Array of Vite plugins
 *
 * @example
 * // vite.config.ts
 * import { createSpringboardPlugins } from '@springboardjs/cli/vite_plugins';
 *
 * export default defineConfig({
 *   plugins: createSpringboardPlugins({
 *     platform: 'browser',
 *     htmlTemplatePath: 'node_modules/@springboardjs/platforms-browser/index.html',
 *     documentMeta: { title: 'My App' },
 *   })
 * })
 */
export function createSpringboardPlugins(options: CreateSpringboardPluginsOptions): Plugin[] {
    const {
        platform,
        htmlTemplatePath,
        documentMeta,
        partykitName,
        debug = false,
    } = options;

    const plugins: Plugin[] = [];

    // Always add conditions plugin first
    plugins.push(
        vitePluginSpringboardConditions({
            target: platform,
            debug,
        })
    );

    // Always add platform inject plugin
    plugins.push(
        vitePluginPlatformInject({
            platform: platform as PlatformMacroTarget,
            debug,
        })
    );

    // Add HTML generate plugin for browser-like platforms
    const isBrowserPlatform = ['browser', 'browser_offline', 'desktop', 'main'].includes(platform);
    if (isBrowserPlatform && htmlTemplatePath) {
        plugins.push(
            vitePluginHtmlGenerate({
                templatePath: htmlTemplatePath,
                documentMeta,
                debug,
            })
        );
    }

    // Add PartyKit config plugin for PartyKit platform
    if (platform === 'partykit' && partykitName) {
        plugins.push(
            vitePluginPartykitConfig({
                name: partykitName,
                debug,
            })
        );
    }

    return plugins;
}
