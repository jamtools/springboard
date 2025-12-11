/**
 * Vite Plugin: PartyKit Config
 *
 * Port of esbuild_plugin_partykit_config.ts to Vite.
 *
 * This plugin generates PartyKit configuration files after the build completes.
 * PartyKit needs this config to know where the server and client bundles are located.
 *
 * The plugin generates a partykit.json file with:
 * - Schema reference
 * - Project name
 * - Main entry point (server bundle)
 * - Compatibility date
 * - Serve path (client bundle directory)
 *
 * @example
 * // vite.config.ts
 * import { vitePluginPartykitConfig } from './vite_plugins';
 *
 * export default defineConfig({
 *   plugins: [
 *     vitePluginPartykitConfig({
 *       name: 'my-partykit-app',
 *       baseOutDir: 'dist/partykit',
 *     })
 *   ]
 * })
 */

import fs from 'fs';
import path from 'path';
import type { Plugin, ResolvedConfig } from 'vite';
import { createPluginLogger } from './utils.js';

/**
 * PartyKit configuration schema
 */
export interface PartykitConfig {
    /** JSON Schema reference */
    $schema: string;
    /** Project name */
    name: string;
    /** Main entry point (server bundle path) */
    main: string;
    /** Compatibility date for PartyKit runtime */
    compatibilityDate: string;
    /** Serve configuration */
    serve: {
        /** Path to static files (client bundle directory) */
        path: string;
    };
}

/**
 * Options for the PartyKit config plugin
 */
export interface VitePluginPartykitConfigOptions {
    /**
     * Name of the PartyKit project.
     * This appears in the PartyKit dashboard and URL.
     * @default 'partykit-app'
     */
    name?: string;

    /**
     * Compatibility date for PartyKit runtime.
     * This determines which PartyKit runtime features are available.
     * @default '2025-02-26'
     */
    compatibilityDate?: string;

    /**
     * Base output directory for PartyKit builds.
     * The server bundle goes in {baseOutDir}/neutral/dist/
     * The client bundle goes in {baseOutDir}/browser/
     * @default 'dist/partykit'
     */
    baseOutDir?: string;

    /**
     * Custom output path for partykit.json.
     * Defaults to the project root.
     */
    configOutputPath?: string;

    /**
     * Enable debug logging.
     * @default false
     */
    debug?: boolean;

    /**
     * Custom server directory name.
     * @default 'neutral'
     */
    serverDir?: string;

    /**
     * Custom browser directory name.
     * @default 'browser'
     */
    browserDir?: string;
}

/**
 * Create a Vite plugin that generates PartyKit configuration.
 *
 * This is the Vite equivalent of esbuild_plugin_partykit_config.
 * It uses Rollup's writeBundle hook to generate the config after build.
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin
 */
export function vitePluginPartykitConfig(options: VitePluginPartykitConfigOptions = {}): Plugin {
    const {
        name = 'partykit-app',
        compatibilityDate = '2025-02-26',
        baseOutDir = 'dist/partykit',
        configOutputPath,
        debug = false,
        serverDir = 'neutral',
        browserDir = 'browser',
    } = options;

    const logger = createPluginLogger('partykit-config');
    let resolvedConfig: ResolvedConfig;

    if (debug) {
        logger.info(`Initialized with name: ${name}, baseOutDir: ${baseOutDir}`);
    }

    return {
        name: 'springboard:partykit-config',

        // Only apply during build
        apply: 'build',

        /**
         * Store resolved config for later use
         */
        configResolved(config) {
            resolvedConfig = config;
        },

        /**
         * writeBundle hook - generates partykit.json after build completes
         *
         * This is the Vite/Rollup equivalent of esbuild's onEnd hook.
         * It runs after all chunks have been written to disk.
         */
        async writeBundle(outputOptions, bundle) {
            // Find the main JS output file (entry point)
            let mainJsFile: string | undefined;

            for (const [fileName, chunk] of Object.entries(bundle)) {
                // Skip source maps
                if (fileName.endsWith('.map')) {
                    continue;
                }

                // Look for JS files - prefer the entry chunk
                if (fileName.endsWith('.js')) {
                    const chunkInfo = chunk as { isEntry?: boolean };
                    if (chunkInfo.isEntry) {
                        mainJsFile = fileName;
                        break;
                    }
                    // Fallback to first JS file if no entry found
                    if (!mainJsFile) {
                        mainJsFile = fileName;
                    }
                }
            }

            if (!mainJsFile) {
                logger.error('No JS file found in bundle - cannot generate partykit.json');
                return;
            }

            if (debug) {
                logger.debug(`Found main JS file: ${mainJsFile}`);
            }

            // Build the PartyKit configuration
            const configContent: PartykitConfig = {
                $schema: 'https://www.partykit.io/schema.json',
                name: name,
                main: `./${baseOutDir}/${serverDir}/dist/${mainJsFile}`,
                compatibilityDate: compatibilityDate,
                serve: {
                    path: `${baseOutDir}/${browserDir}`,
                },
            };

            // Determine output path for partykit.json
            // Default to project root (4 directories up from neutral/dist/)
            let configPath: string;
            if (configOutputPath) {
                configPath = path.isAbsolute(configOutputPath)
                    ? configOutputPath
                    : path.resolve(resolvedConfig.root, configOutputPath);
            } else {
                // Write to project root
                configPath = path.resolve(resolvedConfig.root, 'partykit.json');
            }

            // Write the configuration file
            await fs.promises.writeFile(
                configPath,
                JSON.stringify(configContent, null, 4),
                'utf-8'
            );

            logger.info(`Generated ${configPath}`);

            if (debug) {
                logger.debug(`Config content: ${JSON.stringify(configContent, null, 2)}`);
            }
        },
    };
}

/**
 * Convenience export - same function with shorter name
 */
export const partykitConfig = vitePluginPartykitConfig;

export default vitePluginPartykitConfig;
