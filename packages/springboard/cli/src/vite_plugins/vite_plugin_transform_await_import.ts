/**
 * Vite Plugin: Transform Await Import to Require
 *
 * Post-build plugin that transforms `await import()` to `require()` for
 * Tauri's Maestro backend which needs CJS compatibility.
 */

import fs from 'fs';
import type { Plugin, ResolvedConfig } from 'vite';

export function vitePluginTransformAwaitImport(): Plugin {
    let resolvedConfig: ResolvedConfig;

    return {
        name: 'springboard-transform-await-import',
        apply: 'build',

        configResolved(config) {
            resolvedConfig = config;
        },

        async writeBundle(outputOptions, bundle) {
            const outDir = outputOptions.dir || resolvedConfig.build.outDir;

            for (const [fileName, chunk] of Object.entries(bundle)) {
                if (!fileName.endsWith('.js') || fileName.endsWith('.map')) {
                    continue;
                }

                if (chunk.type !== 'chunk') {
                    continue;
                }

                const filePath = `${outDir}/${fileName}`;

                try {
                    let contents = await fs.promises.readFile(filePath, 'utf-8');

                    if (!contents.includes('await import')) {
                        continue;
                    }

                    // Transform await import() to require()
                    const newContents = contents.replace(
                        /(^|\s+)await\s+import(\s*\()/g,
                        '$1require$2'
                    );

                    if (newContents !== contents) {
                        await fs.promises.writeFile(filePath, newContents);
                        console.log(`[springboard-transform-await-import] Transformed ${fileName}`);
                    }
                } catch (error) {
                    console.error(`[springboard-transform-await-import] Failed to transform ${fileName}:`, error);
                }
            }
        },
    };
}
