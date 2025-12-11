/**
 * Normalize Options Utility
 *
 * Transforms user-provided SpringboardOptions into NormalizedOptions
 * for internal use by plugins.
 */

import type { UserConfig } from 'vite';
import type {
    SpringboardOptions,
    NormalizedOptions,
    Platform,
    PlatformMacroTarget,
    PlatformConfigFunction,
} from '../types.js';

/**
 * Maps high-level platforms to platform macro targets
 */
const PLATFORM_TO_MACRO: Record<Platform, PlatformMacroTarget> = {
    browser: 'browser',
    node: 'node',
    partykit: 'fetch',
    tauri: 'browser',
    'react-native': 'react-native',
};

/**
 * Default platforms if none specified
 */
const DEFAULT_PLATFORMS: Platform[] = ['browser'];

/**
 * Default output directory
 */
const DEFAULT_OUT_DIR = 'dist';

/**
 * Normalize user options into internal options format.
 *
 * @param options - User-provided options
 * @param platform - Current platform being built (defaults to first in platforms array)
 * @returns Normalized options for internal use
 */
export function normalizeOptions(
    options: SpringboardOptions,
    platform?: Platform
): NormalizedOptions {
    // Validate entry is provided
    if (!options.entry) {
        throw new Error('[springboard] Entry point is required');
    }

    // Determine platforms
    const platforms = options.platforms && options.platforms.length > 0
        ? options.platforms
        : DEFAULT_PLATFORMS;

    // Determine current platform (from env, arg, or default to first)
    const currentPlatform = platform
        ?? (process.env.SPRINGBOARD_PLATFORM as Platform | undefined)
        ?? platforms[0];

    // Validate current platform is in the list
    if (!platforms.includes(currentPlatform)) {
        throw new Error(
            `[springboard] Platform "${currentPlatform}" is not in the platforms list: ${platforms.join(', ')}`
        );
    }

    // Resolve entry for current platform
    const entry = resolveEntry(options.entry, currentPlatform);

    // Get platform macro target
    const platformMacro = PLATFORM_TO_MACRO[currentPlatform];

    // Normalize viteConfig to function form
    const viteConfig = normalizeViteConfig(options.viteConfig);

    return {
        entry,
        entryConfig: options.entry,
        platforms,
        platform: currentPlatform,
        platformMacro,
        documentMeta: options.documentMeta,
        viteConfig,
        debug: options.debug ?? false,
        partykitName: options.partykitName,
        outDir: options.outDir ?? DEFAULT_OUT_DIR,
        root: process.cwd(),
    };
}

/**
 * Resolve entry point for a specific platform
 */
function resolveEntry(entry: SpringboardOptions['entry'], platform: Platform): string {
    if (typeof entry === 'string') {
        return entry;
    }

    const platformEntry = entry[platform];
    if (!platformEntry) {
        // Try to find a fallback
        const fallback = entry.browser ?? Object.values(entry)[0];
        if (!fallback) {
            throw new Error(
                `[springboard] No entry point found for platform "${platform}"`
            );
        }
        return fallback;
    }

    return platformEntry;
}

/**
 * Normalize viteConfig option to function form
 */
function normalizeViteConfig(
    viteConfig: SpringboardOptions['viteConfig']
): PlatformConfigFunction | undefined {
    if (!viteConfig) {
        return undefined;
    }

    if (typeof viteConfig === 'function') {
        return viteConfig;
    }

    // Convert object form to function form
    return (platform: Platform, baseConfig: UserConfig): UserConfig => {
        const platformConfig = viteConfig[platform];
        if (!platformConfig) {
            return baseConfig;
        }
        // Simple merge - user can use mergeConfig for deep merge
        return { ...baseConfig, ...platformConfig };
    };
}

/**
 * Create options for a different platform (for multi-platform builds)
 */
export function createOptionsForPlatform(
    options: NormalizedOptions,
    platform: Platform
): NormalizedOptions {
    const entry = resolveEntry(options.entryConfig, platform);
    const platformMacro = PLATFORM_TO_MACRO[platform];

    return {
        ...options,
        entry,
        platform,
        platformMacro,
    };
}

/**
 * Validate options and throw helpful errors
 */
export function validateOptions(options: SpringboardOptions): void {
    if (!options.entry) {
        throw new Error(
            '[springboard] Entry point is required. Example: springboard({ entry: "./src/index.tsx" })'
        );
    }

    if (options.platforms) {
        const validPlatforms: Platform[] = ['browser', 'node', 'partykit', 'tauri', 'react-native'];
        for (const platform of options.platforms) {
            if (!validPlatforms.includes(platform)) {
                throw new Error(
                    `[springboard] Invalid platform "${platform}". Valid platforms: ${validPlatforms.join(', ')}`
                );
            }
        }
    }

    if (options.platforms?.includes('partykit') && !options.partykitName) {
        console.warn(
            '[springboard] Warning: PartyKit platform requires "partykitName" option for deployment'
        );
    }
}
