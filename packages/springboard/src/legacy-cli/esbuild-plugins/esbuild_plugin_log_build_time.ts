/**
 * @deprecated This plugin is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * This plugin logs build timing information to the console.
 */

import type { Plugin } from 'esbuild';

const logSuccessfulBuild = () => {
    console.log('\x1b[32m%s\x1b[0m', 'Build errors have been solved :)');
};

/**
 * @deprecated Use the Vite plugin from `springboard/vite-plugin` instead.
 * Creates an esbuild plugin that logs build timing information.
 *
 * @param label - A label to identify the build in console output
 * @returns An esbuild Plugin
 */
export const esbuildPluginLogBuildTime = (label: string): Plugin => ({
    name: 'log-build-time',
    setup(build) {
        let startTime = 0;
        let hadError = false;
        build.onStart(() => {
            startTime = Date.now();
        });
        build.onEnd((result) => {
            if (result.errors.length) {
                hadError = true;
                return;
            }

            if (hadError) {
                logSuccessfulBuild();
            }

            hadError = false;

            console.log(`Build finished in ${Date.now() - startTime}ms (${label})`);
        });
    },
});
