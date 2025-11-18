import {Hono} from 'hono';
import {cors} from 'hono/cors';

import {NodeAppDependencies} from '@springboardjs/platforms-node/entrypoints/main';
import {NodeLocalJsonRpcClientAndServer} from '@springboardjs/platforms-node/services/node_local_json_rpc';

import {Springboard} from 'springboard/engine/engine';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';

import {RpcMiddleware, ServerModuleAPI, serverRegistry} from 'springboard-server/src/register';
import {PartykitJsonRpcServer} from './services/partykit_rpc_server';
import {Room} from 'partykit/server';
import {PartykitKVStore} from './services/partykit_kv_store';

export type PartykitKvForHttp = {
    get: (key: string) => Promise<unknown>;
    getAll: () => Promise<Record<string, unknown>>;
    set: (key: string, value: unknown) => Promise<void>;
}

type InitAppReturnValue = {
    app: Hono;
    nodeAppDependencies: NodeAppDependencies;
    rpcService: PartykitJsonRpcServer;
};

type InitArgs = {
    kvForHttp: PartykitKvForHttp;
    room: Room;
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

    const rpc = new NodeLocalJsonRpcClientAndServer({
        broadcastMessage: (message) => {
            return rpcService.broadcastMessage(message);
        },
    });

    const rpcService = new PartykitJsonRpcServer({
        processRequest: async (message) => {
            return rpc!.processRequest(message);
        },
        rpcMiddlewares,
    }, coreDeps.room);

    const mockDeps = makeMockCoreDependencies({store: {}});

    const kvStore = new PartykitKVStore(coreDeps.room, coreDeps.kvForHttp);

    let storedEngine: Springboard | undefined;

    const nodeAppDependencies: NodeAppDependencies = {
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

    return {app, nodeAppDependencies, rpcService};
};

type ServerModuleCallback = (server: ServerModuleAPI) => void;

type CapturedRegisterServerModuleCall = ServerModuleCallback;
