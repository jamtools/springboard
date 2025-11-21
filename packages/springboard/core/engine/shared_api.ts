import {SharedStateSupervisor, StateSupervisor} from '../services/states/shared_state_service';
import {CoreDependencies, ModuleDependencies} from '../types/module_types';
import type {ActionCallback, ActionCallOptions} from './module_api';

type ActionConfigOptions = object;

/**
 * Shared API - Methods for creating states and actions that are shared across all clients and the server.
 *
 * **Sync:** Shared states are synchronized across all connected clients via WebSockets.
 *
 * **Source of Truth:** The server is the authoritative source. Client changes are sent to
 * the server and then broadcast to all clients.
 */
export class SharedAPI {
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
     * Create shared states that sync across all connected clients and the server.
     *
     * **Storage:** Persisted to server storage and synced in-memory on all clients.
     *
     * **Sync:** Changes are automatically synchronized via WebSockets. When any client
     * or the server updates the state, all connected clients receive the update.
     *
     * **Source of Truth:** Server is authoritative. Client changes are sent to server first,
     * then broadcast to all clients.
     *
     * **Use Cases:** Game state, collaborative editing, real-time dashboards, shared settings.
     *
     * @example
     * ```typescript
     * const sharedStates = await moduleAPI.shared.createSharedStates({
     *   board: [[null, null, null], [null, null, null], [null, null, null]],
     *   currentPlayer: 'X',
     *   winner: null,
     *   score: {X: 0, O: 0}
     * });
     *
     * // Update from any client or server
     * sharedStates.board.setState(newBoard);
     *
     * // Use in React component
     * const board = sharedStates.board.useState();
     * ```
     *
     * @see {@link https://docs.springboard.dev/shared-states | Shared States Guide}
     */
    createSharedStates = async <States extends Record<string, any>>(
        states: States
    ): Promise<{[K in keyof States]: StateSupervisor<States[K]>}> => {
        const keys = Object.keys(states);
        const promises = keys.map(async key => {
            return {
                state: await this.createSharedState(key, states[key]),
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
     * Create a single shared state.
     *
     * @see {@link createSharedStates} for batch creation (recommended).
     */
    private createSharedState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
        const fullKey = `${this.prefix}|state.shared|${stateName}`;

        const cachedValue = this.modDeps.services.remoteSharedStateService.getCachedValue(fullKey) as State | undefined;
        if (cachedValue !== undefined) {
            initialValue = cachedValue;
        } else {
            const storedValue = await this.coreDeps.storage.shared.get<State>(fullKey);
            if (storedValue !== null && storedValue !== undefined) {
                initialValue = storedValue;
            } else if (this.coreDeps.isMaestro()) {
                await this.coreDeps.storage.shared.set<State>(fullKey, initialValue);
            }
        }

        const supervisor = new SharedStateSupervisor(fullKey, initialValue, this.modDeps.services.remoteSharedStateService);

        const sub = supervisor.subjectForKVStorePublish.subscribe(async value => {
            await this.coreDeps.storage.shared.set(fullKey, value);
        });
        this.onDestroyFn(sub.unsubscribe);

        return supervisor;
    };

    /**
     * Create shared actions that can run locally or remotely.
     *
     * **Execution:** By default, actions run on the server via RPC. If called from the server
     * or with `{mode: 'local'}`, the action runs locally.
     *
     * **Use Cases:** Business logic, state updates, validation, data fetching.
     *
     * @example
     * ```typescript
     * const sharedActions = moduleAPI.shared.createSharedActions({
     *   clickCell: async (args: {row: number, col: number}) => {
     *     const board = sharedStates.board.getState();
     *     if (board[args.row][args.col]) return; // Cell already filled
     *
     *     sharedStates.board.setStateImmer(draft => {
     *       draft[args.row][args.col] = sharedStates.currentPlayer.getState();
     *     });
     *
     *     // Check for winner
     *     const winner = checkWinner(sharedStates.board.getState());
     *     if (winner) sharedStates.winner.setState(winner);
     *   },
     *
     *   resetGame: async () => {
     *     sharedStates.board.setState(initialBoard);
     *     sharedStates.winner.setState(null);
     *   }
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/shared-actions | Shared Actions Guide}
     */
    createSharedActions = <Actions extends Record<string, ActionCallback<any, any>>>(
        actions: Actions
    ): { [K in keyof Actions]: undefined extends Parameters<Actions[K]>[0] ? ((payload?: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) : ((payload: Parameters<Actions[K]>[0], options?: ActionCallOptions) => Promise<ReturnType<Actions[K]>>) } => {
        const keys = Object.keys(actions);

        for (const key of keys) {
            (actions[key] as ActionCallback<any, any>) = this.createActionFn(key, {}, actions[key]);
        }

        return actions;
    };

    /**
     * Create a single shared action.
     *
     * @see {@link createSharedActions} for batch creation (recommended).
     */
    createSharedAction = <
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
