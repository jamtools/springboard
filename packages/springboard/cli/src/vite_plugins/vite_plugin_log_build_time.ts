/**
 * Vite Plugin: Log Build Time
 *
 * Simple plugin to log build start and completion times for each platform.
 */

import type { Plugin } from 'vite';

export function vitePluginLogBuildTime(platformName: string): Plugin {
    let startTime: number;

    return {
        name: 'springboard-log-build-time',

        buildStart() {
            startTime = Date.now();
            console.log(`[${platformName}] Build started...`);
        },

        buildEnd() {
            const duration = Date.now() - startTime;
            console.log(`[${platformName}] Build completed in ${duration}ms`);
        },

        closeBundle() {
            const totalDuration = Date.now() - startTime;
            console.log(`[${platformName}] Bundle written in ${totalDuration}ms`);
        },
    };
}
