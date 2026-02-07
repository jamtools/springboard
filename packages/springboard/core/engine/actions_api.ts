import type {ActionCallback, ActionCallOptions, ActionFnFromCallback} from './module_api';

type ActionConfigOptions = object;

/**
 * Actions API - Methods for creating hybrid actions.
 *
 * **Execution:** By default, hybrid actions run on the server via RPC. If called from the server
 * or with `{mode: 'local'}`, the action runs locally.
 *
 * **Use Cases:** Business logic, state updates, validation, data fetching.
 */
export class ActionsAPI {
    constructor(
        private createActionFn: <
            Options extends ActionConfigOptions,
            Args extends undefined | object,
            ReturnValue extends Promise<undefined | void | null | object | number>
        >(
            actionName: string,
            options: Options,
            cb: undefined extends Args ? ActionCallback<Args, ReturnValue> : ActionCallback<Args, ReturnValue>
        ) => undefined extends Args ? ((args?: Args, options?: ActionCallOptions) => ReturnValue) : ((args: Args, options?: ActionCallOptions) => ReturnValue),
    ) {}

    /**
     * Create multiple hybrid actions.
     *
     * @example
     * ```typescript
     * const actions = moduleAPI.actions.createHybridActions({
     *   increment: async () => {
     *     const current = sharedStates.count.getState();
     *     sharedStates.count.setState(current + 1);
     *   },
     * });
     * ```
     */
    createHybridActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): {[K in keyof Actions]: ActionFnFromCallback<Actions[K]>} => {
        const keys = Object.keys(actions);

        for (const key of keys) {
            (actions[key] as ActionCallback<any, any>) = this.createActionFn(key, {}, actions[key]);
        }

        return actions as unknown as {[K in keyof Actions]: ActionFnFromCallback<Actions[K]>};
    };

    /**
     * Create a single hybrid action.
     *
     * @see {@link createHybridActions} for batch creation (recommended).
     */
    createHybridAction = <
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

