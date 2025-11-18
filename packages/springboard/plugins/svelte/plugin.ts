import fs from 'node:fs/promises';

import type { Plugin as SpringboardPlugin } from 'springboard-cli/src/build';

import esbuildSvelte from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { parse } from 'svelte/compiler';

const sveltePlugin = (
    svelteOptions: Parameters<typeof esbuildSvelte>[0] = {}
): SpringboardPlugin => (buildConfig) => {
    return {
        name: 'svelte',
        esbuildPlugins: () =>
            buildConfig.platform === 'browser'
                ? [
                    esbuildSvelte({
                        ...svelteOptions,
                        preprocess: [
                            sveltePreprocess({
                                typescript: {
                                    compilerOptions: {
                                        verbatimModuleSyntax: true,
                                    },
                                },
                            }),
                            ...(
                                Array.isArray(svelteOptions?.preprocess)
                                    ? svelteOptions.preprocess
                                    : svelteOptions?.preprocess
                                        ? [svelteOptions.preprocess]
                                        : []
                            ),
                        ],

                        compilerOptions: {
                            generate: 'client',
                            ...svelteOptions?.compilerOptions,
                        },
                    }),
                ]
                : [
                    {
                        name: 'svelte-module-extractor',
                        setup(build) {
                            build.onLoad({ filter: /\.svelte$/ }, async (args) => {
                                const source = await fs.readFile(args.path, 'utf8');
                                const ast = parse(source, { modern: true });

                                if (ast.module && ast.module.content) {
                                    const start =
                      ast.module.start +
                      source.slice(ast.module.start).indexOf('>') +
                      1;
                                    const end = source.slice(0, ast.module.end).lastIndexOf('<');

                                    const moduleCode =
                      source.slice(start, end) + '\nexport default {}';

                                    return {
                                        contents: moduleCode,
                                        loader: 'tsx',
                                    };
                                }

                                return {
                                    contents: '',
                                    loader: 'tsx',
                                };
                            });
                        },
                    },
                ],
    };
};

export default sveltePlugin;
