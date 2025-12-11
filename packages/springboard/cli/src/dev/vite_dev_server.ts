/**
 * Vite Dev Server Orchestrator
 *
 * Handles multiple Vite instances when needed (e.g., PartyKit server + client).
 * Coordinates HMR across platforms and manages proper lifecycle (startup, shutdown, restart).
 */

import { createServer, build as viteBuild, type ViteDevServer, type InlineConfig } from 'vite';
import { spawn, type ChildProcess } from 'child_process';
import type { SpringboardPlatform, Plugin, DocumentMeta, ViteInstanceInfo } from '../types.js';
import {
    generateViteConfig,
    generateServerConfig,
    platformConfigs,
} from '../config/vite_config_generator.js';

/**
 * Options for the dev server orchestrator
 */
export interface DevServerOptions {
    /** Application entrypoint file */
    applicationEntrypoint: string;
    /** Platforms to run dev server for */
    platforms: Set<SpringboardPlatform>;
    /** Custom plugins */
    plugins?: Plugin[];
    /** Dev server port */
    port?: number;
    /** Enable HMR */
    hmr?: boolean;
    /** Document metadata */
    documentMeta?: DocumentMeta;
    /** Custom output directory */
    outDir?: string;
}

/**
 * Dev server orchestrator state
 */
interface OrchestratorState {
    /** Active Vite dev servers */
    servers: Map<string, ViteDevServer>;
    /** Active build watchers */
    watchers: Map<string, unknown>;
    /** Node server process */
    nodeProcess: ChildProcess | null;
    /** Whether the orchestrator is running */
    running: boolean;
}

/**
 * Start the development server orchestrator
 */
export async function startDevServer(options: DevServerOptions): Promise<OrchestratorState> {
    const {
        applicationEntrypoint,
        platforms,
        plugins = [],
        port = 5173,
        hmr = true,
        documentMeta,
        outDir = './dist',
    } = options;

    const state: OrchestratorState = {
        servers: new Map(),
        watchers: new Map(),
        nodeProcess: null,
        running: false,
    };

    const cwd = process.cwd();

    // Determine which platforms to start dev servers for
    const platformsToDev = resolvePlatformsToDev(platforms);

    console.log(`Starting dev server for platforms: ${platformsToDev.join(', ')}`);

    // Start browser dev server with HMR
    if (platformsToDev.includes('browser')) {
        const browserServer = await startBrowserDevServer({
            applicationEntrypoint,
            plugins,
            port,
            hmr,
            documentMeta,
            outDir,
            rootDir: cwd,
        });
        state.servers.set('browser', browserServer);
    }

    // Start node build in watch mode
    if (platformsToDev.includes('node')) {
        await startNodeWatcher({
            applicationEntrypoint,
            plugins,
            outDir,
            rootDir: cwd,
        });
        console.log('[node] Build watcher started');
    }

    // Start server build in watch mode
    if (platformsToDev.includes('server')) {
        await startServerWatcher({
            plugins,
            outDir,
            rootDir: cwd,
        });
        console.log('[server] Build watcher started');
    }

    // Handle PartyKit (needs both server and browser)
    if (platformsToDev.includes('partykit')) {
        await startPartykitWatchers({
            applicationEntrypoint,
            plugins,
            outDir,
            rootDir: cwd,
        });
        console.log('[partykit] Build watchers started');
    }

    // Handle Tauri (needs webview and maestro)
    if (platformsToDev.includes('desktop')) {
        await startTauriWatchers({
            applicationEntrypoint,
            plugins,
            documentMeta,
            outDir,
            rootDir: cwd,
        });
        console.log('[tauri] Build watchers started');
    }

    // Wait a moment for builds to complete before starting node server
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Start the Node server process
    state.nodeProcess = await startNodeServer();

    state.running = true;

    // Setup graceful shutdown
    setupGracefulShutdown(state);

    return state;
}

/**
 * Start the browser dev server with HMR
 */
async function startBrowserDevServer(options: {
    applicationEntrypoint: string;
    plugins: Plugin[];
    port: number;
    hmr: boolean;
    documentMeta?: DocumentMeta;
    outDir: string;
    rootDir: string;
}): Promise<ViteDevServer> {
    const {
        applicationEntrypoint,
        plugins,
        port,
        hmr,
        documentMeta,
        outDir,
        rootDir,
    } = options;

    const platformConfig = platformConfigs.browser;

    const baseConfig = await generateViteConfig({
        applicationEntrypoint,
        platformConfig,
        plugins,
        documentMeta,
        rootDir,
        baseOutDir: outDir,
        dev: true,
    });

    // Merge dev server specific config
    const devConfig: InlineConfig = {
        ...baseConfig,
        server: {
            port,
            hmr: hmr ? {
                overlay: true,
            } : false,
            watch: {
                usePolling: false,
            },
        },
        // Enable optimized deps in dev
        optimizeDeps: {
            include: ['react', 'react-dom'],
        },
    };

    const server = await createServer(devConfig);
    await server.listen();

    console.log(`[browser] Dev server running at http://localhost:${port}`);

    return server;
}

/**
 * Start Node platform build in watch mode
 */
async function startNodeWatcher(options: {
    applicationEntrypoint: string;
    plugins: Plugin[];
    outDir: string;
    rootDir: string;
}): Promise<void> {
    const { applicationEntrypoint, plugins, outDir, rootDir } = options;

    const platformConfig = platformConfigs.node;

    const config = await generateViteConfig({
        applicationEntrypoint,
        platformConfig,
        plugins,
        rootDir,
        baseOutDir: outDir,
        watch: true,
        dev: true,
    });

    await viteBuild(config);
}

/**
 * Start server build in watch mode
 */
async function startServerWatcher(options: {
    plugins: Plugin[];
    outDir: string;
    rootDir: string;
}): Promise<void> {
    const { plugins, outDir, rootDir } = options;

    const config = await generateServerConfig({
        rootDir,
        baseOutDir: outDir,
        plugins,
        watch: true,
    });

    await viteBuild(config);
}

/**
 * Start PartyKit watchers (server + browser)
 */
async function startPartykitWatchers(options: {
    applicationEntrypoint: string;
    plugins: Plugin[];
    outDir: string;
    rootDir: string;
}): Promise<void> {
    const { applicationEntrypoint, plugins, outDir, rootDir } = options;

    // Start PartyKit browser watcher
    const browserConfig = await generateViteConfig({
        applicationEntrypoint,
        platformConfig: platformConfigs.partykit_browser,
        plugins,
        rootDir,
        baseOutDir: outDir,
        watch: true,
        dev: true,
    });
    await viteBuild(browserConfig);

    // Start PartyKit server watcher
    const serverConfig = await generateViteConfig({
        applicationEntrypoint,
        platformConfig: platformConfigs.partykit_server,
        plugins,
        rootDir,
        baseOutDir: outDir,
        watch: true,
        dev: true,
    });
    await viteBuild(serverConfig);
}

/**
 * Start Tauri watchers (webview + maestro)
 */
async function startTauriWatchers(options: {
    applicationEntrypoint: string;
    plugins: Plugin[];
    documentMeta?: DocumentMeta;
    outDir: string;
    rootDir: string;
}): Promise<void> {
    const { applicationEntrypoint, plugins, documentMeta, outDir, rootDir } = options;

    // Start Tauri webview watcher
    const webviewConfig = await generateViteConfig({
        applicationEntrypoint,
        platformConfig: platformConfigs.tauri_webview,
        plugins,
        documentMeta,
        rootDir,
        baseOutDir: outDir,
        watch: true,
        dev: true,
        customDefines: {
            'process.env.DATA_HOST': "'http://127.0.0.1:1337'",
            'process.env.WS_HOST': "'ws://127.0.0.1:1337'",
        },
    });
    await viteBuild(webviewConfig);

    // Start Tauri maestro watcher
    const maestroConfig = await generateViteConfig({
        applicationEntrypoint,
        platformConfig: platformConfigs.tauri_maestro,
        plugins,
        rootDir,
        baseOutDir: outDir,
        watch: true,
        dev: true,
    });
    await viteBuild(maestroConfig);

    // Start Tauri server watcher
    const serverConfig = await generateServerConfig({
        rootDir,
        baseOutDir: `${outDir}/tauri`,
        plugins,
        watch: true,
    });
    await viteBuild(serverConfig);
}

/**
 * Start the Node server process with watch and restart
 */
async function startNodeServer(): Promise<ChildProcess> {
    const nodeArgs = ['--watch', '--watch-preserve-output', 'dist/server/dist/local-server.cjs'];

    console.log('[server] Starting Node server...');

    const nodeProcess = spawn('node', nodeArgs, {
        stdio: 'inherit',
        shell: true,
    });

    nodeProcess.on('error', (error) => {
        console.error('[server] Failed to start:', error);
    });

    nodeProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`[server] Exited with code ${code}`);
        }
    });

    return nodeProcess;
}

/**
 * Stop all dev servers and watchers
 */
export async function stopDevServer(state: OrchestratorState): Promise<void> {
    console.log('\nShutting down dev server...');

    state.running = false;

    // Stop all Vite dev servers
    for (const [name, server] of state.servers) {
        console.log(`[${name}] Stopping dev server...`);
        await server.close();
    }

    // Kill Node server process
    if (state.nodeProcess) {
        console.log('[server] Stopping Node server...');
        state.nodeProcess.kill('SIGTERM');
    }

    console.log('Dev server stopped.');
}

/**
 * Setup graceful shutdown on SIGINT/SIGTERM
 */
function setupGracefulShutdown(state: OrchestratorState): void {
    const shutdown = async () => {
        if (!state.running) return;
        await stopDevServer(state);
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

/**
 * Resolve which platforms to start dev servers for
 */
function resolvePlatformsToDev(platforms: Set<SpringboardPlatform>): string[] {
    const platformsToDev: string[] = [];

    if (platforms.has('all') || platforms.has('main')) {
        platformsToDev.push('browser', 'node', 'server');
    }

    if (platforms.has('browser') && !platformsToDev.includes('browser')) {
        platformsToDev.push('browser');
    }

    if (platforms.has('node') && !platformsToDev.includes('node')) {
        platformsToDev.push('node');
    }

    if (platforms.has('desktop')) {
        platformsToDev.push('desktop');
    }

    if (platforms.has('partykit')) {
        platformsToDev.push('partykit');
    }

    if (platforms.has('mobile')) {
        platformsToDev.push('mobile');
    }

    return platformsToDev;
}

/**
 * Get active instances info for status display
 */
export function getActiveInstances(state: OrchestratorState): ViteInstanceInfo[] {
    const instances: ViteInstanceInfo[] = [];

    for (const [name, server] of state.servers) {
        instances.push({
            id: name,
            platform: name,
            port: server.config.server.port,
            server,
            isDev: true,
        });
    }

    return instances;
}
