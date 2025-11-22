import fs from 'fs';
import path from 'path';

import esbuild from 'esbuild';

import {esbuildPluginLogBuildTime} from './esbuild_plugins/esbuild_plugin_log_build_time';
import {esbuildPluginPlatformInject} from './esbuild_plugins/esbuild_plugin_platform_inject.js';
import {esbuildPluginHtmlGenerate} from './esbuild_plugins/esbuild_plugin_html_generate';
import {esbuildPluginPartykitConfig} from './esbuild_plugins/esbuild_plugin_partykit_config';

export type SpringboardPlatform = 'all' | 'main' | 'mobile' | 'desktop' | 'browser_offline' | 'partykit';

type EsbuildOptions = Parameters<typeof esbuild.build>[0];

export type EsbuildPlugin = esbuild.Plugin;

export type BuildConfig = {
    platform: NonNullable<EsbuildOptions['platform']>;
    name?: string;
    platformEntrypoint: () => string;
    esbuildPlugins?: (args: {outDir: string; nodeModulesParentDir: string, documentMeta?: DocumentMeta}) => EsbuildPlugin[];
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
        esbuildPluginPlatformInject('web'),
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
    esbuildPlugins: (args) => [
        esbuildPluginPlatformInject('web', {preserveServerStatesAndActions: true}),
        esbuildPluginHtmlGenerate(
            args.outDir,
            `${args.nodeModulesParentDir}/node_modules/@springboardjs/platforms-browser/index.html`,
            args.documentMeta,
        ),
    ],
};

export const platformNodeBuildConfig: BuildConfig = {
    platform: 'node',
    platformEntrypoint: () => {
        // const entrypoint = '@springboardjs/platforms-node/entrypoints/node_main_entrypoint.ts';
        const entrypoint = '@springboardjs/platforms-node/entrypoints/node_flexible_entrypoint.ts';

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

export const platformPartykitServerBuildConfig: BuildConfig = {
    platform: 'neutral',
    platformEntrypoint: () => {
        const entrypoint = '@springboardjs/platforms-partykit/src/entrypoints/partykit_server_entrypoint.ts';
        return entrypoint;
    },
    esbuildPlugins: (args) => [
        esbuildPluginPlatformInject('cf-workers'),
        esbuildPluginPartykitConfig(args.outDir),
    ],
    externals: () => {
        const externals = ['@julusian/midi', 'easymidi', 'jsdom', 'node:async_hooks'];
        return externals;
    },
};

export const platformPartykitBrowserBuildConfig: BuildConfig = {
    ...platformBrowserBuildConfig,
    platformEntrypoint: () => '@springboardjs/platforms-partykit/src/entrypoints/partykit_browser_entrypoint.tsx',
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
        esbuildPluginPlatformInject('tauri', {preserveServerStatesAndActions: true}),
        esbuildPluginHtmlGenerate(
            args.outDir,
            `${args.nodeModulesParentDir}/node_modules/@springboardjs/platforms-browser/index.html`,
            args.documentMeta,
        ),
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

    const fullOutDir = `${outDir}/${buildConfig.platform}/dist`;

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

export type ServerBuildOptions = {
    coreFile?: string;
    esbuildOutDir?: string;
    serverEntrypoint?: string;
    applicationDistPath?: string;
    watch?: boolean;
    editBuildOptions?: (options: EsbuildOptions) => void;
    plugins?: Plugin[];
};

export const buildServer = async (options?: ServerBuildOptions) => {
    const externals = ['better-sqlite3', '@julusian/midi', 'easymidi', 'jsdom'];

    const parentOutDir = process.env.ESBUILD_OUT_DIR || './dist';
    const childDir = options?.esbuildOutDir;

    let outDir = parentOutDir;
    if (childDir) {
        outDir += '/' + childDir;
    }

    const fullOutDir = `${outDir}/server/dist`;

    if (!fs.existsSync(fullOutDir)) {
        fs.mkdirSync(fullOutDir, {recursive: true});
    }

    const outFile = path.join(fullOutDir, 'local-server.cjs');


    let coreFile = options?.coreFile || 'springboard-server/src/entrypoints/local-server.entrypoint.ts';
    let applicationDistPath = options?.applicationDistPath || '../../node/dist/dynamic-entry.js';
    // const applicationDistPath = options?.applicationDistPath || '../../node/dist/index.js';
    let serverEntrypoint = process.env.SERVER_ENTRYPOINT || options?.serverEntrypoint;

    if (path.isAbsolute(coreFile)) {
        coreFile = path.relative(fullOutDir, coreFile).replace(/\\/g, '/');
    }

    if (path.isAbsolute(applicationDistPath)) {
        applicationDistPath = path.relative(fullOutDir, applicationDistPath).replace(/\\/g, '/');
    }

    if (serverEntrypoint && path.isAbsolute(serverEntrypoint)) {
        serverEntrypoint = path.relative(fullOutDir, serverEntrypoint).replace(/\\/g, '/');
    }

    let allImports = `import createDeps from '${coreFile}';`;
    if (serverEntrypoint) {
        allImports += `import '${serverEntrypoint}';`;
    }

    allImports += `import app from '${applicationDistPath}';
createDeps().then(deps => app(deps));
`;

    const dynamicEntryPath = path.join(fullOutDir, 'dynamic-entry.js');
    fs.writeFileSync(dynamicEntryPath, allImports);

    const buildOptions: EsbuildOptions = {
        entryPoints: [dynamicEntryPath],
        metafile: shouldOutputMetaFile,
        bundle: true,
        sourcemap: true,
        outfile: outFile,
        platform: 'node',
        minify: process.env.NODE_ENV === 'production',
        target: 'es2020',
        plugins: [
            esbuildPluginLogBuildTime('server'),
            esbuildPluginPlatformInject('node'),
            ...(options?.plugins?.map(p => p({platform: 'node', platformEntrypoint: () => ''}).esbuildPlugins?.({
                outDir: fullOutDir,
                nodeModulesParentDir: '',
                documentMeta: {},
            }).filter(p => isNotUndefined(p)) || []).flat() || []),
        ],
        external: externals,
        define: {
            'process.env.NODE_ENV': `"${process.env.NODE_ENV || ''}"`,
        },
    };

    options?.editBuildOptions?.(buildOptions);

    if (options?.watch) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        console.log('Watching for changes for server build...');
    } else {
        const result = await esbuild.build(buildOptions);
        if (shouldOutputMetaFile) {
            await fs.promises.writeFile('esbuild_meta_server.json', JSON.stringify(result.metafile));
        }
    }
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
