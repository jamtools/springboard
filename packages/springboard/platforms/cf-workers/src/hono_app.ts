import {Hono} from 'hono';
import {cors} from 'hono/cors';

import {ServerJsonRpcClientAndServer} from 'springboard-server/src/services/server_json_rpc';
// import {NodeLocalJsonRpcClientAndServer} from '@springboardjs/platforms-node/services/node_local_json_rpc';

import {Springboard} from 'springboard/engine/engine';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';

import {RpcMiddleware, ServerModuleAPI, serverRegistry} from 'springboard-server/src/register';
import {SharedJsonRpcServer} from './services/rpc_server';
import {CfWorkerKVStore} from './services/kv_store';

export interface RoomLike {
    storage: {
        get: (key: string) => Promise<unknown>;
        put: (key: string, value: unknown) => Promise<void>;
        list: (options?: { limit?: number }) => Promise<Map<string, unknown>>;
    };
    broadcast: (message: string) => void;
}

export type SharedKvForHttp = {
    get: (key: string) => Promise<unknown>;
    getAll: () => Promise<Record<string, unknown>>;
    set: (key: string, value: unknown) => Promise<void>;
}

import {CoreDependencies} from 'springboard/types/module_types';

export type ServerAppDependencies = Pick<CoreDependencies, 'rpc' | 'storage'> & Partial<CoreDependencies> & {
    injectEngine: (engine: Springboard) => void;
};

type InitAppReturnValue = {
    app: Hono;
    serverAppDependencies: ServerAppDependencies;
    rpcService: SharedJsonRpcServer;
};

type InitArgs = {
    kvForHttp: SharedKvForHttp;
    room: RoomLike;
}

export const initApp = (coreDeps: InitArgs): InitAppReturnValue => {
    const rpcMiddlewares: RpcMiddleware[] = [];

    const app = new Hono();

    app.use('*', cors());

    app.get('/', async c => {
        // TODO: implement per-party index.html here
        return new Response('Root route of the party! Welcome!');
    });

    app.get('/kv/get', async (c) => {
        const key = c.req.param('key');

        if (!key) {
            return c.json({error: 'No key provided'}, 400);
        }

        const value = await coreDeps.kvForHttp.get(key);

        return c.json(value || null);
    });

    app.post('/kv/set', async (c) => {
        return c.text('kv set operation not supported on this platform', 400);
    });

    app.get('/kv/get-all', async (c) => {
        const all = await coreDeps.kvForHttp.getAll();
        return c.json(all);
    });

    app.post('/rpc/*', async (c) => {
        const body = await c.req.text();
        c.header('Content-Type', 'application/json');

        const rpcResponse = await rpcService.processRequestWithMiddleware(body, c);
        if (rpcResponse) {
            return c.text(rpcResponse);
        }

        return c.text(JSON.stringify({
            error: 'No response',
        }), 500);
    });

    const rpc = new ServerJsonRpcClientAndServer({
        broadcastMessage: (message) => {
            return rpcService.broadcastMessage(message);
        },
    });

    const rpcService = new SharedJsonRpcServer({
        processRequest: async (message, middlewareResult: unknown) => {
            return rpc!.processRequest(message, middlewareResult);
        },
        rpcMiddlewares,
    }, coreDeps.room);

    const mockDeps = makeMockCoreDependencies({store: {}});

    const kvStore = new CfWorkerKVStore(coreDeps.room, coreDeps.kvForHttp);

    let storedEngine: Springboard | undefined;

    const serverAppDependencies: ServerAppDependencies = {
        rpc: {
            remote: rpc,
        },
        storage: {
            remote: kvStore,
            userAgent: mockDeps.storage.userAgent,
        },
        injectEngine: (engine) => {
            if (storedEngine) {
                throw new Error('Engine already injected');
            }

            storedEngine = engine;
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

    const registerServerModule: typeof serverRegistry['registerServerModule'] = (cb) => {
        cb(makeServerModuleAPI());
    };

    const registeredServerModuleCallbacks = (serverRegistry.registerServerModule as unknown as {calls: CapturedRegisterServerModuleCall[]}).calls || [];
    serverRegistry.registerServerModule = registerServerModule;

    for (const call of registeredServerModuleCallbacks) {
        call(makeServerModuleAPI());
    }

    return {app, serverAppDependencies: serverAppDependencies, rpcService};
};

type ServerModuleCallback = (server: ServerModuleAPI) => void;

type CapturedRegisterServerModuleCall = ServerModuleCallback;
