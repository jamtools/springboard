#!/usr/bin/env npx tsx
/**
 * Springboard Publish-Time Build System
 *
 * This script compiles the consolidated Springboard package to JavaScript with
 * TypeScript declarations for npm publishing. This is a Vite-first approach.
 *
 * Key features:
 * - Single package with multiple entry points (exports)
 * - Platform-specific builds using @platform directives
 * - TypeScript declaration generation
 * - Source maps for debugging
 *
 * The output structure matches the package.json exports field:
 * - dist/index.mjs          -> "."
 * - dist/core/index.mjs     -> "./core"
 * - dist/server/index.mjs   -> "./server" (node condition)
 * - dist/browser/index.mjs  -> "./platforms/browser" (browser condition)
 * - dist/node/index.mjs     -> "./platforms/node" (node condition)
 * - dist/partykit/index.mjs -> "./platforms/partykit" (workerd condition)
 * - dist/tauri/index.mjs    -> "./platforms/tauri"
 * - dist/react-native/index.mjs -> "./platforms/react-native" (react-native condition)
 *
 * Usage:
 *   npx tsx scripts/build-for-publish.ts [--watch]
 */

import { build, type BuildOptions } from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// =============================================================================
// Types
// =============================================================================

type PlatformMacro = 'browser' | 'node' | 'fetch' | 'react-native';

interface EntryPointConfig {
    /** Export path (e.g., ".", "./server", "./platforms/browser") */
    exportPath: string;
    /** Source file path relative to src/ */
    input: string;
    /** Output path relative to dist/ */
    output: string;
    /** Platform macro for @platform directive processing */
    platformMacro?: PlatformMacro;
    /** esbuild platform setting */
    esbuildPlatform?: 'node' | 'neutral' | 'browser';
    /** Export condition for documentation */
    condition?: string;
}

// =============================================================================
// Platform Injection Plugin
// =============================================================================

/**
 * esbuild plugin that handles @platform directives at compile time.
 * This replaces the CLI plugin and runs during npm package builds.
 */
function platformInjectPlugin(platform: PlatformMacro): import('esbuild').Plugin {
    return {
        name: 'platform-inject',
        setup(build) {
            build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
                // Skip node_modules
                if (args.path.includes('node_modules')) {
                    return undefined;
                }

                let source = await fs.readFile(args.path, 'utf8');

                // Check if file has @platform directives
                if (!source.includes('@platform')) {
                    return undefined;
                }

                // Include code for the current platform
                const currentPlatformRegex = new RegExp(
                    `\\/\\/ @platform "${platform}"([\\s\\S]*?)\\/\\/ @platform end`,
                    'g'
                );
                source = source.replace(currentPlatformRegex, '$1');

                // Remove code for other platforms
                const otherPlatformRegex = new RegExp(
                    `\\/\\/ @platform "(node|browser|fetch|react-native)"([\\s\\S]*?)\\/\\/ @platform end`,
                    'g'
                );
                source = source.replace(otherPlatformRegex, '');

                const ext = path.extname(args.path).slice(1);
                const loader = ext === 'tsx' ? 'tsx' : ext === 'ts' ? 'ts' : ext === 'jsx' ? 'jsx' : 'js';

                return {
                    contents: source,
                    loader,
                };
            });
        },
    };
}

// =============================================================================
// Configuration
// =============================================================================

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_DIR = path.join(REPO_ROOT, 'packages/springboard');
const SRC_DIR = path.join(PACKAGE_DIR, 'src');
const DIST_DIR = path.join(PACKAGE_DIR, 'dist');

/**
 * Entry points derived from package.json exports field
 */
const ENTRY_POINTS: EntryPointConfig[] = [
    // Main entry point - platform-agnostic core
    {
        exportPath: '.',
        input: 'index.ts',
        output: 'index',
    },

    // Core module - platform-agnostic
    {
        exportPath: './core',
        input: 'core/index.ts',
        output: 'core/index',
    },

    // Server - Node.js only
    {
        exportPath: './server',
        input: 'server/index.ts',
        output: 'server/index',
        platformMacro: 'node',
        esbuildPlatform: 'node',
        condition: 'node',
    },

    // Browser platform
    {
        exportPath: './platforms/browser',
        input: 'platforms/browser/index.ts',
        output: 'browser/index',
        platformMacro: 'browser',
        esbuildPlatform: 'browser',
        condition: 'browser',
    },

    // Node.js platform
    {
        exportPath: './platforms/node',
        input: 'platforms/node/index.ts',
        output: 'node/index',
        platformMacro: 'node',
        esbuildPlatform: 'node',
        condition: 'node',
    },

    // PartyKit platform - workerd runtime
    {
        exportPath: './platforms/partykit',
        input: 'platforms/partykit/index.ts',
        output: 'partykit/index',
        platformMacro: 'fetch',
        esbuildPlatform: 'neutral',
        condition: 'workerd',
    },

    // Tauri platform - dual browser/node
    {
        exportPath: './platforms/tauri',
        input: 'platforms/tauri/index.ts',
        output: 'tauri/index',
        platformMacro: 'browser',
        esbuildPlatform: 'browser',
    },

    // React Native platform
    {
        exportPath: './platforms/react-native',
        input: 'platforms/react-native/index.ts',
        output: 'react-native/index',
        platformMacro: 'react-native',
        esbuildPlatform: 'neutral',
        condition: 'react-native',
    },

    // Data Storage module - Node.js only
    {
        exportPath: './data-storage',
        input: 'data-storage/index.ts',
        output: 'data-storage/index',
        platformMacro: 'node',
        esbuildPlatform: 'node',
        condition: 'node',
    },

    // Legacy CLI - deprecated esbuild-based build system
    {
        exportPath: './legacy-cli',
        input: 'legacy-cli/index.ts',
        output: 'legacy-cli/index',
        platformMacro: 'node',
        esbuildPlatform: 'node',
        condition: 'node',
    },
];

/**
 * External dependencies that should not be bundled
 */
const EXTERNALS = [
    // React ecosystem
    'react',
    'react-dom',
    'react-router',
    // RxJS
    'rxjs',
    // State management
    'immer',
    // RPC
    'json-rpc-2.0',
    // IndexedDB
    'dexie',
    // WebSocket
    'reconnecting-websocket',
    'ws',
    'isomorphic-ws',
    // Hono server
    'hono',
    '@hono/node-server',
    '@hono/node-ws',
    // PartyKit
    'partysocket',
    'partykit',
    'partykit/server',
    // Tauri
    '@tauri-apps/api',
    '@tauri-apps/plugin-shell',
    // Database
    'better-sqlite3',
    'kysely',
    'springboard/data-storage',
    'springboard/data-storage/sqlite_db',
    'springboard/data-storage/kv_api_kysely',
    // Validation
    'zod',
    // Build tools (for legacy CLI)
    'esbuild',
    // Node.js built-ins
    'fs',
    'path',
    'async_hooks',
    'node:fs',
    'node:path',
    'node:async_hooks',
];

// =============================================================================
// Build Functions
// =============================================================================

/**
 * Build a single entry point
 */
async function buildEntryPoint(entryPoint: EntryPointConfig): Promise<void> {
    const inputPath = path.join(SRC_DIR, entryPoint.input);

    // Check if input file exists
    try {
        await fs.access(inputPath);
    } catch {
        console.warn(`  Warning: Entry point not found: ${entryPoint.input}`);
        return;
    }

    const outputPath = path.join(DIST_DIR, `${entryPoint.output}.mjs`);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const plugins: import('esbuild').Plugin[] = [];
    if (entryPoint.platformMacro) {
        plugins.push(platformInjectPlugin(entryPoint.platformMacro));
    }

    const buildOptions: BuildOptions = {
        entryPoints: [inputPath],
        outfile: outputPath,
        bundle: true,
        format: 'esm',
        target: 'es2020',
        sourcemap: true,
        minify: false, // Keep readable for debugging
        treeShaking: true,
        platform: entryPoint.esbuildPlatform ?? 'neutral',
        external: EXTERNALS,
        plugins,
        jsx: 'automatic',
        loader: {
            '.tsx': 'tsx',
            '.ts': 'ts',
            '.jsx': 'jsx',
            '.js': 'js',
        },
        logLevel: 'warning',
    };

    await build(buildOptions);

    const conditionInfo = entryPoint.condition ? ` (${entryPoint.condition})` : '';
    console.log(`  Built: ${entryPoint.exportPath}${conditionInfo} -> dist/${entryPoint.output}.mjs`);
}

/**
 * Generate TypeScript declarations for the entire package
 */
async function generateDeclarations(): Promise<void> {
    console.log('\nGenerating TypeScript declarations...');

    try {
        // Use the existing tsconfig.build.json which is already configured correctly
        execSync('npx tsc -p tsconfig.build.json', {
            cwd: PACKAGE_DIR,
            stdio: 'pipe',
        });

        console.log('  Generated declarations successfully');
    } catch (error) {
        // Declaration generation might have warnings but still succeed
        // Check if dist directory has .d.ts files
        try {
            const files = await fs.readdir(DIST_DIR, { recursive: true });
            const dtsFiles = (files as string[]).filter(f => f.toString().endsWith('.d.ts'));
            if (dtsFiles.length > 0) {
                console.log(`  Generated ${dtsFiles.length} declaration files (with warnings)`);
            } else {
                console.warn('  Warning: No declaration files were generated');
            }
        } catch {
            console.warn('  Warning: Could not verify declaration generation');
        }
    }
}

/**
 * Resolve catalog: dependencies to actual versions from pnpm-workspace.yaml
 */
async function resolveCatalogDependencies(dependencies: Record<string, string>): Promise<Record<string, string>> {
    const workspaceYamlPath = path.join(REPO_ROOT, 'pnpm-workspace.yaml');
    const workspaceYaml = await fs.readFile(workspaceYamlPath, 'utf8');

    // Parse catalog entries (simple YAML parsing for our specific case)
    // Match lines like:   json-rpc-2.0: "1.7.1"  or   "json-rpc-2.0": "1.7.1"
    const catalog: Record<string, string> = {};
    const lines = workspaceYaml.split('\n');
    let inCatalog = false;

    for (const line of lines) {
        if (line.trim().startsWith('catalog:')) {
            inCatalog = true;
            continue;
        }
        if (inCatalog && line && !line.startsWith('  ')) {
            // End of catalog section
            break;
        }
        if (inCatalog && !line.trim().startsWith('#')) {
            // Match catalog entry: key: "value"
            const match = line.match(/^\s+["']?([^:"']+)["']?:\s*["']([^"']+)["']/);
            if (match) {
                catalog[match[1]] = match[2];
            }
        }
    }

    // Resolve catalog: references
    const resolved: Record<string, string> = {};
    for (const [dep, version] of Object.entries(dependencies)) {
        if (version === 'catalog:') {
            if (catalog[dep]) {
                resolved[dep] = `^${catalog[dep]}`;
                console.log(`  Resolved ${dep}: catalog: -> ^${catalog[dep]}`);
            } else {
                console.warn(`  Warning: No catalog entry found for ${dep}, keeping as-is`);
                resolved[dep] = version;
            }
        } else {
            resolved[dep] = version;
        }
    }

    return resolved;
}

/**
 * Update package.json exports to point to dist files for publishing
 */
async function generatePublishPackageJson(): Promise<void> {
    console.log('\nGenerating publish-ready package.json exports...');

    const packageJsonPath = path.join(PACKAGE_DIR, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    // Resolve catalog dependencies
    if (packageJson.dependencies) {
        packageJson.dependencies = await resolveCatalogDependencies(packageJson.dependencies);
    }
    if (packageJson.optionalDependencies) {
        packageJson.optionalDependencies = await resolveCatalogDependencies(packageJson.optionalDependencies);
    }
    if (packageJson.peerDependencies) {
        packageJson.peerDependencies = await resolveCatalogDependencies(packageJson.peerDependencies);
    }

    // Create exports that point to dist/ for the published package
    const publishExports: Record<string, unknown> = {
        '.': {
            types: './dist/index.d.ts',
            import: './dist/index.mjs',
            default: './dist/index.mjs',
        },
        './core': {
            types: './dist/core/index.d.ts',
            import: './dist/core/index.mjs',
            default: './dist/core/index.mjs',
        },
        './server': {
            types: './dist/server/index.d.ts',
            node: './dist/server/index.mjs',
            import: './dist/server/index.mjs',
            default: './dist/server/index.mjs',
        },
        './platforms/browser': {
            types: './dist/browser/index.d.ts',
            browser: './dist/browser/index.mjs',
            import: './dist/browser/index.mjs',
            default: './dist/browser/index.mjs',
        },
        './platforms/node': {
            types: './dist/node/index.d.ts',
            node: './dist/node/index.mjs',
            import: './dist/node/index.mjs',
            default: './dist/node/index.mjs',
        },
        './platforms/partykit': {
            types: './dist/partykit/index.d.ts',
            workerd: './dist/partykit/index.mjs',
            import: './dist/partykit/index.mjs',
            default: './dist/partykit/index.mjs',
        },
        './platforms/tauri': {
            types: './dist/tauri/index.d.ts',
            import: './dist/tauri/index.mjs',
            default: './dist/tauri/index.mjs',
        },
        './platforms/react-native': {
            types: './dist/react-native/index.d.ts',
            'react-native': './dist/react-native/index.mjs',
            import: './dist/react-native/index.mjs',
            default: './dist/react-native/index.mjs',
        },
        './data-storage': {
            types: './dist/data-storage/index.d.ts',
            node: './dist/data-storage/index.mjs',
            import: './dist/data-storage/index.mjs',
            default: './dist/data-storage/index.mjs',
        },
        './legacy-cli': {
            types: './dist/legacy-cli/index.d.ts',
            node: './dist/legacy-cli/index.mjs',
            import: './dist/legacy-cli/index.mjs',
            default: './dist/legacy-cli/index.mjs',
        },
        // Entrypoint source files for legacy CLI
        './platforms/browser/entrypoints/online_entrypoint.ts': './src/platforms/browser/entrypoints/online_entrypoint.ts',
        './platforms/browser/entrypoints/offline_entrypoint.ts': './src/platforms/browser/entrypoints/offline_entrypoint.ts',
        './platforms/node/entrypoints/node_flexible_entrypoint.ts': './src/platforms/node/entrypoints/node_flexible_entrypoint.ts',
        './platforms/partykit/entrypoints/partykit_browser_entrypoint.tsx': './src/platforms/partykit/entrypoints/partykit_browser_entrypoint.tsx',
        './platforms/partykit/entrypoints/partykit_server_entrypoint.ts': './src/platforms/partykit/entrypoints/partykit_server_entrypoint.ts',
        './platforms/tauri/entrypoints/*': './src/platforms/tauri/entrypoints/*',
        './platforms/react-native/entrypoints/*': './src/platforms/react-native/entrypoints/*',
        './platforms/browser/index.html': './src/platforms/browser/index.html',
        './package.json': './package.json',
    };

    // Create a separate package.json for publishing
    const publishPackageJson = {
        ...packageJson,
        main: './dist/index.mjs',
        module: './dist/index.mjs',
        types: './dist/index.d.ts',
        exports: publishExports,
        typesVersions: {
            '*': {
                server: ['./dist/server/index.d.ts'],
                'platforms/node': ['./dist/node/index.d.ts'],
                'platforms/browser': ['./dist/browser/index.d.ts'],
                'platforms/tauri': ['./dist/tauri/index.d.ts'],
                'platforms/partykit': ['./dist/partykit/index.d.ts'],
                'platforms/react-native': ['./dist/react-native/index.d.ts'],
                'data-storage': ['./dist/data-storage/index.d.ts'],
                'legacy-cli': ['./dist/legacy-cli/index.d.ts'],
                core: ['./dist/core/index.d.ts'],
            },
        },
    };

    // Write the publish-ready package.json to dist/
    const publishPackageJsonPath = path.join(PACKAGE_DIR, 'package.publish.json');
    await fs.writeFile(publishPackageJsonPath, JSON.stringify(publishPackageJson, null, 2));

    console.log('  Generated package.publish.json');
    console.log('  To publish, copy package.publish.json to package.json before npm publish');
}

/**
 * Build the complete Springboard package
 */
async function buildPackage(): Promise<void> {
    console.log('='.repeat(60));
    console.log('Springboard Publish-Time Build');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // Build vite-plugin first (required for vite-plugin export)
    console.log('\nBuilding vite-plugin...');
    execSync('pnpm --filter @springboard/vite-plugin build', {
        cwd: REPO_ROOT,
        stdio: 'inherit',
    });

    // Clean dist directory
    console.log('\nCleaning dist directory...');
    await fs.rm(DIST_DIR, { recursive: true, force: true });
    await fs.mkdir(DIST_DIR, { recursive: true });

    // Build all entry points
    console.log('\nBuilding entry points...');
    for (const entryPoint of ENTRY_POINTS) {
        await buildEntryPoint(entryPoint);
    }

    // Generate TypeScript declarations
    await generateDeclarations();

    // Generate publish-ready package.json
    await generatePublishPackageJson();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log(`Build completed in ${duration}s`);
    console.log('='.repeat(60));

    // Print summary
    console.log('\nOutput structure:');
    console.log('  packages/springboard/dist/');
    for (const ep of ENTRY_POINTS) {
        const conditionInfo = ep.condition ? ` (${ep.condition})` : '';
        console.log(`    ${ep.output}.mjs${conditionInfo}`);
    }
}

// =============================================================================
// CLI
// =============================================================================

async function main(): Promise<void> {
    await buildPackage();
}

main().catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
