/**
 * Vite Plugin Utilities for Springboard
 *
 * Shared utilities for all Springboard Vite plugins.
 * These plugins work on USERLAND code only - dependencies are pre-compiled.
 */

import type { FilterPattern } from 'vite';
import type { PlatformMacroTarget, SpringboardPlatform, DocumentMeta } from '../types.js';

// Re-export types for convenience
export type { PlatformMacroTarget, SpringboardPlatform, DocumentMeta };

/**
 * Platform target mapping for conditional compilation
 * Maps high-level platform names to the actual platform macro target
 */
export const PLATFORM_TARGET_MAP: Record<string, PlatformMacroTarget> = {
    browser: 'browser',
    browser_offline: 'browser',
    node: 'node',
    fetch: 'fetch',
    'react-native': 'react-native',
    partykit: 'fetch', // PartyKit server uses fetch/neutral target
    desktop: 'browser', // Desktop webview uses browser target
    mobile: 'react-native',
    main: 'browser', // Default to browser for main
    all: 'browser', // Default to browser for all
};

/**
 * All supported platform macro targets
 */
export const ALL_PLATFORM_MACRO_TARGETS: PlatformMacroTarget[] = ['browser', 'node', 'fetch', 'react-native'];

/**
 * Default file filter patterns for TypeScript/JavaScript files
 */
export const DEFAULT_TS_FILTER: FilterPattern = /\.[jt]sx?$/;

/**
 * Default include patterns for userland code (excludes node_modules)
 */
export const DEFAULT_USERLAND_INCLUDE: FilterPattern = [
    /src\//,
    /app\//,
    /lib\//,
    /pages\//,
    /components\//,
];

/**
 * Default exclude patterns (node_modules, dist, etc.)
 */
export const DEFAULT_EXCLUDE: FilterPattern = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
];

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
    // Exclude non-JS/TS files
    if (!/\.[jt]sx?$/.test(id)) {
        return false;
    }
    return true;
}

/**
 * Create a filter function for file matching
 */
export function createFilter(
    include?: FilterPattern,
    exclude?: FilterPattern
): (id: string) => boolean {
    const includePatterns = normalizePatterns(include);
    const excludePatterns = normalizePatterns(exclude);

    return (id: string) => {
        // Check excludes first
        for (const pattern of excludePatterns) {
            if (matchPattern(id, pattern)) {
                return false;
            }
        }

        // If no include patterns, default to true
        if (includePatterns.length === 0) {
            return true;
        }

        // Check includes
        for (const pattern of includePatterns) {
            if (matchPattern(id, pattern)) {
                return true;
            }
        }

        return false;
    };
}

/**
 * Normalize filter patterns to an array of RegExp or string
 */
function normalizePatterns(pattern?: FilterPattern): (RegExp | string)[] {
    if (!pattern) {
        return [];
    }
    if (Array.isArray(pattern)) {
        return (pattern as (string | RegExp)[]).flatMap(p => normalizePatterns(p));
    }
    if (typeof pattern === 'string' || pattern instanceof RegExp) {
        return [pattern];
    }
    return [];
}

/**
 * Match a string against a pattern
 */
function matchPattern(str: string, pattern: RegExp | string): boolean {
    if (typeof pattern === 'string') {
        return str.includes(pattern);
    }
    return pattern.test(str);
}

/**
 * Generate platform-specific code transformation regex
 *
 * This creates a regex that matches @platform blocks for a specific platform
 *
 * @example
 * // @platform "browser"
 * export function getStorage() { return localStorage; }
 * // @platform end
 */
export function createPlatformBlockRegex(platform: PlatformMacroTarget): RegExp {
    return new RegExp(`\\/\\/ @platform "${platform}"([\\s\\S]*?)\\/\\/ @platform end`, 'g');
}

/**
 * Create regex that matches ANY platform block (for stripping non-matching platforms)
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
export function transformPlatformBlocks(source: string, targetPlatform: PlatformMacroTarget): string {
    // First, extract and keep the target platform's code (without the markers)
    const targetRegex = createPlatformBlockRegex(targetPlatform);
    let result = source.replace(targetRegex, '$1');

    // Then, remove all other platform blocks entirely
    const otherPlatformsRegex = createAnyPlatformBlockRegex();
    result = result.replace(otherPlatformsRegex, '');

    return result;
}

/**
 * Resolve the platform macro target from a high-level platform name
 */
export function resolvePlatformTarget(platform: string): PlatformMacroTarget {
    return PLATFORM_TARGET_MAP[platform] || 'browser';
}

/**
 * Inject meta tags into HTML content
 */
export function injectMetaTags(html: string, meta: DocumentMeta): string {
    let result = html;

    if (meta.title) {
        result = result.replace(/<title>(.*?)<\/title>/, `<title>${meta.title}</title>`);
    }

    for (const [key, value] of Object.entries(meta)) {
        if (key === 'title') {
            continue; // Already handled
        }

        if (key === 'Content-Security-Policy') {
            const metaTag = `<meta http-equiv="${key}" content="${value}">`;
            result = result.replace('</head>', `${metaTag}\n</head>`);
        } else {
            const metaTag = `<meta property="${key}" content="${value}">`;
            result = result.replace('</head>', `${metaTag}\n</head>`);
        }
    }

    return result;
}

/**
 * Inject script tags into HTML content (before </body>)
 */
export function injectScriptTags(html: string, scripts: string[]): string {
    let result = html;
    const bodyEnd = '</body>';

    for (const script of scripts) {
        const scriptTag = `<script type="module" src="${script}"></script>`;
        result = result.replace(bodyEnd, `${scriptTag}\n${bodyEnd}`);
    }

    return result;
}

/**
 * Inject link tags into HTML content (before </head>)
 */
export function injectLinkTags(html: string, links: string[]): string {
    let result = html;
    const headEnd = '</head>';

    for (const link of links) {
        const linkTag = `<link rel="stylesheet" href="${link}">`;
        result = result.replace(headEnd, `${linkTag}\n${headEnd}`);
    }

    return result;
}

/**
 * Logger utility for Vite plugins
 */
export function createPluginLogger(pluginName: string) {
    const prefix = `[springboard:${pluginName}]`;

    return {
        info: (message: string) => console.log(`${prefix} ${message}`),
        warn: (message: string) => console.warn(`${prefix} ${message}`),
        error: (message: string) => console.error(`${prefix} ${message}`),
        debug: (message: string) => {
            if (process.env.DEBUG) {
                console.debug(`${prefix} ${message}`);
            }
        },
    };
}

/**
 * Find node_modules parent folder by traversing up the directory tree
 */
export async function findNodeModulesParentFolder(): Promise<string | undefined> {
    const fs = await import('fs');
    const path = await import('path');

    let currentDir = process.cwd();

    while (true) {
        try {
            const nodeModulesPath = path.join(currentDir, 'node_modules');
            const stats = await fs.promises.stat(nodeModulesPath);

            if (stats.isDirectory()) {
                return currentDir;
            }
        } catch {
            const parentDir = path.dirname(currentDir);

            if (parentDir === currentDir) {
                break;
            }

            currentDir = parentDir;
        }
    }

    return undefined;
}

/**
 * Get the base path for assets (handles both dev and production modes)
 */
export function getAssetBasePath(isDev: boolean): string {
    return isDev ? '/' : '/dist/';
}

/**
 * Extract output files from Rollup bundle for HTML injection
 */
export function extractBundleAssets(bundle: Record<string, unknown>): {
    scripts: string[];
    styles: string[];
} {
    const scripts: string[] = [];
    const styles: string[] = [];

    for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.js')) {
            scripts.push(fileName);
        } else if (fileName.endsWith('.css')) {
            styles.push(fileName);
        }
    }

    return { scripts, styles };
}
