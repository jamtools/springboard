/**
 * Platform Configurations
 *
 * Default Vite configurations for each platform.
 * These provide sensible defaults that can be overridden by users.
 */

import type { UserConfig } from 'vite';
import type { Platform, NormalizedOptions } from '../types.js';

/**
 * Node.js built-in modules to externalize
 */
const NODE_BUILTINS = [
    'assert',
    'buffer',
    'child_process',
    'cluster',
    'crypto',
    'dgram',
    'dns',
    'domain',
    'events',
    'fs',
    'fs/promises',
    'http',
    'http2',
    'https',
    'inspector',
    'module',
    'net',
    'os',
    'path',
    'perf_hooks',
    'process',
    'punycode',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'sys',
    'timers',
    'tls',
    'trace_events',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'wasi',
    'worker_threads',
    'zlib',
];

/**
 * Get Vite configuration for browser platform
 */
export function getBrowserConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            outDir: `${options.outDir}/browser`,
            target: 'esnext',
            modulePreload: { polyfill: true },
            rollupOptions: {
                input: 'virtual:springboard-entry',
                output: {
                    format: 'es',
                    entryFileNames: '[name].[hash].js',
                    chunkFileNames: '[name].[hash].js',
                    assetFileNames: '[name].[hash][extname]',
                },
            },
        },
        resolve: {
            conditions: ['browser', 'import', 'module', 'default'],
        },
        define: {
            __PLATFORM__: JSON.stringify('browser'),
            __IS_BROWSER__: 'true',
            __IS_NODE__: 'false',
            __IS_SERVER__: 'false',
            __IS_MOBILE__: 'false',
        },
    };
}

/**
 * Get Vite configuration for Node.js platform
 */
export function getNodeConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            outDir: `${options.outDir}/node`,
            target: 'node18',
            ssr: true,
            rollupOptions: {
                input: 'virtual:springboard-entry',
                external: [
                    ...NODE_BUILTINS,
                    ...NODE_BUILTINS.map(m => `node:${m}`),
                    // Externalize React and other peer dependencies
                    'react',
                    'react-dom',
                    'react-dom/server',
                    'react/jsx-runtime',
                    'react/jsx-dev-runtime',
                    'springboard',
                    'hono',
                    '@hono/node-server',
                    '@hono/node-ws',
                    'rxjs',
                    'immer',
                    'json-rpc-2.0',
                    /^react\//,  // All react imports
                    /^springboard\//,  // All springboard imports
                ],
                output: {
                    format: 'es',
                    entryFileNames: '[name].js',
                    chunkFileNames: '[name].js',
                },
            },
        },
        resolve: {
            conditions: ['node', 'import', 'module', 'default'],
        },
        ssr: {
            target: 'node',
            noExternal: true,
        },
        define: {
            __PLATFORM__: JSON.stringify('node'),
            __IS_BROWSER__: 'false',
            __IS_NODE__: 'true',
            __IS_SERVER__: 'true',
            __IS_MOBILE__: 'false',
        },
    };
}

/**
 * Get Vite configuration for PartyKit platform
 */
export function getPartykitConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            outDir: `${options.outDir}/partykit/server`,
            target: 'esnext',
            ssr: true,
            rollupOptions: {
                input: 'virtual:springboard-entry',
                external: [
                    /^cloudflare:.*/,
                    'partykit',
                    'partysocket',
                    // Externalize React and other peer dependencies
                    'react',
                    'react-dom',
                    'react-dom/server',
                    'react/jsx-runtime',
                    'react/jsx-dev-runtime',
                    'springboard',
                    /^react\//,
                    /^springboard\//,
                ],
                output: {
                    format: 'es',
                    entryFileNames: 'index.js',
                    chunkFileNames: '[name].js',
                },
            },
        },
        resolve: {
            conditions: ['workerd', 'worker', 'browser', 'import', 'module', 'default'],
        },
        ssr: {
            target: 'webworker',
            noExternal: true,
        },
        define: {
            __PLATFORM__: JSON.stringify('partykit'),
            __IS_BROWSER__: 'false',
            __IS_NODE__: 'false',
            __IS_SERVER__: 'true',
            __IS_MOBILE__: 'false',
            __IS_FETCH__: 'true',
        },
    };
}

/**
 * Get Vite configuration for Tauri platform
 * Tauri uses browser-like rendering with native APIs
 */
export function getTauriConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            outDir: `${options.outDir}/tauri`,
            target: 'esnext',
            rollupOptions: {
                input: 'virtual:springboard-entry',
                output: {
                    format: 'es',
                    entryFileNames: '[name].[hash].js',
                    chunkFileNames: '[name].[hash].js',
                    assetFileNames: '[name].[hash][extname]',
                },
            },
        },
        resolve: {
            conditions: ['browser', 'import', 'module', 'default'],
        },
        define: {
            __PLATFORM__: JSON.stringify('tauri'),
            __IS_BROWSER__: 'true',
            __IS_NODE__: 'false',
            __IS_SERVER__: 'false',
            __IS_MOBILE__: 'false',
            __IS_TAURI__: 'true',
        },
    };
}

/**
 * Get Vite configuration for React Native platform
 */
export function getReactNativeConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            outDir: `${options.outDir}/react-native`,
            target: 'esnext',
            lib: {
                entry: 'virtual:springboard-entry',
                formats: ['es'],
                fileName: 'index',
            },
            rollupOptions: {
                external: [
                    'react',
                    'react-native',
                    /^@react-native.*/,
                    /^react-native-.*/,
                ],
                output: {
                    format: 'es',
                    entryFileNames: '[name].js',
                },
            },
        },
        resolve: {
            conditions: ['react-native', 'import', 'module', 'default'],
        },
        define: {
            __PLATFORM__: JSON.stringify('react-native'),
            __IS_BROWSER__: 'false',
            __IS_NODE__: 'false',
            __IS_SERVER__: 'false',
            __IS_MOBILE__: 'true',
        },
    };
}

/**
 * Get platform-specific Vite configuration
 */
export function getPlatformConfig(options: NormalizedOptions): UserConfig {
    switch (options.platform) {
        case 'browser':
            return getBrowserConfig(options);
        case 'node':
            return getNodeConfig(options);
        case 'partykit':
            return getPartykitConfig(options);
        case 'tauri':
            return getTauriConfig(options);
        case 'react-native':
            return getReactNativeConfig(options);
        default:
            return getBrowserConfig(options);
    }
}

/**
 * Get resolve conditions for a platform
 */
export function getResolveConditions(platform: Platform): string[] {
    switch (platform) {
        case 'browser':
        case 'tauri':
            return ['browser', 'import', 'module', 'default'];
        case 'node':
            return ['node', 'import', 'module', 'default'];
        case 'partykit':
            return ['workerd', 'worker', 'browser', 'import', 'module', 'default'];
        case 'react-native':
            return ['react-native', 'import', 'module', 'default'];
        default:
            return ['import', 'module', 'default'];
    }
}

/**
 * Check if platform is browser-like (renders HTML)
 */
export function isBrowserPlatform(platform: Platform): boolean {
    return platform === 'browser' || platform === 'tauri';
}

/**
 * Check if platform is server-side
 */
export function isServerPlatform(platform: Platform): boolean {
    return platform === 'node' || platform === 'partykit';
}
