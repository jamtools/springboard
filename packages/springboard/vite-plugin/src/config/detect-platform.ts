/**
 * Platform Detection
 *
 * Detects the current platform based on environment variables and Vite config.
 */

import type { ConfigEnv } from 'vite';
import type { Platform, NormalizedOptions } from '../types.js';

/**
 * Environment variable name for platform override
 */
export const PLATFORM_ENV_VAR = 'SPRINGBOARD_PLATFORM';

/**
 * Detect the current platform from environment and config.
 *
 * Priority:
 * 1. SPRINGBOARD_PLATFORM environment variable
 * 2. Vite's SSR build flag (maps to node)
 * 3. First platform in the platforms array
 *
 * @param env - Vite config environment
 * @param platforms - List of target platforms
 * @returns Detected platform
 */
export function detectPlatform(
    env: ConfigEnv,
    platforms: Platform[]
): Platform {
    // Check environment variable first
    const envPlatform = process.env[PLATFORM_ENV_VAR] as Platform | undefined;
    if (envPlatform && isValidPlatform(envPlatform)) {
        return envPlatform;
    }

    // Check if this is an SSR build (typically means node/server)
    if (env.isSsrBuild) {
        // Find a server platform in the list
        const serverPlatform = platforms.find(p => p === 'node' || p === 'partykit');
        if (serverPlatform) {
            return serverPlatform;
        }
    }

    // Default to first platform
    return platforms[0] || 'browser';
}

/**
 * Check if a string is a valid platform
 */
export function isValidPlatform(platform: string): platform is Platform {
    const validPlatforms: Platform[] = [
        'browser',
        'node',
        'partykit',
        'tauri',
        'react-native',
    ];
    return validPlatforms.includes(platform as Platform);
}

/**
 * Get platform from options, with environment override
 */
export function getPlatformFromOptions(options: NormalizedOptions): Platform {
    const envPlatform = process.env[PLATFORM_ENV_VAR] as Platform | undefined;
    if (envPlatform && isValidPlatform(envPlatform)) {
        return envPlatform;
    }
    return options.platform;
}

/**
 * Set the platform environment variable for child processes
 */
export function setPlatformEnv(platform: Platform): void {
    process.env[PLATFORM_ENV_VAR] = platform;
}

/**
 * Clear the platform environment variable
 */
export function clearPlatformEnv(): void {
    delete process.env[PLATFORM_ENV_VAR];
}

/**
 * Run a function with a specific platform set in environment
 */
export async function withPlatform<T>(
    platform: Platform,
    fn: () => T | Promise<T>
): Promise<T> {
    const previousPlatform = process.env[PLATFORM_ENV_VAR];
    setPlatformEnv(platform);
    try {
        return await fn();
    } finally {
        if (previousPlatform) {
            process.env[PLATFORM_ENV_VAR] = previousPlatform;
        } else {
            clearPlatformEnv();
        }
    }
}
