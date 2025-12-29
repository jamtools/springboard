/**
 * @deprecated This module is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * Legacy build APIs for backward compatibility with existing applications
 * that use the esbuild-based build system (e.g., SongDrive).
 *
 * Migration Guide:
 * 1. Replace `buildApplication` with Vite configuration using `springboard/vite-plugin`
 * 2. Replace `platformBrowserBuildConfig` with Vite's built-in browser targeting
 * 3. Replace `platformNodeBuildConfig` with Vite's SSR/Node configuration
 *
 * @example
 * ```typescript
 * // Old (deprecated):
 * import { buildApplication, platformBrowserBuildConfig } from 'springboard/legacy-cli';
 * await buildApplication(platformBrowserBuildConfig, { ... });
 *
 * // New (recommended):
 * import springboardPlugin from 'springboard/vite-plugin';
 * // Use in vite.config.ts with springboardPlugin()
 * ```
 */

import fs from 'fs';
import path from 'path';

import esbuild from 'esbuild';

import { esbuildPluginLogBuildTime } from './esbuild-plugins/esbuild_plugin_log_build_time.js';
import { esbuildPluginPlatformInject } from './esbuild-plugins/esbuild_plugin_platform_inject.js';
import { esbuildPluginHtmlGenerate } from './esbuild-plugins/esbuild_plugin_html_generate.js';
import { esbuildPluginPartykitConfig } from './esbuild-plugins/esbuild_plugin_partykit_config.js';

/**
 * @deprecated Use the new Vite-based build system instead.
 * Supported platform types for the legacy build system.
 */
export type SpringboardPlatform = 'all' | 'main' | 'mobile' | 'desktop' | 'browser_offline' | 'partykit';

type EsbuildOptions = Parameters<typeof esbuild.build>[0];

/**
 * @deprecated Use Vite plugins instead.
 * Type alias for esbuild plugins.
 */
export type EsbuildPlugin = esbuild.Plugin;

/**
 * @deprecated Use Vite configuration instead.
 * Configuration for a specific build target/platform.
 */
export type BuildConfig = {
    platform: NonNullable<EsbuildOptions['platform']>;
    name?: string;
    platformEntrypoint: () => string;
    esbuildPlugins?: (args: { outDir: string; nodeModulesParentDir: string; documentMeta?: DocumentMeta }) => EsbuildPlugin[];
    externals?: () => string[];
    additionalFiles?: Record<string, string>;
    fingerprint?: boolean;
};

type PluginConfig = { editBuildOptions?: (options: EsbuildOptions) => void } & Partial<Pick<BuildConfig, 'esbuildPlugins' | 'externals' | 'name' | 'additionalFiles'>>;

/**
 * @deprecated Use Vite plugins instead.
 * Plugin factory type for the legacy build system.
 */
export type Plugin = (buildConfig: BuildConfig) => PluginConfig;

/**
 * @deprecated Use Vite configuration instead.
 * Options for building an application.
 */
export type ApplicationBuildOptions = {
    name?: string;
    documentMeta?: DocumentMeta;
    plugins?: Plugin[];
    editBuildOptions?: (options: EsbuildOptions) => void;
    esbuildOutDir?: string;
    applicationEntrypoint?: string;
    nodeModulesParentFolder?: string;
    watch?: boolean;
    dev?: {
        reloadCss?: boolean;
        reloadJs?: boolean;
    };
};

/**
 * @deprecated Use Vite's HTML plugin or index.html configuration instead.
 * Metadata for the generated HTML document.
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
 * @deprecated Use Vite with browser target instead.
 * Build configuration for browser platform.
 *
 * Migration: Use Vite's default browser build configuration with springboard/vite-plugin.
 */
export const platformBrowserBuildConfig: BuildConfig = {
    platform: 'browser',
    fingerprint: true,
    platformEntrypoint: () => 'springboard/platforms/browser/entrypoints/online_entrypoint.ts',
    esbuildPlugins: (args) => [
        esbuildPluginPlatformInject('browser'),
        esbuildPluginHtmlGenerate(
            args.outDir,
            `${args.nodeModulesParentDir}/node_modules/springboard/src/platforms/browser/index.html`,
            args.documentMeta,
        ),
    ],
    additionalFiles: {},
};

/**
 * @deprecated Use Vite with browser target and PWA plugin instead.
 * Build configuration for offline-capable browser applications.
 */
export const platformOfflineBrowserBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    platformEntrypoint: () => 'springboard/platforms/browser/entrypoints/offline_entrypoint.ts',
};

/**
 * @deprecated Use Vite with SSR/Node configuration instead.
 * Build configuration for Node.js platform.
 *
 * Migration: Use Vite's SSR build mode with springboard/vite-plugin.
 */
export const platformNodeBuildConfig: BuildConfig = {
    platform: 'node',
    platformEntrypoint: () => {
        const entrypoint = 'springboard/platforms/node/entrypoints/node_server_entrypoint.ts';
        return entrypoint;
    },
    esbuildPlugins: () => [
        esbuildPluginPlatformInject('node'),
    ],
    externals: () => {
        let externals = [
            '@julusian/midi',
            'easymidi',
            'jsdom',
            // Server dependencies (needed by node_server_entrypoint.ts)
            'better-sqlite3',
            'kysely',
            '@hono/node-server',
            'hono'
        ];
        if (process.env.DISABLE_IO === 'true') {
            externals = ['jsdom', 'better-sqlite3', 'kysely', '@hono/node-server', 'hono'];
        }
        return externals;
    },
};

/**
 * @deprecated Use Vite with PartyKit configuration instead.
 * Build configuration for PartyKit server.
 */
export const platformPartykitServerBuildConfig: BuildConfig = {
    platform: 'neutral',
    platformEntrypoint: () => {
        const entrypoint = 'springboard/platforms/partykit/entrypoints/partykit_server_entrypoint.ts';
        return entrypoint;
    },
    esbuildPlugins: (args) => [
        esbuildPluginPlatformInject('fetch'),
        esbuildPluginPartykitConfig(args.outDir),
    ],
    externals: () => {
        const externals = ['@julusian/midi', 'easymidi', 'jsdom', 'node:async_hooks'];
        return externals;
    },
};

/**
 * @deprecated Use Vite with PartyKit configuration instead.
 * Build configuration for PartyKit browser client.
 */
export const platformPartykitBrowserBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    platformEntrypoint: () => 'springboard/platforms/partykit/entrypoints/partykit_browser_entrypoint.tsx',
};

const copyDesktopFiles = async (desktopPlatform: string) => {
    await fs.promises.mkdir(`apps/desktop_${desktopPlatform}/app/dist`, { recursive: true });

    if (fs.existsSync(`dist/${desktopPlatform}/browser/dist/index.css`)) {
        await fs.promises.copyFile(
            `dist/${desktopPlatform}/browser/dist/index.css`,
            `apps/desktop_${desktopPlatform}/app/dist/index.css`,
        );
    }

    await fs.promises.copyFile(
        `dist/${desktopPlatform}/browser/dist/index.js`,
        `apps/desktop_${desktopPlatform}/app/dist/index.js`,
    );

    await fs.promises.copyFile(
        `dist/${desktopPlatform}/browser/dist/index.html`,
        `apps/desktop_${desktopPlatform}/app/index.html`,
    );
};

/**
 * @deprecated Use Vite with Tauri configuration instead.
 * Build configuration for Tauri webview.
 */
export const platformTauriWebviewBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    fingerprint: false,
    platformEntrypoint: () => 'springboard/platforms/tauri/entrypoints/platform_tauri_browser.tsx',
    esbuildPlugins: (args) => [
        ...platformBrowserBuildConfig.esbuildPlugins!(args),
        {
            name: 'onBuildEnd',
            setup(build: esbuild.PluginBuild) {
                build.onEnd(async () => {
                    await copyDesktopFiles('tauri');
                });
            },
        },
    ],
};

/**
 * @deprecated Use Vite with Tauri configuration instead.
 * Build configuration for Tauri maestro (main process).
 */
export const platformTauriMaestroBuildConfig: BuildConfig = {
    ...platformNodeBuildConfig,
    platformEntrypoint: () => 'springboard/platforms/tauri/entrypoints/platform_tauri_maestro.ts',
};

const shouldOutputMetaFile = process.argv.includes('--meta');

/**
 * @deprecated Use Vite build system with springboard/vite-plugin instead.
 *
 * Builds an application using the legacy esbuild-based build system.
 *
 * Migration Guide:
 * Replace this function with a Vite configuration:
 *
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import springboard from 'springboard/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [springboard()],
 *   // ... other configuration
 * });
 * ```
 *
 * @param buildConfig - Platform-specific build configuration
 * @param options - Build options
 */
export const buildApplication = async (buildConfig: BuildConfig, options?: ApplicationBuildOptions) => {
    let coreFile = buildConfig.platformEntrypoint();

    let applicationEntrypoint = process.env.APPLICATION_ENTRYPOINT || options?.applicationEntrypoint;
    if (!applicationEntrypoint) {
        throw new Error('No application entrypoint provided');
    }

    const parentOutDir = process.env.ESBUILD_OUT_DIR || './dist';
    const childDir = options?.esbuildOutDir;

    const plugins = (options?.plugins || []).map(p => p(buildConfig));

    let outDir = parentOutDir;
    if (childDir) {
        outDir += '/' + childDir;
    }

    const fullOutDir = `${outDir}/${buildConfig.platform}/dist`;

    if (!fs.existsSync(fullOutDir)) {
        fs.mkdirSync(fullOutDir, { recursive: true });
    }

    const dynamicEntryPath = path.join(fullOutDir, 'dynamic-entry.js');

    if (path.isAbsolute(coreFile)) {
        coreFile = path.relative(fullOutDir, coreFile).replace(/\\/g, '/');
    }

    if (path.isAbsolute(applicationEntrypoint)) {
        applicationEntrypoint = path.relative(fullOutDir, applicationEntrypoint).replace(/\\/g, '/');
    }

    let allImports = `import initApp from '${coreFile}';
import '${applicationEntrypoint}';
export default initApp;
`;

    // For Node platform, auto-execute the entry point
    if (buildConfig.platform === 'node') {
        allImports += `\ninitApp();`;
    }

    fs.writeFileSync(dynamicEntryPath, allImports);

    const outFile = path.join(fullOutDir, buildConfig.platform === 'node' ? 'index.cjs' : 'index.js');

    const externals = buildConfig.externals?.() || [];
    externals.push('better-sqlite3');

    let nodeModulesParentFolder = process.env.NODE_MODULES_PARENT_FOLDER || options?.nodeModulesParentFolder;
    if (!nodeModulesParentFolder) {
        nodeModulesParentFolder = await findNodeModulesParentFolder();
    }
    if (!nodeModulesParentFolder) {
        throw new Error('Failed to find node_modules folder in current directory and parent directories');
    }

    const platformName = buildConfig.name || buildConfig.platform;
    const appName = options?.name;
    const fullName = appName ? appName + '-' + platformName : platformName;

    const esbuildOptions: EsbuildOptions = {
        entryPoints: [dynamicEntryPath],
        metafile: true,
        ...(buildConfig.fingerprint ? {
            assetNames: '[dir]/[name]-[hash]',
            chunkNames: '[dir]/[name]-[hash]',
            entryNames: '[dir]/[name]-[hash]',
        } : {}),
        bundle: true,
        sourcemap: true,
        outfile: outFile,
        platform: buildConfig.platform,
        mainFields: buildConfig.platform === 'neutral' ? ['module', 'main'] : undefined,
        minify: process.env.NODE_ENV === 'production',
        target: 'es2020',
        plugins: [
            esbuildPluginLogBuildTime(fullName),
            ...(buildConfig.esbuildPlugins?.({
                outDir: fullOutDir,
                nodeModulesParentDir: nodeModulesParentFolder,
                documentMeta: options?.documentMeta,
            }) || []),
            ...plugins.map(p => p.esbuildPlugins?.({
                outDir: fullOutDir,
                nodeModulesParentDir: nodeModulesParentFolder,
                documentMeta: options?.documentMeta,
            })?.filter(p => isNotUndefined(p)) || []).flat(),
        ],
        external: externals,
        alias: {},
        define: {
            'process.env.WS_HOST': `"${process.env.WS_HOST || ''}"`,
            'process.env.DATA_HOST': `"${process.env.DATA_HOST || ''}"`,
            'process.env.NODE_ENV': `"${process.env.NODE_ENV || ''}"`,
            'process.env.DISABLE_IO': `"${process.env.DISABLE_IO || ''}"`,
            'process.env.IS_SERVER': `"${process.env.IS_SERVER || ''}"`,
            'process.env.DEBUG_LOG_PERFORMANCE': `"${process.env.DEBUG_LOG_PERFORMANCE || ''}"`,
            'process.env.RELOAD_CSS': `"${options?.dev?.reloadCss || ''}"`,
            'process.env.RELOAD_JS': `"${options?.dev?.reloadJs || ''}"`,
        },
    };

    options?.editBuildOptions?.(esbuildOptions);
    for (const plugin of plugins) {
        plugin.editBuildOptions?.(esbuildOptions);
    }

    if (buildConfig.additionalFiles) {
        for (const srcFileName of Object.keys(buildConfig.additionalFiles)) {
            const destFileName = buildConfig.additionalFiles[srcFileName];

            const fullSrcFilePath = path.join(nodeModulesParentFolder, 'node_modules', srcFileName);
            const fullDestFilePath = `${fullOutDir}/${destFileName}`;
            await fs.promises.copyFile(fullSrcFilePath, fullDestFilePath);
        }
    }

    if (options?.watch) {
        const ctx = await esbuild.context(esbuildOptions);
        await ctx.watch();
        console.log(`Watching for changes for ${buildConfig.platform} application build...`);

        if (options?.dev?.reloadCss || options?.dev?.reloadJs) {
            await ctx.serve();
        }

        return;
    }

    const result = await esbuild.build(esbuildOptions);
    if (shouldOutputMetaFile) {
        await fs.promises.writeFile('esbuild_meta.json', JSON.stringify(result.metafile));
    }
};

/**
 * @deprecated Use Vite build system with springboard/vite-plugin instead.
 * Options for building a server.
 *
 * NOTE: The buildServer function has been removed. Node builds are now self-contained
 * using the node_server_entrypoint.ts which creates its own server infrastructure.
 */
export type ServerBuildOptions = {
    coreFile?: string;
    esbuildOutDir?: string;
    serverEntrypoint?: string;
    applicationDistPath?: string;
    watch?: boolean;
    editBuildOptions?: (options: EsbuildOptions) => void;
    plugins?: Plugin[];
};

// /**
//  * @deprecated REMOVED - Use platformNodeBuildConfig instead.
//  *
//  * The buildServer function has been removed because Node builds are now self-contained.
//  * The node_server_entrypoint.ts creates its own Hono + WebSocket server infrastructure
//  * and calls startNodeApp() with the proper dependencies.
//  *
//  * Previously, buildServer was used to create a separate server bundle that would:
//  * 1. Import server infrastructure from local-server.entrypoint.ts
//  * 2. Import the built node application
//  * 3. Wire them together at runtime
//  *
//  * Now, platformNodeBuildConfig points to node_server_entrypoint.ts which handles
//  * all of this in a single self-contained bundle.
//  *
//  * @param options - Server build options (no longer used)
//  */
// export const buildServer = async (options?: ServerBuildOptions) => {
//     const externals = ['better-sqlite3', '@julusian/midi', 'easymidi', 'jsdom'];
//
//     const parentOutDir = process.env.ESBUILD_OUT_DIR || './dist';
//     const childDir = options?.esbuildOutDir;
//
//     let outDir = parentOutDir;
//     if (childDir) {
//         outDir += '/' + childDir;
//     }
//
//     const fullOutDir = `${outDir}/server/dist`;
//
//     if (!fs.existsSync(fullOutDir)) {
//         fs.mkdirSync(fullOutDir, { recursive: true });
//     }
//
//     const outFile = path.join(fullOutDir, 'local-server.cjs');
//
//     let coreFile = options?.coreFile || 'springboard-server/src/entrypoints/local-server.entrypoint.ts';
//     let applicationDistPath = options?.applicationDistPath || '../../node/dist/dynamic-entry.js';
//     let serverEntrypoint = process.env.SERVER_ENTRYPOINT || options?.serverEntrypoint;
//
//     if (path.isAbsolute(coreFile)) {
//         coreFile = path.relative(fullOutDir, coreFile).replace(/\\/g, '/');
//     }
//
//     if (path.isAbsolute(applicationDistPath)) {
//         applicationDistPath = path.relative(fullOutDir, applicationDistPath).replace(/\\/g, '/');
//     }
//
//     if (serverEntrypoint && path.isAbsolute(serverEntrypoint)) {
//         serverEntrypoint = path.relative(fullOutDir, serverEntrypoint).replace(/\\/g, '/');
//     }
//
//     let allImports = `import createDeps from '${coreFile}';`;
//     if (serverEntrypoint) {
//         allImports += `import '${serverEntrypoint}';`;
//     }
//
//     allImports += `import app from '${applicationDistPath}';
// createDeps().then(deps => app(deps));
// `;
//
//     const dynamicEntryPath = path.join(fullOutDir, 'dynamic-entry.js');
//     fs.writeFileSync(dynamicEntryPath, allImports);
//
//     const buildOptions: EsbuildOptions = {
//         entryPoints: [dynamicEntryPath],
//         metafile: shouldOutputMetaFile,
//         bundle: true,
//         sourcemap: true,
//         outfile: outFile,
//         platform: 'node',
//         minify: process.env.NODE_ENV === 'production',
//         target: 'es2020',
//         plugins: [
//             esbuildPluginLogBuildTime('server'),
//             esbuildPluginPlatformInject('node'),
//             ...(options?.plugins?.map(p => p({ platform: 'node', platformEntrypoint: () => '' }).esbuildPlugins?.({
//                 outDir: fullOutDir,
//                 nodeModulesParentDir: '',
//                 documentMeta: {},
//             })?.filter(p => isNotUndefined(p)) || []).flat() || []),
//         ],
//         external: externals,
//         define: {
//             'process.env.NODE_ENV': `"${process.env.NODE_ENV || ''}"`,
//         },
//     };
//
//     options?.editBuildOptions?.(buildOptions);
//
//     if (options?.watch) {
//         const ctx = await esbuild.context(buildOptions);
//         await ctx.watch();
//         console.log('Watching for changes for server build...');
//     } else {
//         const result = await esbuild.build(buildOptions);
//         if (shouldOutputMetaFile) {
//             await fs.promises.writeFile('esbuild_meta_server.json', JSON.stringify(result.metafile));
//         }
//     }
// };

const findNodeModulesParentFolder = async () => {
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
};

type NotUndefined<T> = T extends undefined ? never : T;

const isNotUndefined = <T>(value: T): value is NotUndefined<T> => value !== undefined;
