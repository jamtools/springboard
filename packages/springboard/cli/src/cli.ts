/**
 * Springboard CLI
 *
 * Vite-based CLI wrapper for multi-platform application builds.
 * Implements Option D: Monolithic CLI Wrapper from PLAN_VITE_CLI_INTEGRATION.md
 *
 * Commands:
 * - sb dev <entrypoint>  - Start development server with HMR
 * - sb build <entrypoint> - Build for production
 * - sb start - Start the production server
 */

import path from 'path';
import fs from 'node:fs';
import { program } from 'commander';
import concurrently from 'concurrently';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJSON = require('../package.json');

import type { SpringboardPlatform, Plugin } from './types.js';
import { buildAllPlatforms, buildMain, buildTauri, buildPartyKit, printBuildSummary } from './build/vite_build.js';
import { startDevServer } from './dev/vite_dev_server.js';

/**
 * Resolve an entrypoint path to an absolute path
 */
function resolveEntrypoint(entrypoint: string): string {
    let applicationEntrypoint = entrypoint;
    const cwd = process.cwd();
    if (!path.isAbsolute(applicationEntrypoint)) {
        applicationEntrypoint = `${cwd}/${applicationEntrypoint}`;
    }
    return path.resolve(applicationEntrypoint);
}

/**
 * Load plugins from a comma-separated list of plugin paths
 */
async function loadPlugins(pluginPaths?: string): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    if (pluginPaths) {
        const pluginPathsList = pluginPaths.split(',');
        for (const pluginPath of pluginPathsList) {
            let resolvedPath: string;

            // Check if it's a package name (no slashes or dots)
            if (!pluginPath.includes('/') && !pluginPath.includes('\\') && !pluginPath.includes('.')) {
                const nodeModulesPath = `@springboardjs/plugin-${pluginPath}/plugin.js`;
                try {
                    resolvedPath = require.resolve(nodeModulesPath);
                } catch {
                    resolvedPath = path.resolve(pluginPath);
                }
            } else {
                resolvedPath = path.resolve(pluginPath);
            }

            const mod = require(resolvedPath) as { default: () => Plugin };
            plugins.push(mod.default());
        }
    }
    return plugins;
}

/**
 * Parse platforms string into a Set
 */
function parsePlatforms(platformsStr: string): Set<SpringboardPlatform> {
    return new Set(platformsStr.split(',') as SpringboardPlatform[]);
}

// =============================================================================
// CLI Program Setup
// =============================================================================

program
    .name('sb')
    .description('Springboard CLI - Vite-based multi-platform build system')
    .version(packageJSON.version);

// =============================================================================
// DEV Command
// =============================================================================

program
    .command('dev')
    .description('Run the Springboard development server with HMR')
    .usage('src/index.tsx')
    .argument('entrypoint', 'Application entrypoint file')
    .option('-p, --platforms <PLATFORM>,<PLATFORM>', 'Platforms to build for', 'main')
    .option('-g, --plugins <PLUGIN>,<PLUGIN>', 'Plugins to build with')
    .option('--port <PORT>', 'Dev server port', '5173')
    .action(async (entrypoint: string, options: {
        platforms?: string;
        plugins?: string;
        port?: string;
    }) => {
        const applicationEntrypoint = resolveEntrypoint(entrypoint);
        const plugins = await loadPlugins(options.plugins);
        const platformsToBuild = parsePlatforms(options.platforms || 'main');
        const port = parseInt(options.port || '5173', 10);

        console.log(`Starting development server for platforms: ${options.platforms || 'main'}`);

        try {
            await startDevServer({
                applicationEntrypoint,
                platforms: platformsToBuild,
                plugins,
                port,
                hmr: true,
            });

            // Keep process alive
            console.log('\nDev server running. Press Ctrl+C to stop.\n');
        } catch (error) {
            console.error('Failed to start dev server:', error);
            process.exit(1);
        }
    });

// =============================================================================
// BUILD Command
// =============================================================================

program
    .command('build')
    .description('Build the application bundles for production')
    .usage('src/index.tsx')
    .argument('entrypoint', 'Application entrypoint file')
    .option('-w, --watch', 'Watch for file changes')
    .option('-p, --platforms <PLATFORM>,<PLATFORM>', 'Platforms to build for')
    .option('-g, --plugins <PLUGIN>,<PLUGIN>', 'Plugins to build with')
    .action(async (entrypoint: string, options: {
        watch?: boolean;
        platforms?: string;
        plugins?: string;
    }) => {
        // Determine platform to build
        let platformToBuild = process.env.SPRINGBOARD_PLATFORM_VARIANT || options.platforms;
        if (!platformToBuild) {
            platformToBuild = 'main';
        }

        const applicationEntrypoint = resolveEntrypoint(entrypoint);
        const plugins = await loadPlugins(options.plugins);
        const platformsToBuild = parsePlatforms(platformToBuild);

        console.log(`Building application for platforms: ${platformToBuild}`);

        try {
            let results;

            // Use specialized build functions for complex platforms
            if (platformsToBuild.has('desktop') && platformsToBuild.size === 1) {
                results = await buildTauri({
                    applicationEntrypoint,
                    plugins,
                    watch: options.watch,
                });
            } else if (platformsToBuild.has('partykit') && platformsToBuild.size === 1) {
                results = await buildPartyKit({
                    applicationEntrypoint,
                    plugins,
                    watch: options.watch,
                });
            } else if (platformsToBuild.has('main') && platformsToBuild.size === 1) {
                results = await buildMain({
                    applicationEntrypoint,
                    plugins,
                    watch: options.watch,
                });
            } else {
                // Generic multi-platform build
                results = await buildAllPlatforms({
                    applicationEntrypoint,
                    platforms: platformsToBuild,
                    plugins,
                    watch: options.watch,
                });
            }

            printBuildSummary(results);

            // Check for failures
            const failed = results.filter(r => !r.success);
            if (failed.length > 0) {
                process.exit(1);
            }
        } catch (error) {
            console.error('Build failed:', error);
            process.exit(1);
        }
    });

// =============================================================================
// START Command
// =============================================================================

program
    .command('start')
    .description('Start the production application server')
    .usage('')
    .action(async () => {
        console.log('Starting production server...');

        concurrently(
            [
                {
                    command: 'node dist/server/dist/local-server.cjs',
                    name: 'Server',
                    prefixColor: 'blue',
                },
            ],
            {
                prefix: 'name',
                restartTries: 0,
            }
        );
    });

// =============================================================================
// UPGRADE Command (utility)
// =============================================================================

program
    .command('upgrade')
    .description('Upgrade Springboard package versions in package.json files.')
    .argument('<new-version>', 'The new version number to set for matching packages.')
    .option('--packages <files...>', 'package.json files to update', ['package.json'])
    .option('--prefixes <prefixes...>', 'Package name prefixes to match', ['springboard', '@springboardjs/', '@jamtools/'])
    .action(async (newVersion: string, options: {
        packages: string[];
        prefixes: string[];
    }) => {
        const { packages, prefixes } = options;

        const normalizedPrefixes = prefixes.flatMap((p) => p.split(',')).map((p) => p.trim());

        for (const packageFile of packages) {
            const packagePath = path.resolve(process.cwd(), packageFile);
            try {
                const packageJson = JSON.parse(fs.readFileSync(packagePath).toString());
                let modified = false;

                for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
                    if (!packageJson[depType]) continue;

                    for (const [dep] of Object.entries<string>(packageJson[depType])) {
                        if (normalizedPrefixes.some((prefix) => dep.startsWith(prefix))) {
                            packageJson[depType][dep] = newVersion;
                            console.log(`Updated ${dep} to ${newVersion} in ${packageFile}`);
                            modified = true;
                        }
                    }
                }

                if (modified) {
                    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
                } else {
                    console.log(`No matching packages found in ${packageFile}`);
                }
            } catch (err) {
                console.error(`Error processing ${packageFile}:`, err);
            }
        }
    });

// =============================================================================
// Parse and Execute
// =============================================================================

if (!(globalThis as Record<string, unknown>).AVOID_PROGRAM_PARSE) {
    program.parse();
}

// Export for testing
export { program, resolveEntrypoint, loadPlugins, parsePlatforms };
