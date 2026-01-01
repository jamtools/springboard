import process from 'node:process';
import fs from 'node:fs/promises';

import {sentryEsbuildPlugin} from '@sentry/esbuild-plugin';

// import {buildApplication, buildServer, platformBrowserBuildConfig, platformNodeBuildConfig} from '../../jamtools/packages/springboard/cli/src/build';
import {buildApplication, buildServer, platformBrowserBuildConfig, platformNodeBuildConfig} from 'springboard-cli/src/build';

import {esbuildPluginTransformAwaitImportToRequire} from './esbuild_plugins/esbuild_plugin_transform_await_import';

const cwd = process.cwd();

const watchForChanges = process.argv.includes('--watch');

import esbuild, {build, BuildOptions} from 'esbuild';

import esbuildSassPlugin from 'esbuild-sass-plugin';

const makeSentryPlugin = () => sentryEsbuildPlugin({
    org: 'michaelk',
    project: 'songdrive',
    authToken: process.env.SENTRY_AUTH_TOKEN,
});

const browserLoaders: BuildOptions['loader'] = {
    '.svg': 'dataurl',
    '.ttf': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.eot': 'dataurl',
    '.png': 'dataurl',
    '.sql': 'text',
};

const nodeLoaders: BuildOptions['loader'] = {
    '.svg': 'dataurl',
    '.sql': 'text',
};

// Import the shared configuration
// @ts-ignore
import { browserDefines as importedBrowserDefines, commonDefines as importedCommonDefines } from './env-config';

const browserDefines = importedBrowserDefines as Record<string, string>;
const commonDefines = importedCommonDefines as Record<string, string>;

// Re-export for TypeScript compatibility
export { browserDefines, commonDefines };

const nodeDefines = {
    ...commonDefines,
};

const editHtmlFile = async (outDir: string) => {
    const filePath = path.join(cwd, outDir, 'index.html');
    const contents = await fs.readFile(filePath, 'utf8');
    let updatedHtml = contents.replace(
        '</head>',
        `<link rel="apple-touch-icon" sizes="180x180" href="https://songdrive.app/assets/favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="https://songdrive.app/assets/favicon/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="https://songdrive.app/assets/favicon/favicon-16x16.png">
<link rel="manifest" href="https://songdrive.app/assets/favicon/site.webmanifest">
    <style id='initial-background-color-style'>
        body {
            background-color: hsl(210 55% 9%);
        }
    </style>

</head>` // TODO: this should instead be done through some springboard-cli feature
    )

    if (process.env.RYBBIT_SITE_ID) {
        updatedHtml = updatedHtml.replace('</head>', `
<script
src="https://product.songdrive.app/api/script.js"
data-site-id='${process.env.RYBBIT_SITE_ID}'
data-session-replay="true"
defer
></script>
</head>`);
    }

    await fs.writeFile(filePath, updatedHtml, 'utf8');
}

const extraPlugins = (): esbuild.Plugin[] => {
    return [
        esbuildSassPlugin(),
        {
            name: 'replace-mantine-warning',
            setup(build) {
                build.onLoad({filter: /suppress-nextjs-warning\.mjs$/}, async () => {
                    return {
                        contents: 'export function suppressNextjsWarning(){}',
                        loader: 'js',
                    };
                });
            },
        },
        {
            name: 'fix-mantine-use-long-press',
            setup(build) {
                build.onLoad({filter: /use-long-press\.mjs$/}, async (args) => {
                    const contents = await fs.readFile(args.path, 'utf8');
                    const fixed = contents.replace(
                        /useEffect\(\(\) => \(\) => window\.clearTimeout\(timeout\.current\), \[\]\)/g,
                        'useEffect(() => { return () => window.clearTimeout(timeout.current); }, [])'
                    );

                    if (contents === fixed) {
                        throw new Error('Tried to patch mantine useEffect block but no replacement was made.');
                    }

                    return {
                        contents: fixed,
                        loader: 'js',
                    };
                });
            },
        },
    ];
};

let devAliases: Record<string, string> = {};
if (process.env.USE_DEV_ALIASES) {
    devAliases = require(`${cwd}/scripts/dev_cycle/dev_paths.json`);
    for (const key of Object.keys(devAliases)) {
        devAliases[key] = `${cwd}/${devAliases[key]}`;
    }
}

const buildBrowser = async () => {
    await buildApplication({
        ...platformBrowserBuildConfig,
        additionalFiles: {
            ...platformBrowserBuildConfig.additionalFiles,
            'kysely-wasqlite-worker/dist/wa-sqlite-async.wasm': 'wa-sqlite-async.wasm',
            '@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm': 'sqlite3.wasm',
            // '../public/assets': 'assets',
        },
    }, {
        dev: {
            reloadCss: true,
            reloadJs: true,
        },
        documentMeta: {
            title: 'SongDrive',
            description: 'All of your music ideas, organized in one place.',
        },
        nodeModulesParentFolder: cwd,
        applicationEntrypoint: `${cwd}/src/entrypoints/browser_online/browser_online_springboard_entrypoint.ts`,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            if (process.env.CI === 'true' && process.env.SENTRY_AUTH_TOKEN) {
                buildOptions.plugins!.push(makeSentryPlugin());
            }

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.loader = {
                ...buildOptions.loader,
                ...browserLoaders,
            };

            buildOptions.define = {
                ...buildOptions.define,
                ...browserDefines,
            };

            buildOptions.plugins!.push({
                name: 'editHtmlFile',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await editHtmlFile('dist/browser/dist');
                    });
                },
            });
        },
        watch: watchForChanges,
    });
};

const buildNodeMaestro = async () => {
    await buildApplication({
        ...platformNodeBuildConfig,
        platformEntrypoint: () => '@springboardjs/platforms-node/entrypoints/node_flexible_entrypoint.ts',
    }, {
        nodeModulesParentFolder: cwd,
        applicationEntrypoint: `${cwd}/src/entrypoints/node_maestro/node_maestro_springboard_entrypoint.ts`,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.external?.push('better-sqlite3');
            buildOptions.loader = {
                ...buildOptions.loader,
                ...nodeLoaders,
            };

            buildOptions.define = {
                ...buildOptions.define,
                ...nodeDefines,
            };
        },
        watch: watchForChanges,
    });
};

const buildHonoServer = async () => {
    await buildServer({
        serverEntrypoint: `${cwd}/server/index.ts`,
        watch: watchForChanges,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());
            if (process.env.CI === 'true' && process.env.SENTRY_AUTH_TOKEN) {
                buildOptions.plugins!.push(makeSentryPlugin());
            }

            buildOptions.external!.push(
                '@tabler/icons-react',
                'dexie',
                'react-dom',
                '@mantine/core',
                '@mantine/hooks',
                '@remix-run/router',
                'react-h5-audio-player',
            );

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.define = {
                ...buildOptions.define,
                ...nodeDefines,
            };

            buildOptions.loader = {
                ...buildOptions.loader,
                ...nodeLoaders,
            };
        },
    });
};

const buildRNWebview = async () => {
    await buildApplication({
        ...platformBrowserBuildConfig,
        platformEntrypoint: () => `${cwd}/packages/springboard/platforms/react-native/platform_react_native_browser.tsx`,
    }, {
        name: 'RN webview',
        documentMeta: {
            title: 'SongDrive',
            description: 'All of your music ideas, organized in one place.',
        },
        nodeModulesParentFolder: cwd,
        applicationEntrypoint: `${cwd}/src/entrypoints/rn_webview/rn_webview_springboard_entrypoint.ts`,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            if (process.env.CI === 'true' && process.env.SENTRY_AUTH_TOKEN) {
                buildOptions.plugins!.push(makeSentryPlugin());
            }

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.loader = {
                ...buildOptions.loader,
                ...browserLoaders,
            };

            buildOptions.plugins!.push({
                name: 'editHtmlFile',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await editHtmlFile('dist/react-native/browser/dist');
                    });
                },
            });

            buildOptions.plugins!.push({
                name: 'onBuildEnd',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await writeRNWebFiles();
                    });
                },
            });

            buildOptions.define = {
                ...buildOptions.define,
                ...browserDefines,
            };
        },
        esbuildOutDir: 'react-native',
        watch: watchForChanges,
    });
};

import {nodeExternalsPlugin} from 'esbuild-node-externals';
import {esbuildPluginPlatformInject} from 'springboard-cli/src/esbuild_plugins/esbuild_plugin_platform_inject';
import {execSync} from 'node:child_process';
import path from 'node:path';

const buildRNMain = async () => {
    // const packages = {"@motiz88/react-native-midi": "github:jamtools/react-native-midi#8e5b0798dc7333cd434421b514e521671b496c4e"};
    // const packagePairs = Object.entries(packages).map(([name, version]) => {
    //     return `${name}@${version}`;
    // }).join(' ');

    // const command = `pnpm add ${packagePairs}`;
    // execSync(command, {
    //     cwd: `${cwd}/apps/mobile`,
    //     env: {
    //         PATH: process.env.PATH,
    //     },
    // })

    const onBuildFinish = async () => {
        await fs.copyFile(`dist/rn-main/neutral/dist/index.js`, 'apps/mobile/app/entrypoints/rn_init_module.js');
        await fs.copyFile(`packages/rn-main/springboard_entrypoint.d.ts`, 'apps/mobile/app/entrypoints/rn_init_module.d.ts');
    };

    buildApplication({
        platform: 'neutral',
        platformEntrypoint: () => `${cwd}/packages/rn-main/rn_host_init_module.ts`,
        esbuildPlugins: () => [
            nodeExternalsPlugin({
                allowList: ['@springboardjs/*', '@jamtools/*', '@acme/store', '@acme/rn-shared'],
                forceExternalList: ['me'],
                cwd: `${cwd}/apps/mobile`,
            }),
            esbuildPluginPlatformInject('react-native' as 'browser'),
        ],
        // externals: () => ['react-native*', '*.css', 'expo*', 'springboard'],
        externals: () => ['*.html', '*.asset', '*.ttf', '@expo/*', 'react', '@react-native/*', 'react-native', 'react-native*', '*.css', 'expo*', 'springboard', '@motiz88/react-native-midi'],
        name: 'rn-main',
    }, {
        applicationEntrypoint: `${cwd}/packages/rn-main/no_op_platform_entrypoint.ts`,
        esbuildOutDir: './rn-main',
        name: 'songdrive',
        watch: watchForChanges,
        nodeModulesParentFolder: cwd,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push({
                name: 'onBuildEnd',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await onBuildFinish();
                    });
                },
            });

            buildOptions.external!.push(
                '@tabler/icons-react',
                'dexie',
                'react-dom',
                '@mantine/core',
                '@mantine/hooks',
                '@remix-run/router',
                'react-h5-audio-player',
            );
        },
    })
    // esbuild.build({
    //     entryPoints: ['/Users/mickmister/code/midibuddy2/packages/rn-main/rn_host_init_module.ts'],
    //     // entryPoints: ['/Users/mickmister/code/midibuddy2/apps/mobile/App.tsx'],

    //     // entryPoints: ['./src-dir/index.ts'],
    //     platform: 'neutral',
    //     target: 'ES2020',
    //     outfile: '/Users/mickmister/code/midibuddy2/apps/mobile/app/entrypoints/rn_init_module.js',
    //     bundle: true,
    //     plugins: [
    //         nodeExternalsPlugin({
    //             allowList: ['@springboardjs/*', '@jamtools/*', '@acme/store', '@acme/rn-shared'],
    //             forceExternalList: ['me'],
    //             cwd: '/Users/mickmister/code/midibuddy2/apps/mobile',
    //         }),
    //         esbuildPluginPlatformInject('react-native'),
    //     ],
    //     // loader: {

    //     // },
    //     external: ['*.html', '*.asset', '*.ttf', '@expo/*', 'react', '@react-native/*', 'react-native', 'react-native*', '*.css', 'expo*', 'springboard']
    // });
}

const buildBrowserOffline = async () => {
    await buildApplication({
        ...platformBrowserBuildConfig,
        platformEntrypoint: () => `${cwd}/packages/springboard/platforms/offline-browser/platform_offline_browser_entrypoint.tsx`,
        additionalFiles: {
            ...platformBrowserBuildConfig.additionalFiles,
            'kysely-wasqlite-worker/dist/wa-sqlite-async.wasm': 'wa-sqlite-async.wasm',
            '@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm': 'sqlite3.wasm',
        },
    }, {
        documentMeta: {
            title: 'SongDrive',
            description: 'All of your music ideas, organized in one place.',
        },
        nodeModulesParentFolder: cwd,
        applicationEntrypoint: `${cwd}/src/entrypoints/browser_offline/browser_offline_springboard_entrypoint.ts`,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.loader = {
                ...buildOptions.loader,
                ...browserLoaders,
            };
            // buildOptions.target = 'es2020';
            // buildOptions.alias = {
            //     ...buildOptions.alias,
            //     stream: 'stream-browserify',
            //     process: 'process/browser',
            // };

            buildOptions.define = {
                ...buildOptions.define,
                ...browserDefines,
            };

            buildOptions.plugins!.push({
                name: 'editHtmlFile',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await editHtmlFile('dist/browser_offline/browser/dist');
                    });
                },
            });
        },
        watch: watchForChanges,
        esbuildOutDir: 'browser_offline',
    });
};

const buildDesktopMaestro = async (desktopPlatform: string) => {
    await buildApplication({
        ...platformNodeBuildConfig,
        platformEntrypoint: () => `${cwd}/packages/springboard/platforms/${desktopPlatform}/platform_${desktopPlatform}_maestro.ts`,
    }, {
        nodeModulesParentFolder: cwd,
        applicationEntrypoint: `${cwd}/src/entrypoints/${desktopPlatform}/${desktopPlatform}_maestro_init.ts`,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.external?.push('better-sqlite3');
            buildOptions.loader = {
                ...buildOptions.loader,
                ...nodeLoaders,
            };

            buildOptions.define = {
                ...buildOptions.define,
                ...browserDefines,
            };
        },
        esbuildOutDir: `${desktopPlatform}`,
        watch: watchForChanges,
    });
};

const buildDesktopBrowser = async (desktopPlatform: string) => {
    await buildApplication({
        ...platformBrowserBuildConfig,
        fingerprint: false,
        platformEntrypoint: () => `${cwd}/packages/springboard/platforms/${desktopPlatform}/platform_${desktopPlatform}_without_maestro.tsx`,
        // platformEntrypoint: () => `${cwd}/packages/springboard/platforms/${desktopPlatform}/platform_${desktopPlatform}_browser.tsx`,
        // additionalFiles: {
        //     ...platformBrowserBuildConfig.additionalFiles,
        //     'kysely-wasqlite-worker/dist/wa-sqlite-async.wasm': 'wa-sqlite-async.wasm',
        //     '@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm': 'sqlite3.wasm',
        // },
    }, {
        nodeModulesParentFolder: cwd,
        applicationEntrypoint: `${cwd}/src/entrypoints/${desktopPlatform}/${desktopPlatform}_without_maestro_init.ts`,
        // applicationEntrypoint: `${cwd}/src/entrypoints/${desktopPlatform}/${desktopPlatform}_browser_init.ts`,
        documentMeta: {
            title: 'SongDrive',
            description: 'All of your music ideas, organized in one place.',
        },
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.loader = {
                ...buildOptions.loader,
                ...browserLoaders,
            };
            buildOptions.target = 'es2017';

            buildOptions.define = {
                ...buildOptions.define,
                ...browserDefines,
                'process.env.DATA_HOST': "'http://127.0.0.1:1337'",
                'process.env.WS_HOST': "'ws://127.0.0.1:1337'",
                'process.env.RUN_SIDECAR_FROM_WEBVIEW': `${process.env.RUN_SIDECAR_FROM_WEBVIEW && process.env.RUN_SIDECAR_FROM_WEBVIEW !== 'false'}`,
                'process.env.IS_TAURI_WEBVIEW': 'true',
            };

            buildOptions.plugins!.push({
                name: 'editHtmlFile',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await editHtmlFile('dist/tauri/browser/dist');
                    });
                },
            });

            buildOptions.plugins!.push({
                name: 'onBuildEnd',
                setup(build: any) {
                    build.onEnd(async (result: any) => {
                        await copyDesktopFiles(desktopPlatform);
                    });
                },
            });
        },
        esbuildOutDir: `${desktopPlatform}`,
        watch: watchForChanges,
    });
};

const buildHonoServerForDesktop = async (desktopPlatform: 'tauri') => {
    await buildServer({
        serverEntrypoint: `${cwd}/server/index.ts`,
        applicationDistPath: `${cwd}/dist/${desktopPlatform}/node/dist/dynamic-entry.js`,
        watch: watchForChanges,
        esbuildOutDir: `${desktopPlatform}`,
        editBuildOptions: (buildOptions) => {
            buildOptions.plugins!.push(...extraPlugins());

            buildOptions.alias = {
                ...buildOptions.alias,
                ...devAliases,
            };

            buildOptions.define = {
                ...buildOptions.define,
                ...nodeDefines,
            };

            buildOptions.loader = {
                ...buildOptions.loader,
                ...nodeLoaders,
            };

            buildOptions.plugins!.push(esbuildPluginTransformAwaitImportToRequire);
        },
    });
};

const buildDesktop = async (desktopPlatform: 'tauri') => {
    // await buildDesktopMaestro(desktopPlatform);
    await buildDesktopBrowser(desktopPlatform);
    // await buildHonoServerForDesktop(desktopPlatform);
};

type SpringboardPlatform = 'all' | 'main' | 'mobile' | 'desktop' | 'browser_offline';

const main = async () => {
    let platformToBuild = process.env.SPRINGBOARD_PLATFORM_VARIANT as SpringboardPlatform;
    if (!platformToBuild) {
        platformToBuild = 'main';
    }

    console.log(`Building application variants "${platformToBuild}"`);

    const platformsToBuild = new Set<SpringboardPlatform>(platformToBuild.split(',') as SpringboardPlatform[]);

    if (
        platformsToBuild.has('all') ||
        platformsToBuild.has('main')
    ) {
        await buildBrowser();
        await buildNodeMaestro();
        await buildHonoServer();
    }

    if (
        platformsToBuild.has('all') ||
        platformsToBuild.has('desktop')
    ) {
        await buildDesktop('tauri');
    }

    if (
        platformsToBuild.has('all') ||
        platformsToBuild.has('mobile')
    ) {
        await buildRNWebview();
        await buildRNMain();
    }

    if (
        platformsToBuild.has('all') ||
        platformsToBuild.has('browser_offline')
    ) {
        await buildBrowserOffline();
    }
};

const buildSqliteWorker = async () => {
    const outFile = `${cwd}/dist/browser/dist/sqlite_worker.js`;

    const buildOptions: BuildOptions = {
        entryPoints: [`${cwd}/packages/sqlite_worker/sqlite_worker_entrypoint.ts`],
        bundle: true,
        outfile: outFile,
        platform: 'neutral',
        minify: process.env.NODE_ENV === 'production',
    };

    buildOptions.define = {
        ...buildOptions.define,
    };

    if (watchForChanges) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        return;
    }

    await build(buildOptions);
};

setTimeout(main);

process.on('SIGINT', () => {
    process.exit(0);
});

const copyDesktopFiles = async (desktopPlatform: string) => {
    await fs.mkdir(`apps/desktop_${desktopPlatform}/app/dist`, {recursive: true});

    await fs.copyFile(
        `dist/${desktopPlatform}/browser/dist/index.css`,
        `apps/desktop_${desktopPlatform}/app/dist/index.css`,
    );

    await fs.copyFile(
        `dist/${desktopPlatform}/browser/dist/index.js`,
        `apps/desktop_${desktopPlatform}/app/dist/index.js`,
    );

    await fs.copyFile(
        `dist/${desktopPlatform}/browser/dist/index.js.map`,
        `apps/desktop_${desktopPlatform}/app/dist/index.js.map`,
    );

    await fs.copyFile(
        `dist/${desktopPlatform}/browser/dist/index.html`,
        `apps/desktop_${desktopPlatform}/app/index.html`,
    );
};

const writeRNWebFiles = async () => {
    let htmlContent = '';
    try {
        htmlContent = await fs.readFile('dist/react-native/browser/dist/index.html', 'utf-8');
    } catch (e) {
        htmlContent = await fs.readFile('node_modules/@springboardjs/platforms-browser/index.html', 'utf-8');
    }

    const cssHashMatch = htmlContent.match(/<link rel="stylesheet" href="\/dist\/index-([A-Za-z0-9]+)\.css">/);
    const jsHashMatch = htmlContent.match(/<script src="\/dist\/index-([A-Za-z0-9]+)\.js"><\/script>/);

    if (!cssHashMatch || !jsHashMatch) {
        throw new Error('CSS or JS placeholder not found in the HTML.');
    }

    const cssHash = cssHashMatch[1];
    const jsHash = jsHashMatch[1];

    await fs.writeFile('apps/mobile/assets/web/index.html', htmlContent, 'utf-8');

    await fs.copyFile(`dist/react-native/browser/dist/index-${cssHash}.css`, 'apps/mobile/assets/web/index-css.css');
    await fs.copyFile(`dist/react-native/browser/dist/index-${jsHash}.js`, 'apps/mobile/assets/web/index-js.js.asset');
}
