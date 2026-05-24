/**
 * Springboard HTML Plugin
 *
 * Generates HTML for browser platforms with proper script/style injection.
 * Handles both dev server and production builds.
 */

import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import type { NormalizedOptions, DocumentMeta } from '../types.js';
import { isBrowserPlatform } from '../config/platform-configs.js';
import { createLogger, escapeHtml } from './shared.js';

/**
 * Create the springboard HTML plugin.
 *
 * Responsibilities:
 * - Generate HTML template with document metadata
 * - Inject scripts and styles in dev mode
 * - Generate final HTML with hashed assets in build mode
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin or null if not applicable
 */
export function springboardHtml(options: NormalizedOptions): Plugin | null {
    // Only apply for browser-like platforms
    if (!isBrowserPlatform(options.platform)) {
        return null;
    }

    const logger = createLogger('html', options.debug);
    let resolvedConfig: ResolvedConfig;

    logger.debug(`HTML plugin initialized for platform: ${options.platform}`);

    return {
        name: 'springboard:html',

        /**
         * Store resolved config
         */
        configResolved(config) {
            resolvedConfig = config;
        },

        /**
         * Configure dev server to serve HTML
         */
        configureServer(server: ViteDevServer) {
            return () => {
                server.middlewares.use((req, res, next) => {
                    // Serve HTML for root and index.html requests
                    if (req.url === '/' || req.url === '/index.html') {
                        const html = generateHtml(options, true);

                        // Let Vite transform the HTML (injects HMR client)
                        server.transformIndexHtml(req.url, html).then(transformed => {
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'text/html');
                            res.end(transformed);
                        }).catch(next);
                        return;
                    }
                    next();
                });
            };
        },

        /**
         * Transform HTML in build mode - removed to prevent physical index.html creation
         * HTML is generated entirely by the generateBundle hook
         */

        /**
         * Generate HTML file in build output
         */
        async generateBundle(outputOptions, bundle) {
            const html = generateHtml(options, false);

            // Collect JS and CSS files from the bundle
            const jsFiles: string[] = [];
            const cssFiles: string[] = [];

            for (const [fileName] of Object.entries(bundle)) {
                if (fileName.endsWith('.map')) continue;

                if (fileName.endsWith('.js')) {
                    jsFiles.push(fileName);
                } else if (fileName.endsWith('.css')) {
                    cssFiles.push(fileName);
                }
            }

            // Inject asset references
            let finalHtml = html;

            // Add CSS links
            const cssLinks = cssFiles
                .map(file => `<link rel="stylesheet" href="/${file}">`)
                .join('\n    ');
            finalHtml = finalHtml.replace('</head>', `    ${cssLinks}\n</head>`);

            // Add JS scripts
            const jsScripts = jsFiles
                .map(file => `<script type="module" src="/${file}"></script>`)
                .join('\n    ');
            finalHtml = finalHtml.replace('</body>', `    ${jsScripts}\n</body>`);

            // Emit the HTML file to .springboard directory
            this.emitFile({
                type: 'asset',
                fileName: '.springboard/index.html',
                source: finalHtml,
            });

            logger.info('Generated index.html');
        },
    };
}

/**
 * Generate HTML content with document metadata
 */
function generateHtml(options: NormalizedOptions, isDev: boolean): string {
    const meta = options.documentMeta || {};
    const metaTags = generateMetaTags(meta);

    // Dev mode uses virtual module URL, build mode will have scripts injected
    const scriptTag = isDev
        ? '<script type="module" src="/@id/__x00__virtual:springboard-entry"></script>'
        : '<!-- scripts will be injected -->';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(meta.title || 'Springboard App')}</title>
    ${metaTags}
</head>
<body>
    <div id="root"></div>
    ${scriptTag}
</body>
</html>`;
}

/**
 * Generate meta tags from document metadata
 */
function generateMetaTags(meta: DocumentMeta): string {
    const tags: string[] = [];

    // Standard meta tags
    if (meta.description) {
        tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
    }
    if (meta.keywords) {
        tags.push(`<meta name="keywords" content="${escapeHtml(meta.keywords)}">`);
    }
    if (meta.author) {
        tags.push(`<meta name="author" content="${escapeHtml(meta.author)}">`);
    }
    if (meta.robots) {
        tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`);
    }

    // Content Security Policy
    if (meta['Content-Security-Policy']) {
        tags.push(`<meta http-equiv="Content-Security-Policy" content="${escapeHtml(meta['Content-Security-Policy'])}">`);
    }

    // Open Graph tags
    if (meta['og:title']) {
        tags.push(`<meta property="og:title" content="${escapeHtml(meta['og:title'])}">`);
    }
    if (meta['og:description']) {
        tags.push(`<meta property="og:description" content="${escapeHtml(meta['og:description'])}">`);
    }
    if (meta['og:image']) {
        tags.push(`<meta property="og:image" content="${escapeHtml(meta['og:image'])}">`);
    }
    if (meta['og:url']) {
        tags.push(`<meta property="og:url" content="${escapeHtml(meta['og:url'])}">`);
    }

    // Any other custom meta tags
    const handledKeys = [
        'title', 'description', 'keywords', 'author', 'robots',
        'Content-Security-Policy',
        'og:title', 'og:description', 'og:image', 'og:url'
    ];

    for (const [key, value] of Object.entries(meta)) {
        if (!handledKeys.includes(key) && value) {
            tags.push(`<meta name="${escapeHtml(key)}" content="${escapeHtml(value)}">`);
        }
    }

    return tags.join('\n    ');
}

export default springboardHtml;
