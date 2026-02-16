/**
 * Springboard CLI
 *
 * Main entry point for the springboard-cli package.
 * Exports build functions, configuration generators, and types.
 */

// Export types
export type {
    SpringboardPlatform,
    VitePlatformTarget,
    PlatformMacroTarget,
    DocumentMeta,
    PlatformBuildConfig,
    PluginConfig,
    Plugin,
    BuildPlatformsOptions,
    DevServerOptions,
    ViteBuildOptions,
    ViteInstanceInfo,
    BuildResult,
} from './types.js';

// Export CLI utilities
export {
    program,
    resolveEntrypoint,
    loadPlugins,
    parsePlatforms,
} from './cli.js';
