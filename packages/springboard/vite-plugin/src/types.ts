/**
 * Springboard Vite Plugin Types
 *
 * TypeScript types for the Springboard Vite plugin.
 */

import type { UserConfig, Plugin } from 'vite';

/**
 * Supported platforms for Springboard builds
 */
export type Platform =
    | 'browser'
    | 'node'
    | 'partykit'
    | 'tauri'
    | 'react-native';

/**
 * Platform macro targets used in @platform directives
 * These are the low-level targets that map from high-level platforms
 */
export type PlatformMacroTarget = 'browser' | 'node' | 'fetch' | 'react-native';

/**
 * Document metadata for HTML generation
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
 * Platform-specific Vite configuration
 */
export type PlatformViteConfig = Partial<Record<Platform, UserConfig>>;

/**
 * Function to generate platform-specific Vite configuration
 */
export type PlatformConfigFunction = (
    platform: Platform,
    baseConfig: UserConfig
) => UserConfig;

/**
 * Entry point configuration
 * Can be a single string for all platforms or per-platform entries
 */
export type EntryConfig = string | Partial<Record<Platform, string>>;

/**
 * User-facing options for the springboard() function
 */
export interface SpringboardOptions {
    /**
     * Entry point for your application.
     * Can be a single path for all platforms or per-platform paths.
     *
     * @example
     * // Single entry for all platforms
     * entry: './src/index.tsx'
     *
     * @example
     * // Per-platform entries
     * entry: {
     *   browser: './src/index.browser.tsx',
     *   node: './src/index.node.tsx',
     * }
     */
    entry: EntryConfig;

    /**
     * Target platforms to build for.
     * @default ['browser']
     */
    platforms?: Platform[];

    /**
     * Document metadata for browser platforms.
     * Used to generate HTML with title, meta tags, etc.
     */
    documentMeta?: DocumentMeta;

    /**
     * Custom Vite configuration per platform.
     * Can be an object with platform-specific configs or a function.
     *
     * @example
     * // Object form
     * viteConfig: {
     *   browser: { build: { outDir: 'dist/web' } },
     *   node: { build: { outDir: 'dist/server' } },
     * }
     *
     * @example
     * // Function form
     * viteConfig: (platform, baseConfig) => {
     *   if (platform === 'browser') {
     *     return mergeConfig(baseConfig, { ... });
     *   }
     *   return baseConfig;
     * }
     */
    viteConfig?: PlatformViteConfig | PlatformConfigFunction;

    /**
     * Enable debug logging for all plugins.
     * @default false
     */
    debug?: boolean;

    /**
     * PartyKit project name (required for PartyKit platform).
     */
    partykitName?: string;

    /**
     * Base output directory for builds.
     * Platform-specific builds will be in subdirectories.
     * @default 'dist'
     */
    outDir?: string;

    /**
     * Port for the node dev server (default: 1337)
     */
    nodeServerPort?: number;
}

/**
 * Internal normalized options used by plugins
 */
export interface NormalizedOptions {
    /**
     * Resolved entry point for current platform
     */
    entry: string;

    /**
     * Entry configuration (original)
     */
    entryConfig: EntryConfig;

    /**
     * All target platforms
     */
    platforms: Platform[];

    /**
     * Current platform being built
     */
    platform: Platform;

    /**
     * Platform macro target for @platform directives
     */
    platformMacro: PlatformMacroTarget;

    /**
     * Document metadata
     */
    documentMeta?: DocumentMeta;

    /**
     * Custom Vite config function
     */
    viteConfig?: PlatformConfigFunction;

    /**
     * Debug mode
     */
    debug: boolean;

    /**
     * PartyKit project name
     */
    partykitName?: string;

    /**
     * Base output directory
     */
    outDir: string;

    /**
     * Root directory (cwd)
     */
    root: string;

    /**
     * Port for the node dev server
     */
    nodeServerPort: number;
}

/**
 * Node entry module interface
 * Defines the lifecycle exports for node server entries
 */
export interface NodeEntryModule {
    /**
     * Start the node server
     */
    start?: () => Promise<void>;

    /**
     * Stop the node server
     */
    stop?: () => Promise<void>;
}

/**
 * Plugin context passed between plugins
 */
export interface PluginContext {
    /**
     * Normalized options
     */
    options: NormalizedOptions;

    /**
     * Whether we're in dev mode
     */
    isDev: boolean;

    /**
     * Whether we're in build mode
     */
    isBuild: boolean;

    /**
     * Vite command (serve or build)
     */
    command: 'serve' | 'build';
}

/**
 * Virtual module IDs
 */
export const VIRTUAL_MODULES = {
    ENTRY: 'virtual:springboard-entry',
    MODULES: 'virtual:springboard-modules',
    PLATFORM: 'virtual:springboard-platform',
} as const;

/**
 * Resolved virtual module IDs (with \0 prefix)
 */
export const RESOLVED_VIRTUAL_MODULES = {
    ENTRY: '\0virtual:springboard-entry',
    MODULES: '\0virtual:springboard-modules',
    PLATFORM: '\0virtual:springboard-platform',
} as const;

/**
 * Plugin factory function type
 */
export type PluginFactory = (options: NormalizedOptions) => Plugin | null;
