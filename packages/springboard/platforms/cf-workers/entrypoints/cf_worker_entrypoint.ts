import { Server, Connection, routePartykitRequest } from 'partyserver';

import {Hono} from 'hono';

import springboard from 'springboard';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';
import {Springboard} from 'springboard/engine/engine';
import {CoreDependencies, KVStore} from 'springboard/types/module_types';

import {initApp, SharedKvForHttp, ServerAppDependencies} from '../src/hono_app';

import {SharedJsonRpcServer} from '../src/services/rpc_server';

export class MyServer extends Server {
    private app!: Hono;
    private serverAppDependencies!: ServerAppDependencies;
    private springboardApp!: Springboard;
    private rpcService!: SharedJsonRpcServer;

    private kv: Record<string, string> = {};


    async onStart() {
        const roomAdapter = {
            storage: this.ctx.storage,
            broadcast: (message: string) => this.broadcast(message),
        };

        const {app, serverAppDependencies, rpcService} = initApp({
            kvForHttp: this.makeKvStoreForHttp(),
            room: roomAdapter,
        });

        this.app = app;
        this.serverAppDependencies = serverAppDependencies;
        this.rpcService = rpcService;

        springboard.reset();
        const values = await this.ctx.storage.list({
            limit: 100,
        });

        for (const [key, value] of values) {
            this.kv[key] = value as string;
        }

        this.springboardApp = await startSpringboardApp(this.serverAppDependencies);
    }


    async onRequest(req: Request) {
        const urlParts = new URL(req.url).pathname.split('/');
        const partyName = urlParts[2];
        const roomName = urlParts[3];

        const prefixToRemove = `/parties/${partyName}/${roomName}`;
        const newUrl = req.url.replace(prefixToRemove, '');


        const newReq = new Request(newUrl, req as any);
        return this.app.fetch(newReq);
    }

    async onMessage(connection: Connection, message: string) {
        await this.rpcService.onMessage(message, connection);
    }

    private makeKvStoreForHttp = (): SharedKvForHttp => {
        return {
            get: async (key: string) => {
                const value = this.kv[key];
                if (!value) {
                    return null;
                }

                return JSON.parse(value);
            },
            getAll: async () => {
                const allEntriesAsRecord: Record<string, any> = {};
                for (const key of Object.keys(this.kv)) {
                    allEntriesAsRecord[key] = JSON.parse(this.kv[key]);
                }

                return allEntriesAsRecord;
            },
            set: async (key: string, value: unknown) => {
                this.kv[key] = JSON.stringify(value);
            },
        };
    };
}

export const startSpringboardApp = async (deps: ServerAppDependencies): Promise<Springboard> => {
    const coreDeps: CoreDependencies = {
        log: console.log,
        showError: console.error,
        storage: deps.storage,
        isMaestro: () => true,
        rpc: deps.rpc,
    };

    Object.assign(coreDeps, deps);
    const engine = new Springboard(coreDeps, {});

    await engine.initialize();
    deps.injectEngine(engine);
    return engine;
};

export default {
    async fetch(request: Request, env: any) {
        const response = await routePartykitRequest(request, env);
        return response || new Response('Not Found', { status: 404 });
    }
};
