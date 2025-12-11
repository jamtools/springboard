/**
 * Vite Build Orchestrator
 *
 * Orchestrates Vite builds for all platforms.
 * Handles multi-target builds, post-build hooks, and output directory management.
 */

import { build as viteBuild } from 'vite';
import type { SpringboardPlatform, Plugin, DocumentMeta, BuildResult } from '../types.js';
import {
    generateViteConfig,
    generateServerConfig,
    platformConfigs,
} from '../config/vite_config_generator.js';

/**
 * Options for building all platforms
 */
export interface BuildAllOptions {
    /** Application entrypoint file */
    applicationEntrypoint: string;
    /** Platforms to build */
    platforms: Set<SpringboardPlatform>;
    /** Custom plugins */
    plugins?: Plugin[];
    /** Watch mode */
    watch?: boolean;
    /** Document metadata */
    documentMeta?: DocumentMeta;
    /** Custom output directory */
    outDir?: string;
    /** Custom define values for specific platforms */
    platformDefines?: Record<string, Record<string, string>>;
}

/**
 * Build all requested platforms
 */
export async function buildAllPlatforms(options: BuildAllOptions): Promise<BuildResult[]> {
    const {
        applicationEntrypoint,
        platforms,
        plugins = [],
        watch = false,
        documentMeta,
        outDir = './dist',
        platformDefines = {},
    } = options;

    const results: BuildResult[] = [];
    const cwd = process.cwd();

    // Determine which platforms to build based on the platform set
    const platformsToBuild = resolvePlatformsToBuild(platforms);

    console.log(`Building platforms: ${platformsToBuild.join(', ')}`);

    // Build each platform
    for (const platformKey of platformsToBuild) {
        const platformConfig = platformConfigs[platformKey];
        if (!platformConfig) {
            console.warn(`Unknown platform: ${platformKey}`);
            continue;
        }

        const startTime = Date.now();

        try {
            const config = await generateViteConfig({
                applicationEntrypoint,
                platformConfig,
                plugins,
                documentMeta,
                rootDir: cwd,
                baseOutDir: outDir,
                watch,
                customDefines: platformDefines[platformKey],
            });

            await viteBuild(config);

            results.push({
                platform: platformKey,
                outDir: `${outDir}/${platformConfig.outDir}`,
                duration: Date.now() - startTime,
                success: true,
            });

            console.log(`[${platformKey}] Build successful`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.push({
                platform: platformKey,
                outDir: `${outDir}/${platformConfig.outDir}`,
                duration: Date.now() - startTime,
                success: false,
                error: errorMessage,
            });

            console.error(`[${platformKey}] Build failed:`, errorMessage);
        }
    }

    return results;
}

/**
 * Build the main platform set (browser + node + server)
 */
export async function buildMain(options: Omit<BuildAllOptions, 'platforms'>): Promise<BuildResult[]> {
    const {
        applicationEntrypoint,
        plugins = [],
        watch = false,
        documentMeta,
        outDir = './dist',
    } = options;

    const results: BuildResult[] = [];
    const cwd = process.cwd();

    // Build browser
    const browserResult = await buildPlatform({
        applicationEntrypoint,
        platformKey: 'browser',
        plugins,
        watch,
        documentMeta,
        outDir,
        rootDir: cwd,
    });
    results.push(browserResult);

    // Build node
    const nodeResult = await buildPlatform({
        applicationEntrypoint,
        platformKey: 'node',
        plugins,
        watch,
        outDir,
        rootDir: cwd,
    });
    results.push(nodeResult);

    // Build server
    const serverResult = await buildServer({
        plugins,
        watch,
        outDir,
        rootDir: cwd,
    });
    results.push(serverResult);

    return results;
}

/**
 * Build a single platform
 */
export async function buildPlatform(options: {
    applicationEntrypoint: string;
    platformKey: string;
    plugins?: Plugin[];
    watch?: boolean;
    documentMeta?: DocumentMeta;
    outDir?: string;
    rootDir?: string;
    customDefines?: Record<string, string>;
}): Promise<BuildResult> {
    const {
        applicationEntrypoint,
        platformKey,
        plugins = [],
        watch = false,
        documentMeta,
        outDir = './dist',
        rootDir = process.cwd(),
        customDefines,
    } = options;

    const platformConfig = platformConfigs[platformKey];
    if (!platformConfig) {
        throw new Error(`Unknown platform: ${platformKey}`);
    }

    const startTime = Date.now();

    try {
        const config = await generateViteConfig({
            applicationEntrypoint,
            platformConfig,
            plugins,
            documentMeta,
            rootDir,
            baseOutDir: outDir,
            watch,
            customDefines,
        });

        await viteBuild(config);

        return {
            platform: platformKey,
            outDir: `${outDir}/${platformConfig.outDir}`,
            duration: Date.now() - startTime,
            success: true,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            platform: platformKey,
            outDir: `${outDir}/${platformConfig.outDir}`,
            duration: Date.now() - startTime,
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Build the server
 */
export async function buildServer(options: {
    plugins?: Plugin[];
    watch?: boolean;
    outDir?: string;
    rootDir?: string;
    applicationDistPath?: string;
    serverEntrypoint?: string;
    customDefines?: Record<string, string>;
}): Promise<BuildResult> {
    const {
        plugins = [],
        watch = false,
        outDir = './dist',
        rootDir = process.cwd(),
        applicationDistPath,
        serverEntrypoint,
        customDefines,
    } = options;

    const startTime = Date.now();

    try {
        const config = await generateServerConfig({
            rootDir,
            baseOutDir: outDir,
            applicationDistPath,
            serverEntrypoint,
            plugins,
            watch,
            customDefines,
        });

        await viteBuild(config);

        return {
            platform: 'server',
            outDir: `${outDir}/server/dist`,
            duration: Date.now() - startTime,
            success: true,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            platform: 'server',
            outDir: `${outDir}/server/dist`,
            duration: Date.now() - startTime,
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Build PartyKit platform (server + browser)
 */
export async function buildPartyKit(options: {
    applicationEntrypoint: string;
    plugins?: Plugin[];
    watch?: boolean;
    documentMeta?: DocumentMeta;
    outDir?: string;
    rootDir?: string;
}): Promise<BuildResult[]> {
    const {
        applicationEntrypoint,
        plugins = [],
        watch = false,
        documentMeta,
        outDir = './dist',
        rootDir = process.cwd(),
    } = options;

    const results: BuildResult[] = [];

    // Build PartyKit browser
    const browserResult = await buildPlatform({
        applicationEntrypoint,
        platformKey: 'partykit_browser',
        plugins,
        watch,
        documentMeta,
        outDir,
        rootDir,
    });
    results.push(browserResult);

    // Build PartyKit server
    const serverResult = await buildPlatform({
        applicationEntrypoint,
        platformKey: 'partykit_server',
        plugins,
        watch,
        outDir,
        rootDir,
    });
    results.push(serverResult);

    return results;
}

/**
 * Build Tauri platform (webview + maestro + server)
 */
export async function buildTauri(options: {
    applicationEntrypoint: string;
    plugins?: Plugin[];
    watch?: boolean;
    documentMeta?: DocumentMeta;
    outDir?: string;
    rootDir?: string;
}): Promise<BuildResult[]> {
    const {
        applicationEntrypoint,
        plugins = [],
        watch = false,
        documentMeta,
        outDir = './dist',
        rootDir = process.cwd(),
    } = options;

    const results: BuildResult[] = [];

    // Build Tauri webview (browser for desktop)
    const webviewResult = await buildPlatform({
        applicationEntrypoint,
        platformKey: 'tauri_webview',
        plugins,
        watch,
        documentMeta,
        outDir,
        rootDir,
        customDefines: {
            'process.env.DATA_HOST': "'http://127.0.0.1:1337'",
            'process.env.WS_HOST': "'ws://127.0.0.1:1337'",
            'process.env.RUN_SIDECAR_FROM_WEBVIEW': `${process.env.RUN_SIDECAR_FROM_WEBVIEW && process.env.RUN_SIDECAR_FROM_WEBVIEW !== 'false'}`,
        },
    });
    results.push(webviewResult);

    // Build Tauri maestro (node backend)
    const maestroResult = await buildPlatform({
        applicationEntrypoint,
        platformKey: 'tauri_maestro',
        plugins,
        watch,
        outDir,
        rootDir,
    });
    results.push(maestroResult);

    // Build server for Tauri
    const serverResult = await buildServer({
        plugins,
        watch,
        outDir: `${outDir}/tauri`,
        rootDir,
        applicationDistPath: '../../node/dist/dynamic-entry.js',
    });
    results.push(serverResult);

    return results;
}

/**
 * Resolve which platforms to build based on the platform set
 */
function resolvePlatformsToBuild(platforms: Set<SpringboardPlatform>): string[] {
    const platformsToBuild: string[] = [];

    if (platforms.has('all')) {
        // Build everything
        return [
            'browser',
            'browser_offline',
            'node',
            'partykit_browser',
            'partykit_server',
            'tauri_webview',
            'tauri_maestro',
            'server',
        ];
    }

    if (platforms.has('main')) {
        platformsToBuild.push('browser', 'node', 'server');
    }

    if (platforms.has('browser')) {
        if (!platformsToBuild.includes('browser')) {
            platformsToBuild.push('browser');
        }
    }

    if (platforms.has('browser_offline')) {
        platformsToBuild.push('browser_offline');
    }

    if (platforms.has('node')) {
        if (!platformsToBuild.includes('node')) {
            platformsToBuild.push('node');
        }
    }

    if (platforms.has('desktop')) {
        platformsToBuild.push('tauri_webview', 'tauri_maestro');
        if (!platformsToBuild.includes('server')) {
            platformsToBuild.push('server');
        }
    }

    if (platforms.has('partykit')) {
        platformsToBuild.push('partykit_browser', 'partykit_server');
    }

    if (platforms.has('mobile')) {
        platformsToBuild.push('mobile');
    }

    return platformsToBuild;
}

/**
 * Print build summary
 */
export function printBuildSummary(results: BuildResult[]): void {
    console.log('\n--- Build Summary ---');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
        console.log(`\nSuccessful builds (${successful.length}):`);
        for (const result of successful) {
            console.log(`  [${result.platform}] ${result.outDir} (${result.duration}ms)`);
        }
    }

    if (failed.length > 0) {
        console.log(`\nFailed builds (${failed.length}):`);
        for (const result of failed) {
            console.log(`  [${result.platform}] ${result.error}`);
        }
    }

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\nTotal build time: ${totalDuration}ms`);
}
