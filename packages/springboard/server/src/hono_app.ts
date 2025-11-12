import path from 'path';

import {Context, Hono} from 'hono';
// import {serveStatic} from '@hono/node-server/serve-static';
import {serveStatic} from 'hono/serve-static';
import {createNodeWebSocket} from '@hono/node-ws';
import {cors} from 'hono/cors';

import {NodeAppDependencies} from '@springboardjs/platforms-node/entrypoints/main';
import {KVStoreFromKysely} from '@springboardjs/data-storage/kv_api_kysely';
import {NodeKVStoreService} from '@springboardjs/platforms-node/services/node_kvstore_service';
import {NodeLocalJsonRpcClientAndServer} from '@springboardjs/platforms-node/services/node_local_json_rpc';
import type {DocumentMeta} from 'springboard/module_registry/module_registry';
import type {DocumentMetaFunction} from 'springboard/engine/register';

import {NodeJsonRpcServer} from './services/server_json_rpc';
import {WebsocketServerCoreDependencies} from './ws_server_core_dependencies';
import {RpcMiddleware, ServerModuleAPI, serverRegistry} from './register';
import {Springboard} from 'springboard/engine/engine';
import {injectDocumentMeta} from './utils/inject_metadata';
import {matchPath} from './utils/match_path';

type InitAppReturnValue = {
    app: Hono;
    injectWebSocket: ReturnType<typeof createNodeWebSocket>['injectWebSocket'];
    nodeAppDependencies: NodeAppDependencies;
};

export const initApp = (kvDeps: WebsocketServerCoreDependencies): InitAppReturnValue => {
    const rpcMiddlewares: RpcMiddleware[] = [];

    const app = new Hono();

    app.use('*', cors());

    const service: NodeJsonRpcServer = new NodeJsonRpcServer({
        processRequest: async (message) => {
            return rpc!.processRequest(message);
        },
        rpcMiddlewares,
    });

    const remoteKV = new KVStoreFromKysely(kvDeps.kvDatabase);
    const userAgentStore = new NodeKVStoreService('userAgent');

    const rpc = new NodeLocalJsonRpcClientAndServer({
        broadcastMessage: (message) => {
            return service.broadcastMessage(message);
        },
    });

    const webappFolder = process.env.WEBAPP_FOLDER || './dist/browser';
    const webappDistFolder = path.join(webappFolder, './dist');

    const {injectWebSocket, upgradeWebSocket} = createNodeWebSocket({app});

    app.get('/ws', upgradeWebSocket(c => service.handleConnection(c)));

    app.get('/kv/get', async (c) => {
        const key = c.req.param('key');

        if (!key) {
            return c.json({error: 'No key provided'}, 400);
        }

        const value = await remoteKV.get(key);

        return c.json(value || null);
    });

    app.post('/kv/set', async (c) => {
        const body = await c.req.text();
        const {key, value} = JSON.parse(body);

        c.header('Content-Type', 'application/json');

        if (!key) {
            return c.json({error: 'No key provided'}, 400);
        }

        if (!value) {
            return c.json({error: 'No value provided'}, 400);
        }

        await remoteKV.set(key, value);
        return c.json({success: true});
    });

    app.get('/kv/get-all', async (c) => {
        const all = await remoteKV.getAll();
        return c.json(all);
    });

    app.post('/rpc/*', async (c) => {
        const body = await c.req.text();
        c.header('Content-Type', 'application/json');

        const rpcResponse = await service.processRequestWithMiddleware(c, body);
        if (rpcResponse) {
            return c.text(rpcResponse);
        }

        return c.text(JSON.stringify({
            error: 'No response',
        }), 500);
    });

    // this is necessary because https://github.com/honojs/hono/issues/3483
    // node-server serveStatic is missing absolute path support
    const serveFile = async (path: string, contentType: string, c: Context) => {
        try {
            const fullPath = `${webappDistFolder}/${path}`;
            const fs = await import('node:fs');
            const data = await fs.promises.readFile(fullPath, 'utf-8');
            c.status(200);
            return data;
        } catch (error) {
            console.error('Error serving fallback file:', error);
            c.status(404);
            return '404 Not Found';
        }
    };

    let cachedBaseHtml: string | undefined;
    let storedEngine: Springboard | undefined;


    // Serves index.html with dynamic metadata injection based on the route
    const serveIndexWithMetadata = async (c: Context): Promise<string> => {
        if (!cachedBaseHtml) {
            const fullPath = `${webappDistFolder}/index.html`;
            const fs = await import('node:fs');
            cachedBaseHtml = await fs.promises.readFile(fullPath, 'utf-8');
        }

        if (!storedEngine) {
            return cachedBaseHtml;
        }

        const requestPath = c.req.path;

        let documentMetaOrFunction: DocumentMeta | DocumentMetaFunction | undefined;
        let matchParams: Record<string, string> | undefined;
        const modules = storedEngine.moduleRegistry.getModules();

        for (const mod of modules) {
            if (!mod.routes) {
                continue;
            }

            for (const [routePath, route] of Object.entries(mod.routes)) {
                if (!route.options?.documentMeta) {
                    continue;
                }

                // Routes starting with '/' are absolute, others are relative to /modules/{moduleId}
                const fullRoutePath = routePath.startsWith('/')
                    ? routePath
                    : `/modules/${mod.moduleId}${routePath}`;

                const match = matchPath(fullRoutePath, requestPath);
                if (match) {
                    documentMetaOrFunction = route.options.documentMeta;
                    matchParams = match.params as Record<string, string>;
                    break;
                }
            }

            if (documentMetaOrFunction) {
                break;
            }
        }

        if (documentMetaOrFunction) {
            let documentMeta: DocumentMeta;

            if (typeof documentMetaOrFunction === 'function') {
                documentMeta = await documentMetaOrFunction({
                    path: requestPath,
                    params: matchParams,
                });
            } else {
                documentMeta = documentMetaOrFunction;
            }

            return injectDocumentMeta(cachedBaseHtml, documentMeta);
        }

        return cachedBaseHtml;
    };

    app.use('/', serveStatic({
        root: webappDistFolder,
        path: 'index.html',
        getContent: async (path, c) => {
            return serveIndexWithMetadata(c);
        },
        onFound: (path, c) => {
            // c.header('Cross-Origin-Embedder-Policy',  'require-corp');
            // c.header('Cross-Origin-Opener-Policy',  'same-origin');
            c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
            c.header('Pragma', 'no-cache');
            c.header('Expires', '0');
        },
    }));

    app.use('/dist/:file', async (c, next) => {
        const requestedFile = c.req.param('file');

        if (requestedFile.endsWith('.map') && process.env.NODE_ENV === 'production') {
            return c.text('Source map disabled', 404);
        }

        const contentType = requestedFile.endsWith('.js') ? 'text/javascript' : 'text/css';
        return serveStatic({
            root: webappDistFolder,
            path: `/${requestedFile}`,
            getContent: async (path, c) => {
                return serveFile(requestedFile, contentType, c);
            },
            onFound: (path, c) => {
                c.header('Content-Type', contentType);
                c.header('Cache-Control', 'public, max-age=31536000, immutable');
            },
        })(c, next);
    });

    // app.use('/dist/manifest.json', serveStatic({
    //     root: webappDistFolder,
    //     path: '/manifest.json',
    //     getContent: async (path, c) => {
    //         return serveFile('manifest.json', 'application/json', c);
    //     }
    // }));

    // OTEL traces route
    app.post('/v1/traces', async (c) => {
        const otelHost = process.env.OTEL_HOST;
        if (!otelHost) return c.json({message: 'No OTEL host set up via env var'});

        try {
            const response = await fetch(`${otelHost}/v1/traces`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(await c.req.json()),
                signal: AbortSignal.timeout(1000),
            });
            return c.text(await response.text());
        } catch {
            return c.json({message: 'Failed to contact OTEL host'});
        }
    });

    const nodeAppDependencies: NodeAppDependencies = {
        rpc: {
            remote: rpc,
            local: undefined,
        },
        storage: {
            remote: remoteKV,
            userAgent: userAgentStore,
        },
        injectEngine: (engine: Springboard) => {
            if (storedEngine) {
                throw new Error('Engine already injected');
            }

            storedEngine = engine;

            const registerServerModule: typeof serverRegistry['registerServerModule'] = (cb) => {
                cb(makeServerModuleAPI());
            };

            const registeredServerModuleCallbacks = (serverRegistry.registerServerModule as unknown as {calls: CapturedRegisterServerModuleCall[]}).calls || [];
            serverRegistry.registerServerModule = registerServerModule;

            for (const call of registeredServerModuleCallbacks) {
                call(makeServerModuleAPI());
            }

            // Catch-all route for SPA
            app.use('*', serveStatic({
                root: webappDistFolder,
                path: 'index.html',
                getContent: async (path, c) => {
                    return serveIndexWithMetadata(c);
                },
                onFound: (path, c) => {
                    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
                    c.header('Pragma', 'no-cache');
                    c.header('Expires', '0');
                },
            }));
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

    return {app, injectWebSocket, nodeAppDependencies};
};

type ServerModuleCallback = (server: ServerModuleAPI) => void;

type CapturedRegisterServerModuleCall = ServerModuleCallback;
