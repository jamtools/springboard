#!/usr/bin/env npx tsx
/**
 * Springboard Publish-Time Build System
 *
 * This script compiles ALL Springboard packages to JavaScript with TypeScript
 * declarations for npm publishing. This is a Vite-first approach with NO
 * backward compatibility with esbuild.
 *
 * Key features:
 * - Platform-specific builds using @platform directives
 * - Multiple output formats (ESM for browser, CJS for Node)
 * - TypeScript declaration generation
 * - Source maps for debugging
 *
 * Usage:
 *   npx tsx scripts/build-for-publish.ts [--package <name>] [--watch]
 */

import { build, type BuildOptions } from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// =============================================================================
// Types
// =============================================================================

type PlatformMacro = 'browser' | 'node' | 'fetch' | 'react-native';

interface PackageConfig {
    /** Package name (for logging) */
    name: string;
    /** Package directory relative to repo root */
    dir: string;
    /** Entry points to compile */
    entryPoints: EntryPointConfig[];
    /** Platform-specific builds */
    platforms?: PlatformBuildConfig[];
    /** External dependencies (not bundled) */
    externals?: string[];
    /** Whether this package has React/JSX */
    hasJsx?: boolean;
}

interface EntryPointConfig {
    /** Source file path relative to package dir */
    input: string;
    /** Output path relative to dist/ */
    output: string;
    /** Export condition name (for package.json exports) */
    exportCondition?: string;
}

interface PlatformBuildConfig {
    /** Platform macro target */
    platform: PlatformMacro;
    /** Export condition name */
    condition: string;
    /** Output subdirectory under dist/ */
    outDir: string;
    /** Output format */
    format: 'esm' | 'cjs';
    /** File extension */
    extension: '.mjs' | '.cjs' | '.js';
}

// =============================================================================
// Platform Injection Plugin (moved from esbuild_plugin_platform_inject)
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
// Package Configurations
// =============================================================================

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * All packages to build for publishing
 */
const PACKAGES: PackageConfig[] = [
    // Core package - platform-agnostic
    {
        name: 'springboard',
        dir: 'packages/springboard/core',
        entryPoints: [
            { input: 'src/index.ts', output: 'index' },
            { input: 'engine/engine.tsx', output: 'engine/engine' },
            { input: 'engine/register.ts', output: 'engine/register' },
            { input: 'engine/module_api.ts', output: 'engine/module_api' },
            { input: 'hooks/useMount.ts', output: 'hooks/useMount' },
            { input: 'types/module_types.ts', output: 'types/module_types' },
            { input: 'types/response_types.ts', output: 'types/response_types' },
            { input: 'utils/generate_id.ts', output: 'utils/generate_id' },
            { input: 'services/http_kv_store_client.ts', output: 'services/http_kv_store_client' },
            { input: 'services/states/shared_state_service.ts', output: 'services/states/shared_state_service' },
            { input: 'modules/index.ts', output: 'modules/index' },
            { input: 'modules/base_module/base_module.tsx', output: 'modules/base_module/base_module' },
            { input: 'modules/files/files_module.tsx', output: 'modules/files/files_module' },
            { input: 'module_registry/module_registry.tsx', output: 'module_registry/module_registry' },
        ],
        externals: [
            'react',
            'react-dom',
            'rxjs',
            'immer',
            'json-rpc-2.0',
            'dexie',
            'reconnecting-websocket',
            'ws',
        ],
        hasJsx: true,
    },

    // Server package - Node.js only
    {
        name: 'springboard-server',
        dir: 'packages/springboard/server',
        entryPoints: [
            { input: 'index.ts', output: 'index' },
            { input: 'src/register.ts', output: 'src/register' },
        ],
        externals: [
            'springboard',
            '@springboardjs/platforms-node',
            '@springboardjs/data-storage',
            'hono',
            '@hono/node-server',
            '@hono/node-ws',
            'json-rpc-2.0',
        ],
    },

    // Browser platform package
    {
        name: '@springboardjs/platforms-browser',
        dir: 'packages/springboard/platforms/webapp',
        entryPoints: [
            { input: 'entrypoints/main.tsx', output: 'entrypoints/main' },
            { input: 'entrypoints/react_entrypoint.tsx', output: 'entrypoints/react_entrypoint' },
            { input: 'entrypoints/online_entrypoint.ts', output: 'entrypoints/online_entrypoint' },
            { input: 'entrypoints/offline_entrypoint.ts', output: 'entrypoints/offline_entrypoint' },
            { input: 'services/browser_kvstore_service.ts', output: 'services/browser_kvstore_service' },
            { input: 'services/browser_json_rpc.ts', output: 'services/browser_json_rpc' },
            { input: 'frontend_routes.tsx', output: 'frontend_routes' },
            { input: 'layout.tsx', output: 'layout' },
        ],
        platforms: [
            {
                platform: 'browser',
                condition: 'browser',
                outDir: 'browser',
                format: 'esm',
                extension: '.mjs',
            },
        ],
        externals: [
            'springboard',
            'react',
            'react-dom',
            'react-router',
            'json-rpc-2.0',
            'reconnecting-websocket',
        ],
        hasJsx: true,
    },

    // Node platform package
    {
        name: '@springboardjs/platforms-node',
        dir: 'packages/springboard/platforms/node',
        entryPoints: [
            { input: 'entrypoints/main.ts', output: 'entrypoints/main' },
            { input: 'entrypoints/node_flexible_entrypoint.ts', output: 'entrypoints/node_flexible_entrypoint' },
            { input: 'services/node_kvstore_service.ts', output: 'services/node_kvstore_service' },
            { input: 'services/node_json_rpc.ts', output: 'services/node_json_rpc' },
            { input: 'services/node_local_json_rpc.ts', output: 'services/node_local_json_rpc' },
            { input: 'services/node_rpc_async_local_storage.ts', output: 'services/node_rpc_async_local_storage' },
            { input: 'services/node_file_storage_service.ts', output: 'services/node_file_storage_service' },
        ],
        platforms: [
            {
                platform: 'node',
                condition: 'node',
                outDir: 'node',
                format: 'esm',
                extension: '.mjs',
            },
        ],
        externals: [
            'springboard',
            'isomorphic-ws',
            'ws',
            'json-rpc-2.0',
            'reconnecting-websocket',
            'fs',
            'path',
            'async_hooks',
        ],
    },

    // PartyKit platform package
    {
        name: '@springboardjs/platforms-partykit',
        dir: 'packages/springboard/platforms/partykit',
        entryPoints: [
            { input: 'src/entrypoints/partykit_server_entrypoint.ts', output: 'entrypoints/partykit_server_entrypoint' },
            { input: 'src/partykit_hono_app.ts', output: 'partykit_hono_app' },
            { input: 'src/services/partykit_kv_store.ts', output: 'services/partykit_kv_store' },
            { input: 'src/services/partykit_rpc_client.ts', output: 'services/partykit_rpc_client' },
            { input: 'src/services/partykit_rpc_server.ts', output: 'services/partykit_rpc_server' },
        ],
        platforms: [
            {
                platform: 'fetch',
                condition: 'workerd',
                outDir: 'workerd',
                format: 'esm',
                extension: '.mjs',
            },
        ],
        externals: [
            'springboard',
            'springboard-server',
            '@springboardjs/platforms-browser',
            '@springboardjs/platforms-node',
            'hono',
            'json-rpc-2.0',
            'partysocket',
            'zod',
            'partykit/server',
        ],
    },

    // Tauri platform package
    {
        name: '@springboardjs/platforms-tauri',
        dir: 'packages/springboard/platforms/tauri',
        entryPoints: [
            { input: 'entrypoints/platform_tauri_maestro.ts', output: 'entrypoints/platform_tauri_maestro' },
            { input: 'entrypoints/platform_tauri_browser.tsx', output: 'entrypoints/platform_tauri_browser' },
        ],
        platforms: [
            {
                platform: 'browser',
                condition: 'browser',
                outDir: 'browser',
                format: 'esm',
                extension: '.mjs',
            },
            {
                platform: 'node',
                condition: 'node',
                outDir: 'node',
                format: 'esm',
                extension: '.mjs',
            },
        ],
        externals: [
            'springboard',
            '@springboardjs/platforms-browser',
            '@springboardjs/platforms-node',
            '@tauri-apps/api',
            '@tauri-apps/plugin-shell',
            'react',
            'react-dom',
        ],
        hasJsx: true,
    },

    // React Native platform package
    {
        name: '@springboardjs/platforms-react-native',
        dir: 'packages/springboard/platforms/react-native',
        entryPoints: [
            { input: 'entrypoints/rn_app_springboard_entrypoint.ts', output: 'entrypoints/rn_app_springboard_entrypoint' },
            { input: 'entrypoints/platform_react_native_browser.tsx', output: 'entrypoints/platform_react_native_browser' },
            { input: 'services/rn_webview_local_token_service.ts', output: 'services/rn_webview_local_token_service' },
            { input: 'services/kv/kv_rn_and_webview.ts', output: 'services/kv/kv_rn_and_webview' },
            { input: 'services/rpc/rpc_webview_to_rn.ts', output: 'services/rpc/rpc_webview_to_rn' },
            { input: 'services/rpc/rpc_rn_to_webview.ts', output: 'services/rpc/rpc_rn_to_webview' },
        ],
        platforms: [
            {
                platform: 'react-native',
                condition: 'react-native',
                outDir: 'react-native',
                format: 'esm',
                extension: '.mjs',
            },
        ],
        externals: [
            'springboard',
            '@springboardjs/platforms-browser',
            'react',
            'react-dom',
            'json-rpc-2.0',
            'reconnecting-websocket',
        ],
        hasJsx: true,
    },

    // Data storage package - Node.js only
    {
        name: '@springboardjs/data-storage',
        dir: 'packages/springboard/data_storage',
        entryPoints: [
            { input: 'index.ts', output: 'index' },
        ],
        externals: [
            'better-sqlite3',
            'kysely',
            'zod',
        ],
    },
];

// =============================================================================
// Build Functions
// =============================================================================

/**
 * Build a single entry point for a specific platform
 */
async function buildEntryPoint(
    packageConfig: PackageConfig,
    entryPoint: EntryPointConfig,
    platformBuild: PlatformBuildConfig | null,
    outDir: string
): Promise<void> {
    const packageDir = path.join(REPO_ROOT, packageConfig.dir);
    const inputPath = path.join(packageDir, entryPoint.input);

    // Check if input file exists
    try {
        await fs.access(inputPath);
    } catch {
        console.warn(`  Warning: Entry point not found: ${entryPoint.input}`);
        return;
    }

    const outputPath = path.join(outDir, `${entryPoint.output}${platformBuild?.extension ?? '.mjs'}`);

    const buildOptions: BuildOptions = {
        entryPoints: [inputPath],
        outfile: outputPath,
        bundle: true,
        format: platformBuild?.format === 'cjs' ? 'cjs' : 'esm',
        target: 'es2020',
        sourcemap: true,
        minify: false, // Keep readable for debugging
        treeShaking: true,
        platform: platformBuild?.platform === 'node' ? 'node' : 'neutral',
        external: packageConfig.externals ?? [],
        plugins: platformBuild ? [platformInjectPlugin(platformBuild.platform)] : [],
        jsx: packageConfig.hasJsx ? 'automatic' : undefined,
        loader: {
            '.tsx': 'tsx',
            '.ts': 'ts',
            '.jsx': 'jsx',
            '.js': 'js',
        },
        logLevel: 'warning',
    };

    await build(buildOptions);
}

/**
 * Generate TypeScript declarations for a package
 */
async function generateDeclarations(packageConfig: PackageConfig): Promise<void> {
    const packageDir = path.join(REPO_ROOT, packageConfig.dir);
    const distDir = path.join(packageDir, 'dist');

    // Create a temporary tsconfig for declaration generation
    const declarationTsConfig = {
        extends: './tsconfig.json',
        compilerOptions: {
            declaration: true,
            declarationMap: true,
            emitDeclarationOnly: true,
            outDir: './dist',
            rootDir: '.',
            noEmit: false,
            skipLibCheck: true,
            moduleResolution: 'bundler',
            module: 'ESNext',
            target: 'ES2020',
        },
        include: packageConfig.entryPoints.map(ep => ep.input),
        exclude: ['node_modules', 'dist', '**/*.spec.ts', '**/*.test.ts'],
    };

    const tempTsConfigPath = path.join(packageDir, 'tsconfig.publish.json');

    try {
        await fs.writeFile(tempTsConfigPath, JSON.stringify(declarationTsConfig, null, 2));

        // Run tsc with the temporary config
        execSync(`npx tsc -p ${tempTsConfigPath}`, {
            cwd: packageDir,
            stdio: 'pipe',
        });

        console.log(`  Generated declarations for ${packageConfig.name}`);
    } catch (error) {
        // Declaration generation might fail for some files, but that's ok
        // We'll still have the .js files
        console.warn(`  Warning: Some declarations may not have been generated for ${packageConfig.name}`);
    } finally {
        // Clean up temp config
        await fs.unlink(tempTsConfigPath).catch(() => {});
    }
}

/**
 * Build a complete package
 */
async function buildPackage(packageConfig: PackageConfig): Promise<void> {
    console.log(`\nBuilding ${packageConfig.name}...`);

    const packageDir = path.join(REPO_ROOT, packageConfig.dir);
    const distDir = path.join(packageDir, 'dist');

    // Clean dist directory
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.mkdir(distDir, { recursive: true });

    // If package has platform-specific builds, build for each platform
    if (packageConfig.platforms && packageConfig.platforms.length > 0) {
        for (const platformBuild of packageConfig.platforms) {
            console.log(`  Building for platform: ${platformBuild.condition}`);
            const platformOutDir = path.join(distDir, platformBuild.outDir);
            await fs.mkdir(platformOutDir, { recursive: true });

            for (const entryPoint of packageConfig.entryPoints) {
                await buildEntryPoint(packageConfig, entryPoint, platformBuild, platformOutDir);
            }
        }
    } else {
        // Build without platform-specific transforms
        for (const entryPoint of packageConfig.entryPoints) {
            await buildEntryPoint(packageConfig, entryPoint, null, distDir);
        }
    }

    // Generate TypeScript declarations
    await generateDeclarations(packageConfig);

    console.log(`  Completed ${packageConfig.name}`);
}

/**
 * Build all packages
 */
async function buildAllPackages(): Promise<void> {
    console.log('='.repeat(60));
    console.log('Springboard Publish-Time Build');
    console.log('='.repeat(60));

    const startTime = Date.now();

    for (const pkg of PACKAGES) {
        await buildPackage(pkg);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log(`Build completed in ${duration}s`);
    console.log('='.repeat(60));
}

// =============================================================================
// CLI
// =============================================================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // Parse arguments
    const packageFilter = args.includes('--package')
        ? args[args.indexOf('--package') + 1]
        : null;

    if (packageFilter) {
        const pkg = PACKAGES.find(p => p.name === packageFilter || p.dir.includes(packageFilter));
        if (!pkg) {
            console.error(`Package not found: ${packageFilter}`);
            console.error('Available packages:', PACKAGES.map(p => p.name).join(', '));
            process.exit(1);
        }
        await buildPackage(pkg);
    } else {
        await buildAllPackages();
    }
}

main().catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
