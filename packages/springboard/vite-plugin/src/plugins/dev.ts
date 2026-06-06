/**
 * Springboard Dev Plugin
 *
 * Handles development server setup with HMR and ModuleRunner for node platform.
 */

import type { Plugin, ViteDevServer } from 'vite';
import type { NormalizedOptions } from '../types.js';
import { createLogger } from './shared.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, type Duplex } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

const FALLBACK_HEADER = 'x-springboard-fallback';

type ModuleRunner = {
    import: <TModule>(url: string) => Promise<TModule>;
    close: () => void;
};

type WsAdapter = {
    handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;
    closeAll: (code?: number, data?: string | Buffer, force?: boolean) => void;
};

type DevServerHandle = {
    fetch: (request: Request) => Promise<Response>;
    ws?: WsAdapter;
    dispose?: () => Promise<void> | void;
};

type DevServerModule = {
    createDevServer: () => Promise<DevServerHandle> | DevServerHandle;
};

type RequestInitWithDuplex = RequestInit & {
    duplex?: 'half';
};

/**
 * Load the node dev entry template from the templates directory
 */
function loadNodeDevEntryTemplate(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.resolve(currentDir, '../../src/templates/node-dev-entry.template.ts');
    return readFileSync(templatePath, 'utf-8');
}

/**
 * Generate node dev entry code with user entry path injected
 */
function generateNodeDevEntryCode(userEntryPath: string): string {
    const template = loadNodeDevEntryTemplate();
    return template.replace('__USER_ENTRY__', userEntryPath);
}

const createRequestFromNode = (req: IncomingMessage): Request => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
            headers.set(key, value);
        } else if (Array.isArray(value)) {
            for (const entry of value) {
                headers.append(key, entry);
            }
        }
    }

    const method = req.method ?? 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';
    if (hasBody) {
        const requestBody = Readable.toWeb(req) as unknown as BodyInit;
        const requestInit: RequestInitWithDuplex = {
            method,
            headers,
            body: requestBody,
            duplex: 'half',
        };
        return new Request(url, requestInit);
    }

    return new Request(url, { method, headers });
};

const applyResponseToNode = async (res: ServerResponse, response: Response, method: string): Promise<void> => {
    res.statusCode = response.status;
    if (response.statusText) {
        res.statusMessage = response.statusText;
    }

    const headers = response.headers;
    for (const [key, value] of headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') {
            continue;
        }
        res.setHeader(key, value);
    }

    const setCookie = 'getSetCookie' in headers
        ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [];
    if (setCookie.length > 0) {
        res.setHeader('set-cookie', setCookie);
    }

    if (method === 'HEAD' || response.body === null) {
        res.end();
        return;
    }

    const webStream = response.body as unknown as NodeReadableStream<Uint8Array>;
    const body = Readable.fromWeb(webStream);
    body.on('error', (err) => {
        res.destroy(err);
    });
    body.pipe(res);
};

/**
 * Create the springboard dev plugin.
 */
export function springboardDev(options: NormalizedOptions): Plugin {
    const logger = createLogger('dev', options.debug);
    let server: ViteDevServer | null = null;
    let runner: ModuleRunner | null = null;
    let currentFetch: ((request: Request) => Promise<Response>) | null = null;
    let currentWs: WsAdapter | null = null;
    let currentDispose: (() => Promise<void> | void) | null = null;
    let reloadInFlight: Promise<void> | null = null;

    // Check if node platform is active
    const hasNode = options.platforms.includes('node');
    const hasBrowser = options.platforms.includes('browser');

    return {
        name: 'springboard:dev',
        apply: 'serve',

        /**
         * Configure dev server with SSR support for multi-platform setup
         */
        config() {
            if (hasNode || hasBrowser) {
                return {
                    server: {
                        perEnvironmentStartEndDuringDev: true,
                        perEnvironmentWatchChangeDuringDev: true,
                    },
                    ssr: {
                        // noExternal fixes missing .js extensions in springboard imports
                        noExternal: ['springboard'],
                        // Only externalize true native modules
                        external: ['better-sqlite3'],
                    },
                };
            }

            return {};
        },

        /**
         * Configure the dev server
         */
        async configureServer(devServer: ViteDevServer) {
            server = devServer;

            logger.info(`Dev server starting for platform: ${options.platform}`);

            // Custom middleware for Springboard-specific routes
            devServer.middlewares.use((req, res, next) => {
                if (req.url?.startsWith('/__springboard/')) {
                    handleSpringboardRoute(req, res, options);
                    return;
                }
                next();
            });

            if (!hasNode) {
                logger.debug('Node platform not active - skipping node server setup');
                return;
            }

            const springboardDir = path.resolve(options.root, 'node_modules', '.springboard');
            const nodeDevEntryFile = path.join(springboardDir, 'node-dev-entry.ts');

            if (!existsSync(springboardDir)) {
                mkdirSync(springboardDir, { recursive: true });
            }

            const absoluteEntryPath = path.isAbsolute(options.entry)
                ? options.entry
                : path.resolve(options.root, options.entry);
            const relativeEntryPath = path.relative(springboardDir, absoluteEntryPath);

            const nodeDevEntryCode = generateNodeDevEntryCode(relativeEntryPath);
            writeFileSync(nodeDevEntryFile, nodeDevEntryCode, 'utf-8');
            logger.info('Generated node dev entry file for single-port mode');

            const stopServer = async () => {
                if (currentDispose) {
                    await currentDispose();
                }
                if (currentWs) {
                    currentWs.closeAll();
                }
                currentFetch = null;
                currentWs = null;
                currentDispose = null;
                if (runner) {
                    runner.close();
                    runner = null;
                }
            };

            const startServer = async () => {
                const viteModule = await import('vite') as unknown as {
                    createServerModuleRunner: (env: ViteDevServer['environments']['ssr']) => ModuleRunner;
                };

                runner = viteModule.createServerModuleRunner(server!.environments.ssr);

                const mod = await runner.import<DevServerModule>(nodeDevEntryFile);
                if (!mod || typeof mod.createDevServer !== 'function') {
                    logger.error('Dev entry does not export createDevServer()');
                    return;
                }

                const handle = await mod.createDevServer();
                currentFetch = handle.fetch;
                currentWs = handle.ws ?? null;
                currentDispose = handle.dispose ?? null;
            };

            const reloadServer = async () => {
                if (reloadInFlight) {
                    return reloadInFlight;
                }

                reloadInFlight = (async () => {
                    await stopServer();
                    await startServer();
                })();

                try {
                    await reloadInFlight;
                } finally {
                    reloadInFlight = null;
                }

                return undefined;
            };

            await startServer();

            devServer.middlewares.use(async (req, res, next) => {
                if (!currentFetch) {
                    next();
                    return;
                }

                try {
                    const request = createRequestFromNode(req);
                    const response = await currentFetch(request);

                    if (response.headers.get(FALLBACK_HEADER) === '1') {
                        next();
                        return;
                    }

                    await applyResponseToNode(res, response, request.method);
                } catch (err) {
                    next(err as Error);
                }
            });

            devServer.httpServer?.on('upgrade', (req, socket, head) => {
                if (!currentWs) {
                    return;
                }

                const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
                if (url.pathname !== '/ws') {
                    return;
                }

                void currentWs.handleUpgrade(req, socket, head);
            });

            devServer.httpServer?.on('close', () => {
                void stopServer();
            });

            devServer.watcher.on('change', (file) => {
                const ssrModuleGraph = server?.environments.ssr.moduleGraph;
                if (!ssrModuleGraph) {
                    return;
                }

                const changedModules = ssrModuleGraph.getModulesByFile(file);
                if (!changedModules || changedModules.size === 0) {
                    return;
                }

                for (const moduleNode of changedModules) {
                    ssrModuleGraph.invalidateModule(moduleNode);
                }
                void reloadServer();
            });
        },
    };
}

/**
 * Handle Springboard debug routes
 */
function handleSpringboardRoute(
    req: { url?: string },
    res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void },
    options: NormalizedOptions
): void {
    const url = req.url || '';

    if (url === '/__springboard/info') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            platform: options.platform,
            platforms: options.platforms,
            entry: options.entry,
            debug: options.debug,
        }, null, 2));
        return;
    }

    if (url === '/__springboard/platforms') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            current: options.platform,
            available: options.platforms,
            active: options.platforms,
        }, null, 2));
        return;
    }

    // 404 for unknown routes
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
}

export default springboardDev;
