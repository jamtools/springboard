import type {ActionCallback, ActionCallOptions} from './module_api';

/**
 * Client API - Methods for creating client actions that the server can invoke.
 *
 * **Direction:** Server → Client RPC
 *
 * **Use Cases:** Push notifications, toast messages, UI updates, progress indicators.
 *
 * **Note:** This is for server-to-client calls. For client-to-server, use shared actions.
 */
export class ClientAPI {
    constructor(
        private createActionFn: <
            Args extends undefined | object,
            ReturnValue extends Promise<undefined | void | null | object | number>
        >(
            actionName: string,
            options: object,
            cb: undefined extends Args ? ActionCallback<Args, ReturnValue> : ActionCallback<Args, ReturnValue>
        ) => undefined extends Args ? ((args?: Args, options?: ActionCallOptions) => ReturnValue) : ((args: Args, options?: ActionCallOptions) => ReturnValue)
    ) {}

    /**
     * Create client actions that the server can invoke via RPC.
     *
     * **Pattern:** Server → Client communication
     *
     * **Timeout:** Default 5 seconds. Returns `{error: 'timed out'}` on timeout (does not throw).
     *
     * **Call Modes:**
     * - Specific user: `clientActions.toast({...}, userContext)`
     * - Broadcast to all: `clientActions.toast({...}, {mode: 'broadcast'})`
     * - Broadcast except current: `clientActions.toast({...}, {mode: 'broadcast_exclude_current_user', userContext})`
     * - Local (RN → WebView): `clientActions.toast({...}, {mode: 'local'})`
     *
     * **Idempotency:** Pass server-generated IDs to update existing UI elements
     *
     * @example
     * ```typescript
     * // Define client actions
     * const clientActions = moduleAPI.client.createClientActions({
     *   toast: async (args: {message: string, id?: string, type?: 'info' | 'success' | 'error'}) => {
     *     const notifId = args.id || notifications.show({
     *       message: args.message,
     *       color: args.type === 'error' ? 'red' : 'blue'
     *     });
     *     return {toastId: notifId};
     *   },
     *
     *   updateProgress: async (args: {operationId: string, progress: number}) => {
     *     setProgress(args.operationId, args.progress);
     *   }
     * });
     *
     * // Server calls client action
     * const serverActions = moduleAPI.server.createServerActions({
     *   doWork: async (args, userContext) => {
     *     const toastId = uuid();
     *
     *     // Initial notification
     *     clientActions.toast({message: 'Starting...', id: toastId}, userContext);
     *
     *     await doWork();
     *
     *     // Update same notification
     *     clientActions.toast({message: 'Complete!', id: toastId, type: 'success'}, userContext);
     *   }
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/client-actions | Client Actions Guide}
     */
    createClientActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): { [K in keyof Actions]: undefined extends Parameters<Actions[K]>[0] ? ((payload?: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) : ((payload: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) } => {
        const keys = Object.keys(actions);

        for (const key of keys) {
            (actions[key] as ActionCallback<any, any>) = this.createActionFn(key, {}, actions[key]);
        }

        return actions;
    };

    /**
     * Create a single client action.
     *
     * @see {@link createClientActions} for batch creation (recommended).
     */
    createClientAction = <
        Args extends undefined | object,
        ReturnValue extends Promise<undefined | void | null | object | number>
    >(
        actionName: string,
        cb: undefined extends Args ? ActionCallback<Args, ReturnValue> : ActionCallback<Args, ReturnValue>
    ): undefined extends Args ? ((args?: Args, options?: ActionCallOptions) => ReturnValue) : ((args: Args, options?: ActionCallOptions) => ReturnValue) => {
        return this.createActionFn(actionName, {}, cb);
    };
}
