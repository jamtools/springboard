import fs from 'fs';
import path from 'path';

import type {Plugin} from 'esbuild';
import type {DocumentMeta} from '../build';

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

                // fullDestFilePath = path.resolve(`${outDir}/../index.html`);
                // await fs.promises.writeFile(fullDestFilePath, htmlFileContent);
            });
        }
    };
}
