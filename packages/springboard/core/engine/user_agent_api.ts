import {SharedStateSupervisor, StateSupervisor} from '../services/states/shared_state_service';
import {CoreDependencies, ModuleDependencies} from '../types/module_types';
import type {ActionCallback, ActionCallOptions} from './module_api';

type ActionConfigOptions = object;

/**
 * UserAgent API - Methods for creating device-local states and actions.
 *
 * **Storage:** Stored on the device (browser localStorage, React Native AsyncStorage, etc.)
 *
 * **Scope:** Each device has its own independent copy. Not synchronized across devices.
 *
 * **React Native:** Runs in the React Native process, not the WebView process.
 */
export class UserAgentAPI {
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
     * Create user agent states that are stored locally on the device.
     *
     * **Storage:** Browser localStorage, React Native AsyncStorage, or equivalent.
     *
     * **Sync:** Not synchronized across devices. Each device maintains its own copy.
     *
     * **Persistence:** Survives app restarts. Data is tied to the device, not the user account.
     *
     * **Use Cases:** User preferences, UI state, local cache, device-specific settings.
     *
     * **React Native:** Stored in the React Native process, not the WebView.
     *
     * @example
     * ```typescript
     * const userAgentStates = await moduleAPI.userAgent.createUserAgentStates({
     *   theme: 'dark',
     *   sidebarCollapsed: false,
     *   lastViewedPage: '/dashboard',
     *   volume: 0.8
     * });
     *
     * // Update locally
     * userAgentStates.theme.setState('light');
     *
     * // Use in React
     * const theme = userAgentStates.theme.useState();
     * ```
     *
     * @see {@link https://docs.springboard.dev/useragent-states | UserAgent States Guide}
     */
    createUserAgentStates = async <States extends Record<string, any>>(
        states: States
    ): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
        const keys = Object.keys(states);
        const promises = keys.map(async key => {
            return {
                state: await this.createUserAgentState(key, states[key]),
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
     * Create a single user agent state.
     *
     * @see {@link createUserAgentStates} for batch creation (recommended).
     */
    private createUserAgentState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
        const fullKey = `${this.prefix}|state.useragent|${stateName}`;

        if (this.modDeps.services.localSharedStateService) {
            const cachedValue = this.modDeps.services.localSharedStateService.getCachedValue(fullKey) as State | undefined;
            if (cachedValue !== undefined) {
                initialValue = cachedValue;
            } else {
                const storedValue = await this.coreDeps.storage.userAgent.get<State>(fullKey);
                if (storedValue !== null && storedValue !== undefined) {
                    initialValue = storedValue;
                }
            }
        }

        const supervisor = new SharedStateSupervisor(fullKey, initialValue, this.modDeps.services.localSharedStateService);

        const sub = supervisor.subjectForKVStorePublish.subscribe(async value => {
            await this.coreDeps.storage.userAgent.set(fullKey, value);
        });
        this.onDestroyFn(sub.unsubscribe);

        // Warn if accessed on server (rarely needed)
        if (this.coreDeps.isMaestro && this.coreDeps.isMaestro()) {
            const originalGetState = supervisor.getState.bind(supervisor);
            supervisor.getState = () => {
                console.warn(
                    `UserAgent state '${stateName}' accessed on server. This is rarely needed.\n` +
                    'Consider using server state, or check springboard.isPlatform(\'client\') before accessing.'
                );
                return originalGetState();
            };
        }

        return supervisor;
    };

    /**
     * Create user agent actions that run on the device.
     *
     * **Execution:** Runs locally on the device. In React Native, runs in the RN process
     * (not the WebView).
     *
     * **Use Cases:** Device-specific operations, local UI updates, accessing device APIs.
     *
     * **React Native:** Call native modules, access device features (camera, vibration, etc.)
     *
     * @example
     * ```typescript
     * const userAgentActions = moduleAPI.userAgent.createUserAgentActions({
     *   vibrate: async (args: {duration: number}) => {
     *     // React Native - runs in RN process
     *     Vibration.vibrate(args.duration);
     *   },
     *
     *   updateLocalPreference: async (args: {key: string, value: any}) => {
     *     userAgentStates[args.key].setState(args.value);
     *   }
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/useragent-actions | UserAgent Actions Guide}
     */
    createUserAgentActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): { [K in keyof Actions]: undefined extends Parameters<Actions[K]>[0] ? ((payload?: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) : ((payload: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) } => {
        const keys = Object.keys(actions);

        for (const key of keys) {
            (actions[key] as ActionCallback<any, any>) = this.createActionFn(key, {}, actions[key]);
        }

        return actions;
    };

    /**
     * Create a single user agent action.
     *
     * @see {@link createUserAgentActions} for batch creation (recommended).
     */
    createUserAgentAction = <
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
