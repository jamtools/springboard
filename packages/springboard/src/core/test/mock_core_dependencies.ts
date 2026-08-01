import {CoreDependencies, KVStore, Rpc, RpcArgs} from '../types/module_types.js';
import {Springboard} from '../engine/engine.js';
import springboard, {SpringboardDescriptor} from '../engine/register.js';

class MockKVStore implements KVStore {
    constructor(private store: Record<string, string> = {}) {}

    getAll = async (): Promise<Record<string, any> | null> => {
        const entriesAsRecord: Record<string, any> = {};
        for (const key of Object.keys(this.store)) {
            const value = this.store[key];
            if (value) {
                entriesAsRecord[key] = JSON.parse(value);
            }
        }

        return entriesAsRecord;
    };

    get = async <T>(key: string): Promise<T | null> => {
        const value = this.store[key];
        if (value) {
            return JSON.parse(value);
        }

        return null;
    };

    set = async <T>(key: string, value: T): Promise<void> => {
        this.store[key] = JSON.stringify(value);
    };
}

export class MockRpcService implements Rpc {
    public role = 'client' as const;
    private reconnectCallbacks: Array<() => void | Promise<void>> = [];

    callRpc = async <Args, Return>(name: string, args: Args, rpcArgs?: RpcArgs | undefined): Promise<Return | string> => {
        return {} as Return;
    };

    broadcastRpc = async <Args>(name: string, args: Args, rpcArgs?: RpcArgs | undefined) => {

    };

    registerRpc = async <Args, Return>(name: string, cb: (args: Args) => Promise<Return>) => {

    };

    initialize = async () => {
        return true;
    };

    onReconnect = (cb: () => void | Promise<void>) => {
        this.reconnectCallbacks.push(cb);
    };

    triggerReconnect = async () => {
        for (const cb of this.reconnectCallbacks) {
            await cb();
        }
    };
}

export type MakeMockCoreDependenciesOptions = {
    store?: Record<string, string>;
}

export const makeMockCoreDependencies = ({store = {}}: MakeMockCoreDependenciesOptions = {}): CoreDependencies => {
    return {
        isMaestro: () => true,
        showError: console.error,
        log: () => {},
        storage: {
            remote: new MockKVStore(store),
            userAgent: new MockKVStore(store),
        },
        rpc: {
            remote: new MockRpcService(),
            local: undefined,
        },
    };
};

export type MakeMockSpringboardEngineOptions = {
    /**
     * The serialized KV store used by both mock remote and user-agent storage.
     * Omit it for an isolated empty store.
     */
    store?: Record<string, string>;
    /**
     * Override the generated mock core dependencies when a test or Storybook
     * story needs to replace a specific service.
     */
    coreDeps?: CoreDependencies;
    /**
     * Descriptor exports from a Springboard app/module. Passing descriptors
     * mirrors platform bootstrapping without importing a module only for its
     * registerModule side effects.
     */
    descriptors?: SpringboardDescriptor | SpringboardDescriptor[];
    /**
     * Set to false when the caller wants to register additional descriptors
     * before starting the engine.
     */
    initialize?: boolean;
};

export const makeMockSpringboardEngine = async ({
    store,
    coreDeps,
    descriptors = [],
    initialize = true,
}: MakeMockSpringboardEngineOptions = {}): Promise<Springboard> => {
    springboard.reset();

    const engine = new Springboard(coreDeps ?? makeMockCoreDependencies({store}));

    for (const descriptor of Array.isArray(descriptors) ? descriptors : [descriptors]) {
        await engine.registerDescriptor(descriptor);
    }

    if (initialize) {
        await engine.initialize();
    }

    return engine;
};
