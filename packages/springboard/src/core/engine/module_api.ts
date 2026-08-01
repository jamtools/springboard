import {ExtraModuleDependencies, Module} from '../module_registry/module_registry.js';
import {CoreDependencies, ModuleDependencies} from '../types/module_types.js';
import {ServerAPI} from './server_api.js';
import {SharedAPI} from './shared_api.js';
import {UserAgentAPI} from './user_agent_api.js';
import {ClientAPI} from './client_api.js';
import {UIAPI} from './ui_api.js';

type ActionConfigOptions = object;

export type ActionCallOptions = {
    mode?: 'local' | 'remote';
}

/**
 * Results from RPC middleware that can be passed to action callbacks.
 * Extend this interface to add custom middleware results.
 */
export interface RpcMiddlewareResults {
    [key: string]: unknown;
}

/**
 * The Action callback.
 * The optional second parameter provides middleware results when the action runs on the server.
 */
export type ActionCallback<Args extends undefined | object, ReturnValue extends Promise<any> = Promise<any>> = (args: Args, middlewareResults?: RpcMiddlewareResults) => ReturnValue;

// Helper to get middleware results from async local storage (when available).
// This is platform-specific: on Node.js it uses AsyncLocalStorage, on browser it returns undefined.
let getRpcMiddlewareResults: () => RpcMiddlewareResults | undefined = () => undefined;

// Allow platforms to register their async local storage getter.
export const setRpcMiddlewareResultsGetter = (getter: () => RpcMiddlewareResults | undefined) => {
    getRpcMiddlewareResults = getter;
};

type ModuleOptions = {
    rpcMode?: 'remote' | 'local';
}

/**
 * Internal APIs that are discouraged for general use.
 * These are exposed for advanced use cases and framework internals.
 */
export class ModuleAPIInternal {
    private destroyCallbacks: Function[] = [];

    constructor(
        public readonly module: Module,
        private prefix: string,
        public readonly coreDeps: CoreDependencies,
        public readonly modDeps: ModuleDependencies,
        extraDeps: ExtraModuleDependencies,
        private options: ModuleOptions
    ) {
        this.deps = {core: coreDeps, module: modDeps, extra: extraDeps};
        this.moduleId = module.moduleId;
        this.fullPrefix = `${prefix}|module|${module.moduleId}`;
    }

    public readonly moduleId: string;
    public readonly fullPrefix: string;

    /**
     * Dependencies for this module (core framework deps and module-specific deps).
     */
    public readonly deps: {core: CoreDependencies; module: ModuleDependencies, extra: ExtraModuleDependencies};

    public onDestroy = (cb: Function) => {
        this.destroyCallbacks.push(cb);
    };

    public destroy = () => {
        for (const cb of this.destroyCallbacks) {
            try {
                cb();
            } catch (e) {
                console.error('destroy callback failed', e);
            }
        }
    };

    setRpcMode = (mode: 'remote' | 'local') => {
        this.options.rpcMode = mode;
    };

    /**
     * Create an action to be run on either the same device or remote device.
     */
    createAction = <
        Options extends ActionConfigOptions,
        Args extends undefined | object,
        ReturnValue extends Promise<undefined | void | null | object | number>
    >(
        actionName: string,
        options: Options,
        cb: undefined extends Args ? ActionCallback<Args, ReturnValue> : ActionCallback<Args, ReturnValue>
    ): undefined extends Args ? ((args?: Args, options?: ActionCallOptions) => ReturnValue) : ((args: Args, options?: ActionCallOptions) => ReturnValue) => {
        const fullActionName = `${this.fullPrefix}|action|${actionName}`;
        const registeredCb = (args: Args, middlewareResults?: unknown) => cb(args, middlewareResults as RpcMiddlewareResults | undefined);

        if (this.coreDeps.rpc.remote.role === 'server') {
            this.coreDeps.rpc.remote.registerRpc(fullActionName, registeredCb);
        }

        if (this.coreDeps.rpc.local?.role === 'server') {
            this.coreDeps.rpc.local.registerRpc(fullActionName, registeredCb);
        }

        return (async (args: Args, options?: ActionCallOptions): Promise<Awaited<ReturnValue>> => {
            try {
                let rpc = this.coreDeps.rpc.remote;

                if (this.coreDeps.isMaestro() || this.options.rpcMode === 'local' || options?.mode === 'local') {
                    if (!this.coreDeps.rpc.local || this.coreDeps.rpc.local.role !== 'client') {
                        return await cb(args, getRpcMiddlewareResults());
                    }

                    rpc = this.coreDeps.rpc.local;
                }

                const result = await rpc.callRpc<Args, ReturnValue>(fullActionName, args);
                if (typeof result === 'string') { // TODO: make this not think a string is an error
                    this.coreDeps.showError(result);
                    throw new Error(result);
                }

                return result;
            } catch (e) {
                const errorMessage = `Error running action '${fullActionName}': ${new String(e)}`;
                this.coreDeps.showError(errorMessage);

                throw e;
            }
        }) as unknown as undefined extends Args ? (args?: Args, options?: ActionCallOptions) => ReturnValue : (args: Args, options?: ActionCallOptions) => ReturnValue;
    };
}

/**
 * The API provided in the callback when calling `registerModule`.
 */
export class ModuleAPI {
    /**
     * Internal APIs - discouraged for general use.
     * Use the public namespaced APIs instead (server, shared, userAgent, client, ui).
     */
    public readonly internal: ModuleAPIInternal;

    constructor(module: Module, prefix: string, coreDeps: CoreDependencies, modDeps: ModuleDependencies, extraDeps: ExtraModuleDependencies, options: ModuleOptions) {
        this.internal = new ModuleAPIInternal(module, prefix, coreDeps, modDeps, extraDeps, options);

        this.server = new ServerAPI(
            this.internal.fullPrefix,
            this.internal.coreDeps,
            this.internal.modDeps,
            this.internal.createAction.bind(this.internal),
            this.internal.onDestroy
        );

        this.shared = new SharedAPI(
            this.internal.fullPrefix,
            this.internal.coreDeps,
            this.internal.modDeps,
            this.internal.createAction.bind(this.internal),
            this.internal.onDestroy
        );

        this.userAgent = new UserAgentAPI(
            this.internal.fullPrefix,
            this.internal.coreDeps,
            this.internal.modDeps,
            this.internal.createAction.bind(this.internal),
            this.internal.onDestroy
        );

        this.client = new ClientAPI(
            this.internal.createAction.bind(this.internal)
        );

        this.ui = new UIAPI(
            this.internal.module,
            this.internal.modDeps
        );

        this.getModule = this.internal.modDeps.moduleRegistry.getModule.bind(this.internal.modDeps.moduleRegistry);
    }

    /**
     * Server-only states and actions (stripped from client builds).
     */
    public readonly server: ServerAPI;

    /**
     * Shared states and actions (synced across clients/server).
     */
    public readonly shared: SharedAPI;

    /**
     * User agent (device-local) states and actions.
     */
    public readonly userAgent: UserAgentAPI;

    /**
     * Client actions that server can invoke.
     */
    public readonly client: ClientAPI;

    /**
     * UI-related methods (routes, application shell, providers).
     */
    public readonly ui: UIAPI;

    /**
     * Get another module by its ID.
     */
    getModule: typeof this.internal.modDeps.moduleRegistry.getModule;
}
