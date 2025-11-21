import {ServerStateSupervisor, StateSupervisor} from '../services/states/shared_state_service';
import {CoreDependencies, ModuleDependencies} from '../types/module_types';
import type {ActionCallback, ActionCallOptions} from './module_api';

type ActionConfigOptions = object;

/**
 * Server API - Methods for creating server-only states and actions.
 *
 * **Security:** All server states and action implementations are stripped from client builds.
 *
 * **Visibility:** The `server` namespace makes it obvious during code review that
 * this code contains sensitive logic that should never reach the client.
 */
export class ServerAPI {
    constructor(
        private prefix: string,
        private coreDeps: CoreDependencies,
        private modDeps: ModuleDependencies,
        private createActionFn: <
            Options extends ActionConfigOptions,
            Args extends undefined | object,
            ReturnValue extends Promise<undefined | void | null | object | number>
        >(
            actionName: string,
            options: Options,
            cb: undefined extends Args ? ActionCallback<Args, ReturnValue> : ActionCallback<Args, ReturnValue>
        ) => undefined extends Args ? ((args?: Args, options?: ActionCallOptions) => ReturnValue) : ((args: Args, options?: ActionCallOptions) => ReturnValue),
        private onDestroyFn: (cb: Function) => void
    ) {}

    /**
     * Create server-only states that are never synced to clients.
     *
     * **Security:** State values are only accessible server-side. In client builds,
     * the entire variable declaration is removed by the compiler.
     *
     * **Storage:** Persisted to server storage (database/filesystem).
     *
     * **Sync:** Never synced to clients. Use `shared.createSharedStates()` for synced state.
     *
     * **Build:** Entire variable declarations are removed from client builds by detecting
     * the method name `createServerStates`.
     *
     * @example
     * ```typescript
     * const serverStates = await moduleAPI.server.createServerStates({
     *   apiKey: process.env.STRIPE_KEY,
     *   dbPassword: process.env.DB_PASSWORD,
     *   internalCache: {lastSync: Date.now()}
     * });
     *
     * // In server action
     * const key = serverStates.apiKey.getState();
     * ```
     *
     * @see {@link https://docs.springboard.dev/server-states | Server States Guide}
     */
    createServerStates = async <States extends Record<string, any>>(
        states: States
    ): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
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

    /**
     * Create a single server-only state.
     *
     * @see {@link createServerStates} for batch creation (recommended).
     */
    private createServerState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
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
        this.onDestroyFn(sub.unsubscribe);

        return supervisor;
    };

    /**
     * Create multiple server-only actions that run exclusively on the server.
     *
     * **Security:** In client builds, the action implementations are stripped out,
     * leaving only the RPC call structure. The method name `createServerActions`
     * is detected by the compiler.
     *
     * **Usage:** Server actions can access server states and perform sensitive operations.
     *
     * @example
     * ```typescript
     * const serverActions = moduleAPI.server.createServerActions({
     *   authenticate: async (args: {username: string, password: string}) => {
     *     const session = serverStates.sessions.getState();
     *     // Validate credentials
     *     return {authenticated: true, token: generateToken()};
     *   },
     *
     *   processPayment: async (args: {amount: number, customerId: string}) => {
     *     const apiKey = serverStates.apiKey.getState();
     *     // Process payment with API key
     *     return {success: true, transactionId: '...'};
     *   }
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/server-actions | Server Actions Guide}
     */
    createServerActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): { [K in keyof Actions]: undefined extends Parameters<Actions[K]>[0] ? ((payload?: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) : ((payload: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) } => {
        const keys = Object.keys(actions);

        for (const key of keys) {
            (actions[key] as ActionCallback<any, any>) = this.createActionFn(key, {}, actions[key]);
        }

        return actions;
    };

    /**
     * Create a single server-only action.
     *
     * @see {@link createServerActions} for batch creation (recommended).
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
        return this.createActionFn(actionName, options, cb);
    };
}
