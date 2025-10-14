import process from 'node:process';

import {buildApplication, platformBrowserBuildConfig, platformNodeBuildConfig} from '../../../../cli/src/build';

import sveltePlugin from '../../plugin';

const watch = process.argv.includes('--watch');

setTimeout(async () => {
    await buildApplication(platformBrowserBuildConfig, {
        applicationEntrypoint: `${process.cwd()}/example/src/example.svelte`,
        nodeModulesParentFolder: `${process.cwd()}/../../../..`,
        watch,
        plugins: [
            sveltePlugin(),
        ],
    });

    await buildApplication(platformNodeBuildConfig, {
        watch,
        applicationEntrypoint: `${process.cwd()}/example/src/example.svelte`,
        nodeModulesParentFolder: `${process.cwd()}/../../../..`,
        plugins: [
            sveltePlugin(),
        ],
    });
});
