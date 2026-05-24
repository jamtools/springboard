/**
 * Springboard CLI Types
 * Vite-based build system types for multi-platform applications
 */

import type { Plugin as VitePlugin, UserConfig as ViteUserConfig } from 'vite';

/**
 * Document metadata for HTML generation.
 * This type is compatible with springboard's DocumentMeta type.
 */
export type DocumentMeta = {
    title?: string;
    description?: string;
    'Content-Security-Policy'?: string;
    keywords?: string;
    author?: string;
    robots?: string;
    'og:title'?: string;
    'og:description'?: string;
    'og:image'?: string;
    'og:url'?: string;
} & Record<string, string>;

/**
 * Supported platforms for Springboard builds
 */
export type SpringboardPlatform =
    | 'all'
    | 'main'
    | 'browser'
    | 'browser_offline'
    | 'node'
    | 'desktop'
    | 'partykit'
    | 'mobile';

/**
 * Platform targets for Vite builds
 * - browser: Standard browser bundle (ESM)
 * - node: Node.js bundle (CJS)
 * - neutral: Platform-agnostic (for edge runtimes like PartyKit)
 */
export type VitePlatformTarget = 'browser' | 'node' | 'neutral';

/**
 * Platform macro targets used in @platform directives
 */
export type PlatformMacroTarget = 'browser' | 'node' | 'fetch' | 'react-native';

/**
 * Build configuration for a platform
 */
export interface PlatformBuildConfig {
    /** Platform target (browser, node, neutral) */
    target: VitePlatformTarget;
    /** Human-readable name for logging */
    name: string;
    /** Platform entrypoint module specifier */
    platformEntrypoint: string;
    /** Platform macro target for @platform directives */
    platformMacro: PlatformMacroTarget;
    /** Output directory relative to dist/ */
    outDir: string;
    /** Whether to use fingerprinting for cache busting */
    fingerprint?: boolean;
    /** HTML template path (for browser targets) */
    htmlTemplate?: string;
    /** External dependencies to exclude from bundle */
    externals?: string[];
    /** Output format (es, cjs) */
    format?: 'es' | 'cjs';
    /** Additional files to copy to output */
    additionalFiles?: Record<string, string>;
    /** Post-build hooks */
    postBuild?: (config: PlatformBuildConfig, outDir: string) => Promise<void>;
}

/**
 * Plugin configuration returned by Springboard plugins
 */
export interface PluginConfig {
    /** Plugin name for logging */
    name?: string;
    /** Modify Vite config */
    editViteConfig?: (config: ViteUserConfig) => void;
    /** Additional Vite plugins to include */
    vitePlugins?: (args: {
        outDir: string;
        nodeModulesParentDir: string;
        documentMeta?: DocumentMeta;
    }) => VitePlugin[];
    /** External dependencies */
    externals?: () => string[];
    /** Additional files to copy */
    additionalFiles?: Record<string, string>;
}

/**
 * Springboard plugin function signature
 */
export type Plugin = (buildConfig: PlatformBuildConfig) => PluginConfig;

/**
 * Options for building platforms
 */
export interface BuildPlatformsOptions {
    /** Application entrypoint file path */
    applicationEntrypoint: string;
    /** Whether to watch for changes */
    watch?: boolean;
    /** Plugins to apply */
    plugins: Plugin[];
    /** Platforms to build */
    platformsToBuild: Set<SpringboardPlatform>;
    /** Development mode options */
    dev?: {
        /** Enable CSS hot reloading */
        reloadCss: boolean;
        /** Enable JS hot reloading */
        reloadJs: boolean;
        /** Dev server port */
        port?: number;
    };
    /** Document metadata for HTML */
    documentMeta?: DocumentMeta;
}

/**
 * Options for the Vite dev server
 */
export interface DevServerOptions {
    /** Application entrypoint */
    applicationEntrypoint: string;
    /** Platforms to run dev server for */
    platforms: SpringboardPlatform[];
    /** Plugins to apply */
    plugins: Plugin[];
    /** Dev server port */
    port?: number;
    /** Enable HMR */
    hmr?: boolean;
}

/**
 * Options for Vite build
 */
export interface ViteBuildOptions {
    /** Application entrypoint */
    applicationEntrypoint: string;
    /** Platform configuration */
    platformConfig: PlatformBuildConfig;
    /** Plugins to apply */
    plugins: Plugin[];
    /** Watch mode */
    watch?: boolean;
    /** Document metadata */
    documentMeta?: DocumentMeta;
    /** Custom output directory */
    outDir?: string;
    /** Custom define values */
    define?: Record<string, string>;
}

/**
 * Vite instance info for orchestration
 */
export interface ViteInstanceInfo {
    /** Instance identifier */
    id: string;
    /** Platform name */
    platform: string;
    /** Port (for dev server) */
    port?: number;
    /** Server instance (ViteDevServer for dev, undefined for build) */
    server?: import('vite').ViteDevServer;
    /** Build watcher (for watch mode builds) - Rollup watcher type */
    watcher?: { close: () => Promise<void> };
    /** Whether this is a dev server */
    isDev: boolean;
}

/**
 * Build result information
 */
export interface BuildResult {
    /** Platform that was built */
    platform: string;
    /** Output directory */
    outDir: string;
    /** Build duration in ms */
    duration: number;
    /** Whether build succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
}
