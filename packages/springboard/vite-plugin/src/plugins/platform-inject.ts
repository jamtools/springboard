/**
 * Platform Inject Plugin
 *
 * Transforms @platform comment blocks based on target platform.
 * All platform transformation logic lives in this single file.
 *
 * Example usage:
 * ```ts
 * // @platform "browser"
 * export function getStorage() {
 *   return localStorage;
 * }
 * // @platform end
 *
 * // @platform "node"
 * export function getStorage() {
 *   return nodeStorage;
 * }
 * // @platform end
 * ```
 */

const ALL_PLATFORM_MACRO_TARGETS = ['browser', 'node', 'fetch', 'react-native'] as const;

/**
 * Create regex that matches a specific platform block
 */
function createPlatformBlockRegex(platform: string): RegExp {
    return new RegExp(`\\/\\/ @platform "${platform}"([\\s\\S]*?)\\/\\/ @platform end`, 'g');
}

/**
 * Create regex that matches ANY platform block
 */
function createAnyPlatformBlockRegex(): RegExp {
    const platforms = ALL_PLATFORM_MACRO_TARGETS.join('|');
    return new RegExp(`\\/\\/ @platform "(${platforms})"([\\s\\S]*?)\\/\\/ @platform end`, 'g');
}

/**
 * Transform source code by keeping only the target platform's code blocks
 * and removing all other platform blocks.
 *
 * @param source - The source code to transform
 * @param targetPlatform - The platform to keep code for ('browser' or 'node')
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
 * Apply platform transform to code if it contains platform markers.
 * This is the main entry point for the Vite plugin transform hook.
 *
 * @param code - Source code
 * @param id - File path
 * @param targetPlatform - Target platform ('browser' or 'node')
 * @returns Transformed code or null if no transformation needed
 */
export function applyPlatformTransform(
    code: string,
    id: string,
    targetPlatform: 'browser' | 'node'
): { code: string; map: null } | null {
    // Only process TypeScript/JavaScript files
    if (!/\.[tj]sx?$/.test(id)) {
        return null;
    }

    // Skip node_modules
    if (id.includes('node_modules')) {
        return null;
    }

    // Quick check: skip if file doesn't contain platform markers
    if (!code.includes('// @platform')) {
        return null;
    }

    // Transform the platform blocks
    const transformedCode = transformPlatformBlocks(code, targetPlatform);

    // Only return if the code was actually changed
    if (transformedCode === code) {
        return null;
    }

    return {
        code: transformedCode,
        map: null, // Let Vite handle source maps
    };
}
