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

// Export build functions
export {
    buildAllPlatforms,
    buildMain,
    buildPlatform,
    buildServer,
    buildPartyKit,
    buildTauri,
    printBuildSummary,
    type BuildAllOptions,
} from './build/vite_build.js';

// Export dev server functions
export {
    startDevServer,
    stopDevServer,
    getActiveInstances,
    type DevServerOptions as DevServerOrchestratorOptions,
} from './dev/vite_dev_server.js';

// Export config generator
export {
    generateViteConfig,
    generateServerConfig,
    findNodeModulesParentFolder,
    platformConfigs,
    type ViteConfigOptions,
} from './config/vite_config_generator.js';

// Export CLI utilities
export {
    program,
    resolveEntrypoint,
    loadPlugins,
    parsePlatforms,
} from './cli.js';
