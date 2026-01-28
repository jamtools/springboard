import {Context, Hono} from 'hono';
// import {serveStatic} from '@hono/node-server/serve-static';
import {serveStatic} from 'hono/serve-static';
import {cors} from 'hono/cors';

import {ServerAppDependencies} from './types/server_app_dependencies';

import {createCommonWebSocketHooks} from './services/crossws_json_rpc';
import {RpcMiddleware, ServerModuleAPI, serverRegistry} from './register';
import {KVStore, Springboard} from '../core';
import {Adapter, AdapterInstance, Hooks} from 'crossws';
import {ServerJsonRpcClientAndServer} from './services/server_json_rpc';
import {Data} from 'hono/dist/types/context';
import type {Peer} from 'crossws';

type InitAppReturnValue = {
    app: Hono;
    serverAppDependencies: ServerAppDependencies;
    injectResources: (args: InjectResourcesArgs) => void;
    createWebSocketHooks: (enableRpc?: boolean) => ReturnType<typeof createCommonWebSocketHooks>;
};

type InitServerAppArgs = {
    remoteKV: KVStore;
    userAgentKV: KVStore;
    broadcastMessage: (message: string) => void;
};

type InjectResourcesArgs = {
    engine: Springboard;
    serveStaticFile: (c: Context, fileName: string, headers: Record<string, string>) => Promise<Response>;
    getEnvValue: (name: string) => string | undefined;
};

type AdapterFactory = (hooks: Partial<Hooks>) => AdapterInstance;

export const initApp = (initArgs: InitServerAppArgs): InitAppReturnValue => {
    const rpcMiddlewares: RpcMiddleware[] = [];

    const app = new Hono();

    app.use('*', cors());


    const remoteKV = initArgs.remoteKV;
    const userAgentKV = initArgs.userAgentKV;

    const rpc = new ServerJsonRpcClientAndServer({
        broadcastMessage: (message) => {
            return initArgs.broadcastMessage(message);
        },
    });

    const processRequestWithMiddleware = async (middlewares: RpcMiddleware[], c: Context, message: string) => {
        if (!message) {
            return;
        }

        const jsonMessage = JSON.parse(message);
        if (!jsonMessage) {
            return;
        }

        if (jsonMessage.jsonrpc !== '2.0') {
            return;
        }

        if (!jsonMessage.method) {
            return;
        }

        const rpcContext: object = {};
        for (const middleware of middlewares) {
            try {
                const middlewareResult = await middleware(c);
                Object.assign(rpcContext, middlewareResult);
            } catch (e) {
                return JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonMessage.id,
                    error: (e as Error).message,
                });
            }
        }

        const response = await rpc.processRequest(message, rpcContext);
        return response;

        // return new Promise<string>((resolve) => {
        //     nodeRpcAsyncLocalStorage.run(rpcContext, async () => {
        //         const response = await rpc.processRequest(message);
        //         resolve(response);
        //     });
        // });
    };

    const processWebSocketRpcMessage = async (message: string, peer: Peer) => {
        // Create a minimal context object for middleware compatibility
        const minimalContext = {
            req: peer.request || { url: '/' },
        } as unknown as Context;

        const response = await processRequestWithMiddleware(rpcMiddlewares, minimalContext, message);
        return response;
    };

    // const webappFolder = process.env.WEBAPP_FOLDER || './dist/browser';
    // const webappDistFolder = path.join(webappFolder, './dist');

    // const websocketHooks = service.createWebSocketHooks();

    // WebSocket route - crossws will handle upgrade through the adapter


    // TODO: is this actually necessary to have here?
    app.get('/ws', (c) => {
        // This route is a placeholder - crossws adapter handles the actual upgrade
        return c.text('WebSocket endpoint', 426);
    });

    app.get('/kv/get', async (c) => {
        const key = c.req.query('key');

        if (!key) {
            return c.json({error: 'No key provided'}, 400);
        }

        const value = await remoteKV.get(key);

        return c.json(value || null);
    });

    app.post('/kv/set', async (c) => {
        return c.json({error: 'Not supported'}, 400);
    });

    app.get('/kv/get-all', async (c) => {
        const all = await remoteKV.getAll();
        return c.json(all);
    });

    app.post('/rpc/*', async (c) => {
        const body = await c.req.text();
        c.header('Content-Type', 'application/json');

        const rpcResponse = await processRequestWithMiddleware(rpcMiddlewares, c, body);
        if (rpcResponse) {
            return c.text(rpcResponse);
        }

        return c.json({
            error: 'No response',
        }, 500);
    });

    // this is necessary because https://github.com/honojs/hono/issues/3483
    // node-server serveStatic is missing absolute path support
    // const serveFile = async (path: string, contentType: string, c: Context) => {
    //     try {
    //         const fullPath = `${webappDistFolder}/${path}`;
    //         const fs = await import('node:fs');
    //         const data = await fs.promises.readFile(fullPath, 'utf-8');
    //         c.status(200);
    //         return data;
    //     } catch (error) {
    //         console.error('Error serving fallback file:', error);
    //         c.status(404);
    //         return '404 Not Found';
    //     }
    // };

    // app.use('/', serveStatic({
    //     root: webappDistFolder,
    //     path: 'index.html',
    //     getContent: async (path, c) => {
    //         return serveFile('index.html', 'text/html', c);
    //     },
    //     onFound: (path, c) => {
    //         // c.header('Cross-Origin-Embedder-Policy',  'require-corp');
    //         // c.header('Cross-Origin-Opener-Policy',  'same-origin');
    //         c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    //         c.header('Pragma', 'no-cache');
    //         c.header('Expires', '0');
    //     },
    // }));

    // Route handlers that require fetch context will be configured in injectResources
    let serveStaticFileFn: ((c: Context, fileName: string, headers: Record<string, string>) => Promise<Response>) | undefined;
    let getEnvValueFn: ((name: string) => string | undefined) | undefined;

    app.use('/', async (c) => {
        if (!serveStaticFileFn) {
            return c.text('Server not fully initialized', 500);
        }
        const headers = {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Type': 'text/html'
        };
        return serveStaticFileFn(c, 'index.html', headers);
    });

    app.use('/dist/:file', async (c, next) => {
        if (!serveStaticFileFn || !getEnvValueFn) {
            return c.text('Server not fully initialized', 500);
        }

        const requestedFile = c.req.param('file');

        if (requestedFile.endsWith('.map') && getEnvValueFn('NODE_ENV') === 'production') {
            return c.text('Source map disabled', 404);
        }

        const contentType = requestedFile.endsWith('.js') ? 'text/javascript' : 'text/css';
        const headers = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        return serveStaticFileFn(c, requestedFile, headers);

        // return serveStatic({
        //     root: webappDistFolder,
        //     path: `/${requestedFile}`,
        //     getContent: async (path, c) => {
        //         return serveFile(requestedFile, contentType, c);
        //     },
        //     onFound: (path, c) => {
        //         c.header('Content-Type', contentType);
        //         c.header('Cache-Control', 'public, max-age=31536000, immutable');
        //     },
        // })(c, next);
    });

    // app.use('/dist/manifest.json', serveStatic({
    //     root: webappDistFolder,
    //     path: '/manifest.json',
    //     getContent: async (path, c) => {
    //         return serveFile('manifest.json', 'application/json', c);
    //     }
    // }));

    // OTEL traces route
    // app.post('/v1/traces', async (c) => {
    //     const otelHost = process.env.OTEL_HOST;
    //     if (!otelHost) return c.json({message: 'No OTEL host set up via env var'});

    //     try {
    //         const response = await fetch(`${otelHost}/v1/traces`, {
    //             method: 'POST',
    //             headers: {'Content-Type': 'application/json'},
    //             body: JSON.stringify(await c.req.json()),
    //             signal: AbortSignal.timeout(1000),
    //         });
    //         return c.text(await response.text());
    //     } catch {
    //         return c.json({message: 'Failed to contact OTEL host'});
    //     }
    // });

    let storedEngine: Springboard | undefined;

    const serverAppDependencies: ServerAppDependencies = {
        rpc: {
            remote: rpc,
            local: undefined,
        },
        storage: {
            remote: remoteKV,
            userAgent: userAgentKV,
        },
    };

    const makeServerModuleAPI = (): ServerModuleAPI => {
        return {
            hono: app,
            hooks: {
                registerRpcMiddleware: (cb) => {
                    rpcMiddlewares.push(cb);
                },
            },
            getEngine: () => storedEngine!,
        };
    };

    // Catch-all route for SPA
    // app.use('*', serveStatic({
    //     root: webappDistFolder,
    //     path: 'index.html',
    //     getContent: async (path, c) => {
    //         return serveFile('index.html', 'text/html', c);
    //     },
    //     onFound: (path, c) => {
    //         // c.header('Cross-Origin-Embedder-Policy',  'require-corp');
    //         // c.header('Cross-Origin-Opener-Policy',  'same-origin');
    //         c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    //         c.header('Pragma', 'no-cache');
    //         c.header('Expires', '0');
    //     },
    // }));

    app.use('*', async (c) => {
        if (!serveStaticFileFn) {
            return c.text('Server not fully initialized', 500);
        }
        const headers = {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Type': 'text/html'
        };

        return serveStaticFileFn(c, 'index.html', headers);
    });

    const injectResources = (args: InjectResourcesArgs) => {
        if (storedEngine) {
            throw new Error('Resources already injected');
        }

        storedEngine = args.engine;
        serveStaticFileFn = args.serveStaticFile;
        getEnvValueFn = args.getEnvValue;

        const registerServerModule: typeof serverRegistry['registerServerModule'] = (cb) => {
            cb(makeServerModuleAPI());
        };

        const registeredServerModuleCallbacks = (serverRegistry.registerServerModule as unknown as {calls: CapturedRegisterServerModuleCall[]}).calls || [];
        serverRegistry.registerServerModule = registerServerModule;

        for (const call of registeredServerModuleCallbacks) {
            call(makeServerModuleAPI());
        }
    };

    const createWebSocketHooks = (enableRpc?: boolean) => {
        if (enableRpc) {
            return createCommonWebSocketHooks(processWebSocketRpcMessage);
        } else {
            return createCommonWebSocketHooks();
        }
    };

    return {app, serverAppDependencies, injectResources, createWebSocketHooks};
};

type ServerModuleCallback = (server: ServerModuleAPI) => void;

type CapturedRegisterServerModuleCall = ServerModuleCallback;
