/**
 * Shared Plugin Utilities
 *
 * Common utilities used across all Springboard plugins.
 */

/**
 * Logger interface for plugins
 */
export interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug: (message: string) => void;
}

/**
 * Create a logger for a plugin
 *
 * @param pluginName - Name of the plugin (without prefix)
 * @param debug - Whether to enable debug logging
 * @returns Logger instance
 */
export function createLogger(pluginName: string, debug: boolean = false): Logger {
    const prefix = `[springboard:${pluginName}]`;

    return {
        info: (message: string) => {
            console.log(`${prefix} ${message}`);
        },
        warn: (message: string) => {
            console.warn(`${prefix} ${message}`);
        },
        error: (message: string) => {
            console.error(`${prefix} ${message}`);
        },
        debug: (message: string) => {
            if (debug || process.env.DEBUG) {
                console.debug(`${prefix} ${message}`);
            }
        },
    };
}

/**
 * Check if a file path is userland code (not from node_modules)
 */
export function isUserlandCode(id: string): boolean {
    // Exclude node_modules
    if (id.includes('node_modules')) {
        return false;
    }
    // Exclude virtual modules
    if (id.startsWith('\0')) {
        return false;
    }
    // Only process JS/TS files
    if (!/\.[jt]sx?$/.test(id)) {
        return false;
    }
    return true;
}

/**
 * All supported platform macro targets
 */
export const ALL_PLATFORM_MACRO_TARGETS = ['browser', 'node', 'fetch', 'react-native'] as const;

/**
 * Create regex that matches a specific platform block
 */
export function createPlatformBlockRegex(platform: string): RegExp {
    return new RegExp(`\\/\\/ @platform "${platform}"([\\s\\S]*?)\\/\\/ @platform end`, 'g');
}

/**
 * Create regex that matches ANY platform block
 */
export function createAnyPlatformBlockRegex(): RegExp {
    const platforms = ALL_PLATFORM_MACRO_TARGETS.join('|');
    return new RegExp(`\\/\\/ @platform "(${platforms})"([\\s\\S]*?)\\/\\/ @platform end`, 'g');
}

/**
 * Transform source code by keeping only the target platform's code blocks
 *
 * @param source - The source code to transform
 * @param targetPlatform - The platform to keep code for
 * @returns Transformed source code
 */
export function transformPlatformBlocks(source: string, targetPlatform: string): string {
    // First, extract and keep the target platform's code (without the markers)
    const targetRegex = createPlatformBlockRegex(targetPlatform);
    let result = source.replace(targetRegex, '$1');

    // Then, remove all other platform blocks entirely
    const otherPlatformsRegex = createAnyPlatformBlockRegex();
    result = result.replace(otherPlatformsRegex, '');

    return result;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
