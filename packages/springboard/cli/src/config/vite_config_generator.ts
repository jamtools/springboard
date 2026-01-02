/**
 * Vite Config Generator
 *
 * Generates Vite configurations for each platform target.
 * This is the core of Option D (Monolithic CLI Wrapper) - hiding Vite complexity
 * behind a simple interface.
 */

import path from 'path';
import type { InlineConfig, Plugin as VitePlugin } from 'vite';
import type {
    PlatformBuildConfig,
    PlatformMacroTarget,
    DocumentMeta,
    Plugin,
} from '../types.js';
import {
    vitePluginPlatformInject,
    vitePluginHtmlGenerate,
    vitePluginPartykitConfig,
    vitePluginTransformAwaitImport,
    vitePluginLogBuildTime,
    vitePluginCopyFiles,
    vitePluginSpringboardConditions,
} from '../vite_plugins/index.js';

/**
 * Platform build configurations
 */
export const platformConfigs: Record<string, PlatformBuildConfig> = {
    browser: {
        target: 'browser',
        name: 'browser',
        platformEntrypoint: 'springboard/platforms/browser/entrypoints/online_entrypoint.ts',
        platformMacro: 'browser',
        outDir: 'browser/dist',
        fingerprint: true,
        htmlTemplate: 'springboard/platforms/browser/index.html',
        format: 'es',
    },

    browser_offline: {
        target: 'browser',
        name: 'browser_offline',
        platformEntrypoint: 'springboard/platforms/browser/entrypoints/offline_entrypoint.ts',
        platformMacro: 'browser',
        outDir: 'browser_offline/dist',
        fingerprint: true,
        htmlTemplate: 'springboard/platforms/browser/index.html',
        format: 'es',
    },

    node: {
        target: 'node',
        name: 'node',
        platformEntrypoint: 'springboard/platforms/node/entrypoints/node_flexible_entrypoint.ts',
        platformMacro: 'node',
        outDir: 'node/dist',
        format: 'cjs',
        externals: ['@julusian/midi', 'easymidi', 'jsdom', 'better-sqlite3'],
    },

    partykit_server: {
        target: 'neutral',
        name: 'partykit-server',
        platformEntrypoint: 'springboard/platforms/partykit/entrypoints/partykit_server_entrypoint.ts',
        platformMacro: 'fetch',
        outDir: 'partykit/neutral/dist',
        format: 'es',
        externals: ['@julusian/midi', 'easymidi', 'jsdom', 'node:async_hooks'],
    },

    partykit_browser: {
        target: 'browser',
        name: 'partykit-browser',
        platformEntrypoint: 'springboard/platforms/partykit/entrypoints/partykit_browser_entrypoint.tsx',
        platformMacro: 'browser',
        outDir: 'partykit/browser/dist',
        fingerprint: true,
        htmlTemplate: 'springboard/platforms/browser/index.html',
        format: 'es',
    },

    tauri_webview: {
        target: 'browser',
        name: 'tauri-webview',
        platformEntrypoint: 'springboard/platforms/tauri/entrypoints/platform_tauri_browser.tsx',
        platformMacro: 'browser',
        outDir: 'tauri/browser/dist',
        fingerprint: false,
        htmlTemplate: 'springboard/platforms/browser/index.html',
        format: 'es',
    },

    tauri_maestro: {
        target: 'node',
        name: 'tauri-maestro',
        platformEntrypoint: 'springboard/platforms/tauri/entrypoints/platform_tauri_maestro.ts',
        platformMacro: 'node',
        outDir: 'tauri/node/dist',
        format: 'cjs',
        externals: ['@julusian/midi', 'easymidi', 'jsdom', 'better-sqlite3'],
    },

    server: {
        target: 'node',
        name: 'server',
        platformEntrypoint: 'springboard/platforms/node/entrypoints/node_server_entrypoint.ts',
        platformMacro: 'node',
        outDir: 'server/dist',
        format: 'cjs',
        externals: ['better-sqlite3', '@julusian/midi', 'easymidi', 'jsdom'],
    },

    mobile: {
        target: 'browser',
        name: 'mobile',
        platformEntrypoint: 'springboard/platforms/react-native/entrypoints/react_native_entrypoint.ts',
        platformMacro: 'react-native',
        outDir: 'mobile/dist',
        format: 'es',
    },
};

/**
 * Options for generating a Vite config
 */
export interface ViteConfigOptions {
    /** Application entrypoint file */
    applicationEntrypoint: string;
    /** Platform configuration */
    platformConfig: PlatformBuildConfig;
    /** Custom plugins */
    plugins?: Plugin[];
    /** Document metadata for HTML */
    documentMeta?: DocumentMeta;
    /** Root directory for build */
    rootDir?: string;
    /** Base output directory */
    baseOutDir?: string;
    /** Path to node_modules parent folder */
    nodeModulesParentDir?: string;
    /** Watch mode */
    watch?: boolean;
    /** Development mode */
    dev?: boolean;
    /** Custom define values */
    customDefines?: Record<string, string>;
}

/**
 * Find the node_modules parent folder by traversing up the directory tree
 */
export async function findNodeModulesParentFolder(startDir?: string): Promise<string | undefined> {
    const fs = await import('fs');
    let currentDir = startDir || process.cwd();

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
 * Generate a Vite configuration for a specific platform
 */
export async function generateViteConfig(options: ViteConfigOptions): Promise<InlineConfig> {
    const {
        applicationEntrypoint,
        platformConfig,
        plugins = [],
        documentMeta,
        rootDir = process.cwd(),
        baseOutDir = './dist',
        nodeModulesParentDir,
        watch = false,
        dev = false,
        customDefines = {},
    } = options;

    const fullOutDir = path.join(baseOutDir, platformConfig.outDir);
    const resolvedNodeModulesDir = nodeModulesParentDir || await findNodeModulesParentFolder(rootDir);

    if (!resolvedNodeModulesDir) {
        throw new Error('Failed to find node_modules folder');
    }

    // Build the list of Vite plugins
    const vitePlugins: VitePlugin[] = [
        vitePluginLogBuildTime(platformConfig.name),
        vitePluginSpringboardConditions({
            target: platformConfig.platformMacro,
        }),
        vitePluginPlatformInject({
            platform: platformConfig.platformMacro,
        }),
    ];

    // Add HTML generation for browser targets
    if (platformConfig.target === 'browser' && platformConfig.htmlTemplate) {
        const templatePath = resolveModulePath(platformConfig.htmlTemplate, resolvedNodeModulesDir);
        vitePlugins.push(
            vitePluginHtmlGenerate({
                templatePath,
                documentMeta,
                outDir: fullOutDir,
            })
        );
    }

    // Add PartyKit config generation for partykit server
    if (platformConfig.name === 'partykit-server') {
        vitePlugins.push(
            vitePluginPartykitConfig({
                name: 'partykit-app',
                baseOutDir: 'dist/partykit',
            })
        );
    }

    // Add await import transformation for Tauri maestro
    if (platformConfig.name === 'tauri-maestro') {
        vitePlugins.push(vitePluginTransformAwaitImport());
    }

    // Add Tauri file copy plugin for webview builds
    if (platformConfig.name === 'tauri-webview') {
        vitePlugins.push(
            vitePluginCopyFiles({
                copies: [
                    { from: `${fullOutDir}/index.css`, to: 'apps/desktop_tauri/app/dist/index.css' },
                    { from: `${fullOutDir}/index.js`, to: 'apps/desktop_tauri/app/dist/index.js' },
                    { from: `${fullOutDir}/index.html`, to: 'apps/desktop_tauri/app/index.html' },
                ],
            })
        );
    }

    // Add plugins from user-provided plugin functions
    const pluginConfigs = plugins.map(p => p(platformConfig));
    for (const pluginConfig of pluginConfigs) {
        if (pluginConfig.vitePlugins) {
            const additionalPlugins = pluginConfig.vitePlugins({
                outDir: fullOutDir,
                nodeModulesParentDir: resolvedNodeModulesDir,
                documentMeta,
            });
            vitePlugins.push(...additionalPlugins);
        }
    }

    // Collect externals
    const externals = [
        ...(platformConfig.externals || []),
        ...pluginConfigs.flatMap(p => p.externals?.() || []),
    ];

    // Build define values
    const define: Record<string, string> = {
        'process.env.WS_HOST': `"${process.env.WS_HOST || ''}"`,
        'process.env.DATA_HOST': `"${process.env.DATA_HOST || ''}"`,
        'process.env.NODE_ENV': `"${process.env.NODE_ENV || (dev ? 'development' : 'production')}"`,
        'process.env.DISABLE_IO': `"${process.env.DISABLE_IO || ''}"`,
        'process.env.IS_SERVER': `"${process.env.IS_SERVER || ''}"`,
        'process.env.DEBUG_LOG_PERFORMANCE': `"${process.env.DEBUG_LOG_PERFORMANCE || ''}"`,
        'process.env.RELOAD_CSS': `"${dev}"`,
        'process.env.RELOAD_JS': `"${dev}"`,
        ...customDefines,
    };

    // Build Vite config
    const config: InlineConfig = {
        root: rootDir,
        mode: dev ? 'development' : 'production',
        plugins: vitePlugins,
        define,

        resolve: {
            alias: {
                '@springboard': path.resolve(rootDir, 'packages/springboard'),
            },
            // Set resolve conditions based on platform
            conditions: platformConfig.target === 'node'
                ? ['node', 'import', 'module', 'default']
                : ['browser', 'import', 'module', 'default'],
        },

        build: {
            outDir: fullOutDir,
            emptyOutDir: true,
            sourcemap: true,
            minify: !dev && process.env.NODE_ENV === 'production',
            target: 'es2020',
            watch: watch ? {} : null,

            // Configure output based on platform
            rollupOptions: {
                input: createVirtualEntry(
                    platformConfig.platformEntrypoint,
                    applicationEntrypoint,
                    fullOutDir,
                    resolvedNodeModulesDir
                ),
                output: {
                    format: platformConfig.format || 'es',
                    entryFileNames: platformConfig.fingerprint ? '[name]-[hash].js' : '[name].js',
                    chunkFileNames: platformConfig.fingerprint ? '[name]-[hash].js' : '[name].js',
                    assetFileNames: platformConfig.fingerprint ? '[name]-[hash][extname]' : '[name][extname]',
                },
                external: externals,
            },

            // SSR settings for node/neutral targets
            ...(platformConfig.target === 'node' || platformConfig.target === 'neutral' ? {
                ssr: true,
            } : {}),
        },

        // SSR config for server-side builds
        ...(platformConfig.target === 'node' || platformConfig.target === 'neutral' ? {
            ssr: {
                target: platformConfig.target === 'node' ? 'node' : 'webworker',
                noExternal: true,
                external: externals,
            },
        } : {}),

        // Optimize deps for browser builds
        ...(platformConfig.target === 'browser' ? {
            optimizeDeps: {
                include: ['react', 'react-dom'],
            },
        } : {}),

        // Logging
        logLevel: 'info',
        clearScreen: false,
    };

    // Apply plugin config modifications
    for (const pluginConfig of pluginConfigs) {
        pluginConfig.editViteConfig?.(config);
    }

    return config;
}

/**
 * Create a virtual entry point that imports the platform entrypoint and application
 */
function createVirtualEntry(
    platformEntrypoint: string,
    applicationEntrypoint: string,
    outDir: string,
    nodeModulesDir: string
): string {
    const fs = require('fs');

    // Resolve the platform entrypoint
    let resolvedPlatformEntry = platformEntrypoint;
    if (!path.isAbsolute(platformEntrypoint) && !platformEntrypoint.startsWith('.')) {
        resolvedPlatformEntry = resolveModulePath(platformEntrypoint, nodeModulesDir);
    }

    // Create the dynamic entry content
    const entryContent = `
import initApp from '${resolvedPlatformEntry}';
import '${applicationEntrypoint}';
export default initApp;
`;

    // Ensure output directory exists
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Write the dynamic entry file
    const dynamicEntryPath = path.join(outDir, 'dynamic-entry.js');
    fs.writeFileSync(dynamicEntryPath, entryContent);

    return dynamicEntryPath;
}

/**
 * Resolve a module specifier to an absolute path
 */
function resolveModulePath(moduleSpecifier: string, nodeModulesDir: string): string {
    // If it's an absolute path, return as-is
    if (path.isAbsolute(moduleSpecifier)) {
        return moduleSpecifier;
    }

    // If it starts with @, it's a scoped package
    if (moduleSpecifier.startsWith('@')) {
        return path.join(nodeModulesDir, 'node_modules', moduleSpecifier);
    }

    // Otherwise, check if it's a package reference
    if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
        return path.join(nodeModulesDir, 'node_modules', moduleSpecifier);
    }

    return moduleSpecifier;
}

/**
 * Generate server build config
 */
export async function generateServerConfig(options: {
    rootDir?: string;
    baseOutDir?: string;
    applicationDistPath?: string;
    serverEntrypoint?: string;
    plugins?: Plugin[];
    watch?: boolean;
    customDefines?: Record<string, string>;
}): Promise<InlineConfig> {
    const {
        rootDir = process.cwd(),
        baseOutDir = './dist',
        applicationDistPath = '../../node/dist/dynamic-entry.js',
        serverEntrypoint,
        plugins = [],
        watch = false,
        customDefines = {},
    } = options;

    const serverConfig = platformConfigs.server;
    const fullOutDir = path.join(baseOutDir, serverConfig.outDir);
    const nodeModulesDir = await findNodeModulesParentFolder(rootDir);

    if (!nodeModulesDir) {
        throw new Error('Failed to find node_modules folder');
    }

    // Build the list of Vite plugins
    const vitePlugins: VitePlugin[] = [
        vitePluginLogBuildTime(serverConfig.name),
        vitePluginSpringboardConditions({
            target: serverConfig.platformMacro,
        }),
        vitePluginPlatformInject({
            platform: serverConfig.platformMacro,
        }),
    ];

    // Add plugins from user-provided plugin functions
    const pluginConfigs = plugins.map(p => p(serverConfig));
    for (const pluginConfig of pluginConfigs) {
        if (pluginConfig.vitePlugins) {
            const additionalPlugins = pluginConfig.vitePlugins({
                outDir: fullOutDir,
                nodeModulesParentDir: nodeModulesDir,
            });
            vitePlugins.push(...additionalPlugins);
        }
    }

    // Collect externals
    const externals = [
        ...(serverConfig.externals || []),
        ...pluginConfigs.flatMap(p => p.externals?.() || []),
    ];

    // Create server entry content
    const fs = require('fs');
    let entryContent = `import createDeps from '${serverConfig.platformEntrypoint}';`;
    if (serverEntrypoint) {
        entryContent += `\nimport '${serverEntrypoint}';`;
    }
    entryContent += `
import app from '${applicationDistPath}';
createDeps().then(deps => app(deps));
`;

    // Ensure output directory exists
    if (!fs.existsSync(fullOutDir)) {
        fs.mkdirSync(fullOutDir, { recursive: true });
    }

    const dynamicEntryPath = path.join(fullOutDir, 'dynamic-entry.js');
    fs.writeFileSync(dynamicEntryPath, entryContent);

    // Build define values
    const define: Record<string, string> = {
        'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'production'}"`,
        ...customDefines,
    };

    const config: InlineConfig = {
        root: rootDir,
        mode: 'production',
        plugins: vitePlugins,
        define,

        build: {
            outDir: fullOutDir,
            emptyOutDir: true,
            sourcemap: true,
            minify: process.env.NODE_ENV === 'production',
            target: 'es2020',
            watch: watch ? {} : null,

            rollupOptions: {
                input: dynamicEntryPath,
                output: {
                    format: 'cjs',
                    entryFileNames: 'local-server.cjs',
                },
                external: externals,
            },

            ssr: true,
        },

        ssr: {
            target: 'node',
            noExternal: true,
            external: externals,
        },

        logLevel: 'info',
        clearScreen: false,
    };

    return config;
}
