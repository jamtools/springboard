/**
 * Vite Plugin: HTML Generate
 *
 * Port of esbuild_plugin_html_generate.ts to Vite.
 *
 * This plugin generates HTML entry points for browser platforms by:
 * - Reading a template HTML file
 * - Injecting script tags for bundled JavaScript
 * - Injecting link tags for bundled CSS
 * - Injecting document metadata (title, og tags, CSP headers, etc.)
 *
 * IMPORTANT: This plugin works on USERLAND builds only.
 * It generates HTML for the consuming application, not for Springboard packages.
 *
 * Supports both dev and production modes:
 * - Dev mode: Injects Vite's HMR client
 * - Production mode: Injects fingerprinted asset references
 *
 * @example
 * // vite.config.ts
 * import { vitePluginHtmlGenerate } from './vite_plugins';
 *
 * export default defineConfig({
 *   plugins: [
 *     vitePluginHtmlGenerate({
 *       templatePath: 'node_modules/springboard/platforms/browser/index.html',
 *       documentMeta: {
 *         title: 'My App',
 *         'og:title': 'My App',
 *       }
 *     })
 *   ]
 * })
 */

import fs from 'fs';
import path from 'path';
import type { Plugin, ResolvedConfig, IndexHtmlTransformContext } from 'vite';
import type { DocumentMeta } from '../types.js';
import {
    injectMetaTags,
    injectScriptTags,
    injectLinkTags,
    createPluginLogger,
} from './utils.js';

/**
 * Options for the HTML generate plugin
 */
export interface VitePluginHtmlGenerateOptions {
    /**
     * Path to the HTML template file.
     * This can be an absolute path or relative to cwd.
     */
    templatePath: string;

    /**
     * Document metadata to inject into the HTML.
     * Supports title, meta tags, og tags, CSP headers, etc.
     */
    documentMeta?: DocumentMeta;

    /**
     * Custom output directory for the generated HTML.
     * Defaults to Vite's build.outDir.
     */
    outDir?: string;

    /**
     * Base path for asset URLs.
     * Defaults to '/dist/' in production and '/' in development.
     */
    basePath?: string;

    /**
     * Enable debug logging.
     * @default false
     */
    debug?: boolean;

    /**
     * Custom filename for the output HTML.
     * @default 'index.html'
     */
    outputFileName?: string;
}

/**
 * Create a Vite plugin that generates HTML with injected assets.
 *
 * This is the Vite equivalent of esbuild_plugin_html_generate.
 * It uses Rollup's writeBundle hook to process the build output.
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin
 */
export function vitePluginHtmlGenerate(options: VitePluginHtmlGenerateOptions): Plugin {
    const {
        templatePath,
        documentMeta,
        outDir: customOutDir,
        basePath: customBasePath,
        debug = false,
        outputFileName = 'index.html',
    } = options;

    const logger = createPluginLogger('html-generate');
    let resolvedConfig: ResolvedConfig;
    let isDev = false;

    if (debug) {
        logger.info(`Initialized with template: ${templatePath}`);
    }

    return {
        name: 'springboard:html-generate',

        // Only apply during build by default, but also supports dev server
        // For dev, use the transformIndexHtml hook instead
        apply: 'build',

        /**
         * Store resolved config for later use
         */
        configResolved(config) {
            resolvedConfig = config;
            isDev = config.command === 'serve';

            if (debug) {
                logger.debug(`Config resolved - isDev: ${isDev}, outDir: ${config.build.outDir}`);
            }
        },

        /**
         * writeBundle hook - processes the build output
         *
         * This is the Vite/Rollup equivalent of esbuild's onEnd hook.
         * It runs after all chunks have been written to disk.
         */
        async writeBundle(outputOptions, bundle) {
            const outDir = customOutDir || outputOptions.dir || resolvedConfig.build.outDir;
            const basePath = customBasePath || '/dist/';

            if (debug) {
                logger.debug(`Writing bundle to: ${outDir}`);
            }

            // Read the HTML template
            let htmlContent: string;
            try {
                const resolvedTemplatePath = path.isAbsolute(templatePath)
                    ? templatePath
                    : path.resolve(process.cwd(), templatePath);

                htmlContent = await fs.promises.readFile(resolvedTemplatePath, 'utf-8');
            } catch (error) {
                logger.error(`Failed to read template: ${templatePath}`);
                throw error;
            }

            // Collect JS and CSS files from the bundle
            const jsFiles: string[] = [];
            const cssFiles: string[] = [];

            for (const [fileName, chunk] of Object.entries(bundle)) {
                // Skip source maps
                if (fileName.endsWith('.map')) {
                    continue;
                }

                if (fileName.endsWith('.js')) {
                    jsFiles.push(`${basePath}${fileName}`);
                }

                if (fileName.endsWith('.css')) {
                    cssFiles.push(`${basePath}${fileName}`);
                }
            }

            if (debug) {
                logger.debug(`Found ${jsFiles.length} JS files and ${cssFiles.length} CSS files`);
            }

            // Inject CSS link tags into <head>
            if (cssFiles.length > 0) {
                htmlContent = injectLinkTags(htmlContent, cssFiles);
            }

            // Inject JS script tags before </body>
            // Use type="module" for ESM bundles
            if (jsFiles.length > 0) {
                htmlContent = injectScriptTags(htmlContent, jsFiles);
            }

            // Inject document metadata
            if (documentMeta) {
                htmlContent = injectMetaTags(htmlContent, documentMeta);
            }

            // Write the generated HTML file
            const htmlOutputPath = path.join(outDir, outputFileName);

            // Ensure output directory exists
            await fs.promises.mkdir(path.dirname(htmlOutputPath), { recursive: true });

            // Write the file
            await fs.promises.writeFile(htmlOutputPath, htmlContent, 'utf-8');

            logger.info(`Generated ${htmlOutputPath}`);
        },
    };
}

/**
 * Create a Vite plugin for HTML transformation in dev mode.
 *
 * This plugin uses Vite's transformIndexHtml hook to modify HTML during development.
 * It's useful when you want to inject metadata without going through the full build.
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin
 */
export function vitePluginHtmlTransformDev(
    options: Pick<VitePluginHtmlGenerateOptions, 'documentMeta' | 'debug'>
): Plugin {
    const { documentMeta, debug = false } = options;
    const logger = createPluginLogger('html-transform-dev');

    return {
        name: 'springboard:html-transform-dev',
        apply: 'serve',

        /**
         * Transform HTML during dev server
         */
        transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
            if (!documentMeta) {
                return html;
            }

            if (debug) {
                logger.debug(`Transforming HTML for: ${ctx.path}`);
            }

            return injectMetaTags(html, documentMeta);
        },
    };
}

/**
 * Combined plugin that works in both dev and build modes.
 *
 * @param options - Plugin configuration options
 * @returns Array of Vite plugins
 */
export function vitePluginHtmlGenerateFull(options: VitePluginHtmlGenerateOptions): Plugin[] {
    return [
        vitePluginHtmlGenerate(options),
        vitePluginHtmlTransformDev({
            documentMeta: options.documentMeta,
            debug: options.debug,
        }),
    ];
}

/**
 * Convenience export - same function with shorter name
 */
export const htmlGenerate = vitePluginHtmlGenerate;

export default vitePluginHtmlGenerate;
