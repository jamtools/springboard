/**
 * @deprecated This plugin is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * This plugin transforms `await import()` calls to `require()` calls
 * for CommonJS compatibility.
 */

import type { Plugin } from 'esbuild';
import * as fs from 'fs/promises';

/**
 * @deprecated Use the Vite plugin from `springboard/vite-plugin` instead.
 * Creates an esbuild plugin that transforms dynamic imports to require calls.
 *
 * This is useful for Node.js environments that need CommonJS compatibility.
 */
export const esbuildPluginTransformAwaitImportToRequire: Plugin = {
    name: 'transform-await-import-to-require',
    setup(build) {
        const outFile = build.initialOptions.outfile;

        build.onEnd(async (result) => {
            if (result.errors.length > 0) {
                return;
            }

            if (!outFile) {
                console.warn('No outfile specified in build options');
                return;
            }

            const contents = await fs.readFile(outFile, 'utf8');
            if (!contents.includes('await import')) {
                return;
            }

            const newContents = contents.replace(
                /(^|\s+)await\s+import(\s*\()/g,
                '$1require$2'
            );
            await fs.writeFile(outFile, newContents);
        });
    }
};
