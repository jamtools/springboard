import {SharedStateSupervisor, StateSupervisor} from '../services/states/shared_state_service';
import {CoreDependencies, ModuleDependencies} from '../types/module_types';

/**
 * Shared API - Methods for creating states that are shared across all clients and the server.
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
     * Create a single shared state that syncs across all clients.
     *
     * **Sync:** Changes are automatically synchronized via WebSockets to all connected clients.
     *
     * **Note:** For creating multiple states, use {@link createSharedStates} instead.
     *
     * @example
     * ```typescript
     * const counter = await moduleAPI.shared.createSharedState('counter', 0);
     * counter.setState(5); // Syncs to all clients
     * ```
     */
    createSharedState = async <State>(stateName: string, initialValue: State): Promise<StateSupervisor<State>> => {
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
}
