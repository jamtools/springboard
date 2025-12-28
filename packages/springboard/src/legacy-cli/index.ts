/**
 * @deprecated This module is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * Legacy CLI exports for backward compatibility with existing applications
 * that use the esbuild-based build system.
 *
 * @example
 * ```typescript
 * // Deprecated usage:
 * import { buildApplication, platformBrowserBuildConfig } from 'springboard/legacy-cli';
 *
 * // Recommended migration:
 * import springboard from 'springboard/vite-plugin';
 * // Use in vite.config.ts
 * ```
 */

// Main build APIs
export {
    buildApplication,
    buildServer,
    platformBrowserBuildConfig,
    platformOfflineBrowserBuildConfig,
    platformNodeBuildConfig,
    platformPartykitServerBuildConfig,
    platformPartykitBrowserBuildConfig,
    platformTauriWebviewBuildConfig,
    platformTauriMaestroBuildConfig,
} from './build.js';

// Types
export type {
    SpringboardPlatform,
    EsbuildPlugin,
    BuildConfig,
    Plugin,
    ApplicationBuildOptions,
    DocumentMeta,
    ServerBuildOptions,
} from './build.js';

// Esbuild plugins (for advanced customization)
export {
    esbuildPluginPlatformInject,
    esbuildPluginLogBuildTime,
    esbuildPluginHtmlGenerate,
    esbuildPluginPartykitConfig,
    esbuildPluginTransformAwaitImportToRequire,
} from './esbuild-plugins/index.js';
