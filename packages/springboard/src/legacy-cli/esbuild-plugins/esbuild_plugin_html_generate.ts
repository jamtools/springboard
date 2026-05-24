/**
 * @deprecated This plugin is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * This plugin generates HTML files with injected script and style tags
 * based on the esbuild output.
 */

import fs from 'fs';

import type { Plugin } from 'esbuild';
import type { DocumentMeta } from '../build.js';

/**
 * @deprecated Use the Vite plugin from `springboard/vite-plugin` instead.
 * Creates an esbuild plugin that generates HTML files with injected assets.
 *
 * @param outDir - The output directory for the HTML file
 * @param htmlFilePath - Path to the source HTML template file
 * @param documentMeta - Optional metadata to inject into the HTML head
 * @returns An esbuild Plugin
 */
export const esbuildPluginHtmlGenerate = (outDir: string, htmlFilePath: string, documentMeta?: DocumentMeta): Plugin => {
    return {
        name: 'html-asset-insert',
        setup(build) {
            build.onEnd(async result => {
                if (!result.metafile?.outputs) return;
                const outputFiles = Object.keys(result.metafile.outputs).filter(f => !f.endsWith('.map'));

                let htmlFileContent = (await fs.promises.readFile(htmlFilePath)).toString();
                const bodyEnd = '</body>';
                const headEnd = '</head>';

                for (const f of outputFiles) {
                    if (f.endsWith('.js')) {
                        const fname = f.split('/').pop();
                        const jsTag = `<script src="/dist/${fname}"></script>`;
                        htmlFileContent = htmlFileContent.replace(bodyEnd, `${jsTag}\n${bodyEnd}`);
                    }
                    if (f.endsWith('.css')) {
                        const fname = f.split('/').pop();
                        const cssTag = `<link rel="stylesheet" href="/dist/${fname}">`;
                        htmlFileContent = htmlFileContent.replace(headEnd, `${cssTag}\n${headEnd}`);
                    }
                }

                if (documentMeta) {
                    const title = documentMeta.title || '';
                    if (title) {
                        htmlFileContent = htmlFileContent.replace(/<title>(.*?)<\/title>/, `<title>${title}</title>`);
                    }

                    for (const [key, value] of Object.entries(documentMeta)) {
                        if (key === 'title') {
                            htmlFileContent = htmlFileContent.replace(/<title>(.*?)<\/title>/, `<title>${title}</title>`);
                        } else if (key === 'Content-Security-Policy') {
                            const metaTag = `<meta http-equiv="${key}" content="${value}">`;
                            htmlFileContent = htmlFileContent.replace('</head>', `${metaTag}</head>`);
                        } else {
                            const metaTag = `<meta property="${key}" content="${value}">`;
                            htmlFileContent = htmlFileContent.replace('</head>', `${metaTag}</head>`);
                        }
                    }
                }

                const fullDestFilePath = `${outDir}/index.html`;
                await fs.promises.writeFile(fullDestFilePath, htmlFileContent);
            });
        }
    };
};
