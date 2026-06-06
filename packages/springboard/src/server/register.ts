import type {Context, Hono} from 'hono';
import type {Springboard} from '../core/index.js';

export type ServerModuleAPI = {
    hono: Hono;
    hooks: ServerHooks;
    getEngine: () => Springboard;
}

export type ServerModuleCallback = (server: ServerModuleAPI) => void;

type CapturedRegisterServerModuleCall = ServerModuleCallback;

const getRegisterServerModuleCalls = (): CapturedRegisterServerModuleCall[] => {
    const store = registerServerModule as unknown as {
        calls?: CapturedRegisterServerModuleCall[];
    };
    return store.calls ? [...store.calls] : [];
};

const setRegisterServerModuleCalls = (calls: CapturedRegisterServerModuleCall[]): void => {
    const store = registerServerModule as unknown as {
        calls?: CapturedRegisterServerModuleCall[];
    };
    store.calls = calls;
};

const registerServerModule = (
    cb: ServerModuleCallback,
) => {
    const calls = getRegisterServerModuleCalls();
    calls.push(cb);
    setRegisterServerModuleCalls(calls);
};

export type ServerModuleRegistry = {
    /**
     * Register server routes and server-scoped hooks.
     *
     * Server modules may attach route handlers and RPC middleware, but should
     * not replace global Hono fallback behavior such as `notFound()`.
     * Development mode relies on the framework-owned fallback remaining intact
     * so browser requests can fall through to Vite when no server route matches.
     */
    registerServerModule: (
        cb: ServerModuleCallback,
    ) => void;
}

export const serverRegistry: ServerModuleRegistry = {
    registerServerModule,
};

export const clearRegisteredServerModules = (): void => {
    setRegisterServerModuleCalls([]);
};

export const resetServerRegistry = (): void => {
    clearRegisteredServerModules();
    serverRegistry.registerServerModule = registerServerModule;
};

export type RpcMiddleware = (c: Context) => Promise<object>;

type ServerHooks = {
    registerRpcMiddleware: (cb: RpcMiddleware) => void;
};
