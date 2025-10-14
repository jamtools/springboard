import fs from 'fs';
import path from 'path';

import esbuild from 'esbuild';

import {esbuildPluginLogBuildTime} from './esbuild_plugins/esbuild_plugin_log_build_time';
import {esbuildPluginPlatformInject} from './esbuild_plugins/esbuild_plugin_platform_inject.js';
import {esbuildPluginHtmlGenerate} from './esbuild_plugins/esbuild_plugin_html_generate';
import {esbuildPluginCfWorkersConfig} from './esbuild_plugins/esbuild_plugin_cf_workers_config';

export type SpringboardPlatform = 'all' | 'main' | 'mobile' | 'desktop' | 'browser_offline' | 'cf-workers';

type EsbuildOptions = Parameters<typeof esbuild.build>[0];

export type EsbuildPlugin = esbuild.Plugin;

export type BuildConfig = {
    platform: NonNullable<EsbuildOptions['platform']>;
    name?: string;
    platformEntrypoint: () => string;
    esbuildPlugins?: (args: {
        outDir: string;
        nodeModulesParentDir: string;
        documentMeta?: DocumentMeta;
        name?: string;
    }) => esbuild.Plugin[];
    externals?: () => string[];
    additionalFiles?: Record<string, string>;
    fingerprint?: boolean;
}

type PluginConfig = {editBuildOptions?: (options: EsbuildOptions) => void} & Partial<Pick<BuildConfig, 'esbuildPlugins' | 'externals' | 'name' | 'additionalFiles'>>;
export type Plugin = (buildConfig: BuildConfig) => PluginConfig;

export type ApplicationBuildOptions = {
    name?: string;
    documentMeta?: DocumentMeta;
    plugins?: Plugin[]; // these need to be optional peer deps, instead of relative import happening above
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

export const platformBrowserBuildConfig: BuildConfig = {
    platform: 'browser',
    fingerprint: true,
    platformEntrypoint: () => '@springboardjs/platforms-browser/entrypoints/online_entrypoint.ts',
    esbuildPlugins: (args) => [
        esbuildPluginPlatformInject('browser'),
        esbuildPluginHtmlGenerate(
            args.outDir,
            `${args.nodeModulesParentDir}/node_modules/@springboardjs/platforms-browser/index.html`,
            args.documentMeta,
        ),
    ],
    additionalFiles: {
        // '@springboardjs/platforms-browser/index.html': 'index.html',
    },
};

export const platformOfflineBrowserBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    platformEntrypoint: () => '@springboardjs/platforms-browser/entrypoints/offline_entrypoint.ts',
};

export const platformNodeBuildConfig: BuildConfig = {
    platform: 'node',
    platformEntrypoint: () => {
        const entrypoint = '@springboardjs/platforms-node/entrypoints/node_entrypoint.ts';
        return entrypoint;
    },
    esbuildPlugins: () => [
        esbuildPluginPlatformInject('node'),
    ],
    externals: () => {
        let externals = ['@julusian/midi', 'easymidi', 'jsdom'];
        if (process.env.DISABLE_IO === 'true') {
            externals = ['jsdom'];
        }

        return externals;
    },
};

export const platformCfWorkersServerBuildConfig: BuildConfig = {
    platform: 'neutral',
    platformEntrypoint: () => {
        const entrypoint = '@springboardjs/platforms-cf-workers/entrypoints/cf_worker_entrypoint.ts';
        return entrypoint;
    },
    esbuildPlugins: (args) => [
        esbuildPluginPlatformInject('fetch'),
        esbuildPluginCfWorkersConfig(args.outDir, args.name || 'cf-workers-app'),
        {
            name: 'crypto-alias',
            setup(build: any) {
                // Alias node:crypto to use Web Crypto API for Cloudflare Workers
                build.onResolve({ filter: /^node:crypto$/ }, (args: any) => {
                    return {
                        path: args.path,
                        namespace: 'crypto-shim'
                    };
                });

                build.onResolve({ filter: /^crypto$/ }, (args: any) => {
                    return {
                        path: args.path,
                        namespace: 'crypto-shim'
                    };
                });

                build.onLoad({ filter: /.*/, namespace: 'crypto-shim' }, () => {
                    return {
                        contents: `export const webcrypto = crypto;`,
                        loader: 'js'
                    };
                });
            }
        },
    ],
    externals: () => {
        const externals = ['@julusian/midi', 'easymidi', 'jsdom', 'node:async_hooks', 'cloudflare:workers'];
        return externals;
    },
};

export const platformCfWorkersBrowserBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    platformEntrypoint: () => '@springboardjs/platforms-cf-workers/entrypoints/cf_worker_browser_entrypoint.tsx',
    esbuildPlugins: (args) => [
        ...platformBrowserBuildConfig.esbuildPlugins?.(args) || [],
        {
            name: 'move-html',
            setup(build) {
                build.onEnd(async () => {
                    const htmlFilePath = `${args.outDir}/index.html`;
                    const newHtmlFilePath = `${args.outDir}/../index.html`;

                    await fs.promises.rename(htmlFilePath, newHtmlFilePath);
                });
            },
        },
    ],
};

const copyDesktopFiles = async (desktopPlatform: string) => {
    await fs.promises.mkdir(`apps/desktop_${desktopPlatform}/app/dist`, {recursive: true});

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

export const platformTauriWebviewBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    fingerprint: false,
    platformEntrypoint: () => '@springboardjs/platforms-tauri/entrypoints/platform_tauri_browser.tsx',
    esbuildPlugins: (args) => [
        ...platformBrowserBuildConfig.esbuildPlugins!(args),
        {
            name: 'onBuildEnd',
            setup(build: any) {
                build.onEnd(async (result: any) => {
                    await copyDesktopFiles('tauri');
                });
            },
        },
    ],
};

export const platformTauriMaestroBuildConfig: BuildConfig = {
    ...platformNodeBuildConfig,
    platformEntrypoint: () => '@springboardjs/platforms-tauri/entrypoints/platform_tauri_maestro.ts',
};

const shouldOutputMetaFile = process.argv.includes('--meta');

export const buildApplication = async (buildConfig: BuildConfig, options?: ApplicationBuildOptions) => {
    let coreFile = buildConfig.platformEntrypoint();

    let applicationEntrypoint = process.env.APPLICATION_ENTRYPOINT || options?.applicationEntrypoint;
    if (!applicationEntrypoint) {
        throw new Error('No application entrypoint provided');
    }

    // const allImports = [coreFile, applicationEntrypoint].map(file => `import '${file}';`).join('\n');

    const parentOutDir = process.env.ESBUILD_OUT_DIR || './dist';
    const childDir = options?.esbuildOutDir;

    const plugins = (options?.plugins || []).map(p => p(buildConfig));

    let outDir = parentOutDir;
    if (childDir) {
        outDir += '/' + childDir;
    }

    // Determine platform family and context based on build config
    let platformFamily = 'node'; // default
    let context = 'server'; // default
    
    const entrypoint = buildConfig.platformEntrypoint();
    if (entrypoint.includes('cf-workers') || entrypoint.includes('cf_worker')) {
        platformFamily = 'cf-workers';
        if (entrypoint.includes('browser')) {
            context = 'browser';
        }
    } else if (entrypoint.includes('browser') || buildConfig.platform === 'browser') {
        context = 'browser';
    }
    
    const fullOutDir = `${outDir}/${platformFamily}/${context}/dist`;

    if (!fs.existsSync(fullOutDir)) {
        fs.mkdirSync(fullOutDir, {recursive: true});
    }

    const dynamicEntryPath = path.join(fullOutDir, 'dynamic-entry.js');

    if (path.isAbsolute(coreFile)) {
        coreFile = path.relative(fullOutDir, coreFile).replace(/\\/g, '/');
    }

    if (path.isAbsolute(applicationEntrypoint)) {
        applicationEntrypoint = path.relative(fullOutDir, applicationEntrypoint).replace(/\\/g, '/');
    }

    const allImports = `import initApp from '${coreFile}';
import '${applicationEntrypoint}';
export * from '${coreFile}';
export default initApp;
`

    fs.writeFileSync(dynamicEntryPath, allImports);

    const outFile = path.join(fullOutDir, 'index.js');

    const externals = buildConfig.externals?.() || [];
    externals.push('better-sqlite3');

    let nodeModulesParentFolder = process.env.NODE_MODULES_PARENT_FOLDER || options?.nodeModulesParentFolder;
    if (!nodeModulesParentFolder) {
        nodeModulesParentFolder = await findNodeModulesParentFolder();
    }
    if (!nodeModulesParentFolder) {
        throw new Error('Failed to find node_modules folder in current directory and parent directories')
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
                name: appName,
            }) || []),
            ...plugins.map(p => p.esbuildPlugins?.({
                outDir: fullOutDir,
                nodeModulesParentDir: nodeModulesParentFolder,
                documentMeta: options?.documentMeta,
            }).filter(p => isNotUndefined(p)) || []).flat(),
        ],
        external: externals,
        alias: {
        },
        define: {
            'process.env.WS_HOST': `"${process.env.WS_HOST || ''}"`,
            'process.env.DATA_HOST': `"${process.env.DATA_HOST || ''}"`,
            'process.env.NODE_ENV': `"${process.env.NODE_ENV || ''}"`,
            'process.env.DISABLE_IO': `"${process.env.DISABLE_IO || ''}"`,
            'process.env.IS_SERVER': `"${process.env.IS_SERVER || ''}"`,
            'process.env.DEBUG_LOG_PERFORMANCE': `"${process.env.DEBUG_LOG_PERFORMANCE || ''}"`,
            'process.env.RELOAD_CSS': `"${options?.dev?.reloadCss || ''}"`,
            'process.env.RELOAD_JS': `"${options?.dev?.reloadJs || ''}"`,
            ...getPublicEnvVarsDefine(),
            'import.meta.env': '{}', // fallback to make missing `import.meta.env` vars at compile time to be individually be "undefined" at runtime
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

const getPublicEnvVarsDefine = () => {
    const publicEnvVars: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('PUBLIC_')) {
            publicEnvVars[`import.meta.env.${key}`] = `"${value || ''}"`;
        }
    }

    return publicEnvVars;
};

const findNodeModulesParentFolder = async () => {
    let currentDir = process.cwd();

    while (true) {
        try {
            const nodeModulesPath = path.join(currentDir, 'node_modules');
            const stats = await fs.promises.stat(nodeModulesPath);

            if (stats.isDirectory()) {
                return currentDir;
            }
        } catch (error) {
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
