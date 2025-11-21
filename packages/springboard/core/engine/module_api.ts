import {ServerStateSupervisor, SharedStateSupervisor, StateSupervisor, UserAgentStateSupervisor} from '../services/states/shared_state_service';
import {ExtraModuleDependencies, Module, NavigationItemConfig, RegisteredRoute} from 'springboard/module_registry/module_registry';
import {CoreDependencies, ModuleDependencies} from '../types/module_types';
import {RegisterRouteOptions} from './register';
import {ServerAPI} from './server_api';
import {SharedAPI} from './shared_api';
import {UserAgentAPI} from './user_agent_api';
import {ClientAPI} from './client_api';
import {UIAPI} from './ui_api';

type ActionConfigOptions = object;

export type ActionCallOptions = {
    mode?: 'local' | 'remote';
}

/**
 * The Action callback
*/
export type ActionCallback<Args extends undefined | object, ReturnValue extends Promise<any> = Promise<any>> = (args: Args, options?: ActionCallOptions) => ReturnValue;

// this would make it so modules/plugins can extend the module API dynamically through interface merging
// export interface ModuleAPI {

// }

// export class ModuleAPIImpl {

// }

type ModuleOptions = {
    rpcMode?: 'remote' | 'local';
}

/**
 * The API provided in the callback when calling `registerModule`. The ModuleAPI is the entrypoint in the framework for everything pertaining to creating a module.
*/
export class ModuleAPI {
    private destroyCallbacks: Function[] = [];

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

    constructor(private module: Module, private prefix: string, private coreDeps: CoreDependencies, private modDeps: ModuleDependencies, extraDeps: ExtraModuleDependencies, private options: ModuleOptions) {
        // Store deps for backwards compatibility
        this.deps = {core: coreDeps, module: modDeps, extra: extraDeps};

        // Initialize namespace APIs
        this.server = new ServerAPI(
            this.fullPrefix,
            this.coreDeps,
            this.modDeps,
            this.createAction.bind(this),
            this.onDestroy
        );

        this.shared = new SharedAPI(
            this.fullPrefix,
            this.coreDeps,
            this.modDeps,
            this.createAction.bind(this),
            this.onDestroy
        );

        this.userAgent = new UserAgentAPI(
            this.fullPrefix,
            this.coreDeps,
            this.modDeps,
            this.createAction.bind(this),
            this.onDestroy
        );

        this.client = new ClientAPI(
            this.createAction.bind(this)
        );

        this.ui = new UIAPI(
            this.module,
            this.modDeps
        );
    }

    public readonly moduleId = this.module.moduleId;

    public readonly fullPrefix = `${this.prefix}|module|${this.module.moduleId}`;

    /**
     * Dependencies for this module (core framework deps and module-specific deps).
     */
    public readonly deps: {core: CoreDependencies; module: ModuleDependencies, extra: ExtraModuleDependencies};

    /**
     * Server-only states and actions (stripped from client builds).
     *
     * @see {@link ServerAPI}
     */
    public readonly server: ServerAPI;

    /**
     * Shared states and actions (synced across all clients).
     *
     * @see {@link SharedAPI}
     */
    public readonly shared: SharedAPI;

    /**
     * User agent (device-local) states and actions.
     *
     * @see {@link UserAgentAPI}
     */
    public readonly userAgent: UserAgentAPI;

    /**
     * Client actions that server can invoke (server→client RPC).
     *
     * @see {@link ClientAPI}
     */
    public readonly client: ClientAPI;

    /**
     * UI-related methods (routes, application shell, providers).
     *
     * @see {@link UIAPI}
     */
    public readonly ui: UIAPI;

    /**
     * Get another module by its ID.
     *
     * @example
     * ```typescript
     * const macroModule = moduleAPI.getModule('midi_macro');
     * ```
     */
    getModule = this.modDeps.moduleRegistry.getModule.bind(this.modDeps.moduleRegistry);

    /**
     * Register a route with the application's React Router.
     *
     * @deprecated Use `moduleAPI.ui.registerRoute()` instead.
     *
     * @see {@link UIAPI.registerRoute}
     */
    registerRoute = (routePath: string, options: RegisterRouteOptions, component: RegisteredRoute['component']) => {
        this.ui.registerRoute(routePath, options, component);
    };

    /**
     * Register an application shell component.
     *
     * @deprecated Use `moduleAPI.ui.registerApplicationShell()` instead.
     *
     * @see {@link UIAPI.registerApplicationShell}
     */
    registerApplicationShell = (component: React.ElementType<React.PropsWithChildren<{modules: Module[]}>>) => {
        this.ui.registerApplicationShell(component);
    };

    /**
     * @deprecated Use `moduleAPI.shared.createSharedStates()` instead.
     */
    createSharedStates = async <States extends Record<string, any>>(states: States): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
        return this.shared.createSharedStates(states);
    };

    /**
     * @deprecated Use `moduleAPI.shared.createSharedStates()` instead.
     */
    createStates = this.createSharedStates;

    /**
     * @deprecated Use `moduleAPI.server.createServerStates()` instead.
     */
    createServerStates = async <States extends Record<string, any>>(states: States): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
        return this.server.createServerStates(states);
    };

    /**
     * @deprecated Use `moduleAPI.userAgent.createUserAgentStates()` instead.
     */
    createUserAgentStates = async <States extends Record<string, any>>(states: States): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
        return this.userAgent.createUserAgentStates(states);
    };

    /**
     * @deprecated Use `moduleAPI.shared.createSharedActions()` instead.
     */
    createActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): { [K in keyof Actions]: undefined extends Parameters<Actions[K]>[0] ? ((payload?: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) : ((payload: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) } => {
        const keys = Object.keys(actions);

        for (const key of keys) {
            (actions[key] as ActionCallback<any, any>) = this.createAction(key, {}, actions[key]);
        }

        return actions;
    };

    /**
     * @deprecated Use `moduleAPI.server.createServerAction()` instead.
     */
    createServerAction = <
        Options extends ActionConfigOptions,
        Args extends undefined | object,
        ReturnValue extends Promise<undefined | void | null | object | number>
    >(
        actionName: string,
        options: Options,
        cb: undefined extends Args ? ActionCallback<Args, ReturnValue> : ActionCallback<Args, ReturnValue>
    ): undefined extends Args ? ((args?: Args, options?: ActionCallOptions) => ReturnValue) : ((args: Args, options?: ActionCallOptions) => ReturnValue) => {
        return this.createAction(actionName, options, cb);
    };

    /**
     * @deprecated Use `moduleAPI.server.createServerActions()` instead.
     */
    createServerActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): { [K in keyof Actions]: undefined extends Parameters<Actions[K]>[0] ? ((payload?: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) : ((payload: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) } => {
        return this.createActions(actions);
    };

    setRpcMode = (mode: 'remote' | 'local') => {
        this.options.rpcMode = mode;
    };

    /**
     * Create an action to be run on either the same device or remote device. If the produced action is called from the same device, the framework just calls the provided callback. If it is called from another device, the framework calls the action via RPC to the remote device. In most cases, any main logic or calls to shared state changes should be done in an action.
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

        if (this.coreDeps.rpc.remote.role === 'server') {
            this.coreDeps.rpc.remote.registerRpc(fullActionName, cb);
        }

        if (this.coreDeps.rpc.local?.role === 'server') {
            this.coreDeps.rpc.local.registerRpc(fullActionName, cb);
        }

        return (async (args: Args, options?: ActionCallOptions): Promise<Awaited<ReturnValue>> => {
            try {
                let rpc = this.coreDeps.rpc.remote;

                // if (options?.mode === 'local' || rpc.role === 'server') { // TODO: get rid of isMaestro and do something like this instead

                if (this.coreDeps.isMaestro() || this.options.rpcMode === 'local' || options?.mode === 'local') {
                    if (!this.coreDeps.rpc.local || this.coreDeps.rpc.local.role !== 'client') {
                        return await cb(args);
                    }

                    rpc = this.coreDeps.rpc.local!;
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
 * The States API is used for creating shared, persistent, and user-scoped states.
*/
export class StatesAPI {
    private destroyCallbacks: Function[] = [];

    public onDestroy = (cb: Function) => {
        this.destroyCallbacks.push(cb);
    };

    public destroy = () => {
        for (const cb of this.destroyCallbacks) {
            try {
                cb();
            } catch (e) {
                console.error('destroy callback failed in StatesAPI', e);
            }
        }
    };

    constructor(private prefix: string, private coreDeps: CoreDependencies, private modDeps: ModuleDependencies) {

    }

    /**
     * Create a piece of state to be saved in persistent storage such as a database or localStorage.
     * If the deployment is multi-player, then this data is shared between all connected devices.
     * This is the primary method for creating shared state that persists and syncs across clients.
    */
    public createSharedState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
        const fullKey = `${this.prefix}|state.shared|${stateName}`;

        const cachedValue = this.modDeps.services.remoteSharedStateService.getCachedValue(fullKey) as State | undefined;
        if (cachedValue !== undefined) {
            initialValue = cachedValue;
        } else {
            const storedValue = await this.coreDeps.storage.shared.get<State>(fullKey);
            if (storedValue !== null && storedValue !== undefined) { // this should really only use undefined for a signal
                initialValue = storedValue;
            } else if (this.coreDeps.isMaestro()) {
                await this.coreDeps.storage.shared.set<State>(fullKey, initialValue);
            }
        }

        const supervisor = new SharedStateSupervisor(fullKey, initialValue, this.modDeps.services.remoteSharedStateService);

        const sub = supervisor.subjectForKVStorePublish.subscribe(async value => {
            await this.coreDeps.storage.shared.set(fullKey, value);
        });
        this.onDestroy(sub.unsubscribe);

        return supervisor;
    };

    /**
     * @deprecated Use createSharedState instead. This is an alias for backwards compatibility.
    */
    public createPersistentState = this.createSharedState;

    /**
     * Create a piece of state to be saved on the given user agent. In the browser's case, this will use `localStorage`
    */
    public createUserAgentState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
        const fullKey = `${this.prefix}|state.useragent|${stateName}`;
        if (this.modDeps.services.localSharedStateService) {
            const cachedValue = this.modDeps.services.localSharedStateService.getCachedValue(fullKey) as State | undefined;
            if (cachedValue !== undefined) {
                initialValue = cachedValue;
            } else {
                const storedValue = await this.coreDeps.storage.userAgent.get<State>(fullKey);
                if (storedValue !== null && storedValue !== undefined) { // this should really only use undefined for a signal
                    initialValue = storedValue;
                }
            }
        }

        const supervisor = new SharedStateSupervisor(fullKey, initialValue, this.modDeps.services.localSharedStateService);

        const sub = supervisor.subjectForKVStorePublish.subscribe(async value => {
            await this.coreDeps.storage.userAgent.set(fullKey, value);
        });
        this.onDestroy(sub.unsubscribe);

        return supervisor;
    };

    /**
     * Create a piece of server-only state that is saved in persistent storage but is NOT synced to clients.
     * This is useful for sensitive server-side data that should never be exposed to the client.
     * The state is still persisted to the server storage (database/etc), but changes are not broadcast via RPC.
    */
    public createServerState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
        const fullKey = `${this.prefix}|state.server|${stateName}`;

        // Check cache first (populated during serverStateService.initialize())
        const cachedValue = this.modDeps.services.serverStateService.getCachedValue(fullKey) as State | undefined;
        if (cachedValue !== undefined) {
            initialValue = cachedValue;
        } else {
            const storedValue = await this.coreDeps.storage.server.get<State>(fullKey);
            if (storedValue !== null && storedValue !== undefined) {
                initialValue = storedValue;
            } else if (this.coreDeps.isMaestro()) {
                await this.coreDeps.storage.server.set<State>(fullKey, initialValue);
            }
        }

        const supervisor = new ServerStateSupervisor(fullKey, initialValue);

        // Subscribe to persist changes to storage, but do not broadcast to clients
        const sub = supervisor.subjectForKVStorePublish.subscribe(async value => {
            await this.coreDeps.storage.server.set(fullKey, value);
        });
        this.onDestroy(sub.unsubscribe);

        return supervisor;
    };

    /**
     * Create multiple server-only states at once. Convenience method for batch creation.
     * Each state is saved in persistent storage but is not synced to clients.
    */
    public createServerStates = async <States extends Record<string, any>>(states: States): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
        const keys = Object.keys(states);
        const promises = keys.map(async key => {
            return {
                state: await this.createServerState(key, states[key]),
                key,
            };
        });

        const result = {} as {[K in keyof States]: StateSupervisor<States[K]>};

        const supervisors = await Promise.all(promises);
        for (const key of keys) {
            (result[key] as StateSupervisor<States[keyof States]>) = supervisors.find(s => s.key === key as any)!.state;
        }

        return result;
    };
}
