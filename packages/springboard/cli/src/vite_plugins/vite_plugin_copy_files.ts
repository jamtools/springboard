/**
 * Vite Plugin: Copy Files
 *
 * Post-build plugin to copy files to destination directories.
 * Used for Tauri desktop builds to copy assets to the app directory.
 */

import fs from 'fs';
import path from 'path';
import type { Plugin, ResolvedConfig } from 'vite';

export interface CopyFilesOptions {
    /** Array of copy operations */
    copies: Array<{
        /** Source file or directory */
        from: string;
        /** Destination file or directory */
        to: string;
    }>;
}

export function vitePluginCopyFiles(options: CopyFilesOptions): Plugin {
    let resolvedConfig: ResolvedConfig;

    return {
        name: 'springboard-copy-files',
        apply: 'build',

        configResolved(config) {
            resolvedConfig = config;
        },

        async closeBundle() {
            const projectRoot = resolvedConfig.root;

            for (const { from, to } of options.copies) {
                const srcPath = path.isAbsolute(from) ? from : path.join(projectRoot, from);
                const destPath = path.isAbsolute(to) ? to : path.join(projectRoot, to);

                try {
                    // Check if source exists
                    const srcStat = await fs.promises.stat(srcPath).catch(() => null);
                    if (!srcStat) {
                        console.warn(`[springboard-copy-files] Source not found: ${srcPath}`);
                        continue;
                    }

                    // Ensure destination directory exists
                    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

                    // Copy file
                    await fs.promises.copyFile(srcPath, destPath);
                    console.log(`[springboard-copy-files] Copied ${from} -> ${to}`);
                } catch (error) {
                    console.error(`[springboard-copy-files] Failed to copy ${from} -> ${to}:`, error);
                }
            }
        },
    };
}
