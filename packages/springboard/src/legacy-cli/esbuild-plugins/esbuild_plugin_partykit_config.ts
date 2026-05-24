/**
 * @deprecated This plugin is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * This plugin generates partykit.json configuration files based on
 * the esbuild output.
 */

import fs from 'fs';
import path from 'path';

import type { Plugin } from 'esbuild';

/**
 * @deprecated Use the Vite plugin from `springboard/vite-plugin` instead.
 * Creates an esbuild plugin that generates PartyKit configuration files.
 *
 * @param outDir - The output directory for the configuration file
 * @returns An esbuild Plugin
 */
export const esbuildPluginPartykitConfig = (outDir: string): Plugin => {
    return {
        name: 'generate-partykit-config',
        setup(build) {
            build.onEnd(async result => {
                const outputFiles = Object.keys(result.metafile!.outputs).filter(f => !f.endsWith('.map'));

                const jsFileName = outputFiles.find(f => f.endsWith('.js'))?.split('/').pop();
                if (!jsFileName) {
                    throw new Error('esbuild plugin error "generate-partykit-config": Failed to find js file');
                }

                const configContent = {
                    '$schema': 'https://www.partykit.io/schema.json',
                    'name': 'partykit-test',
                    'main': `./dist/partykit/neutral/dist/${jsFileName}`,
                    'compatibilityDate': '2025-02-26',
                    'serve': {
                        'path': 'dist/partykit/browser'
                    }
                };

                const contentStr = JSON.stringify(configContent, null, 4);

                const fullDestFilePath = path.resolve(`${outDir}/../../../../partykit.json`);
                await fs.promises.writeFile(fullDestFilePath, contentStr);
            });
        }
    };
};
