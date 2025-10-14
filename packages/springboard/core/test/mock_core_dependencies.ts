import {CoreDependencies, KVStore, Rpc, RpcArgs} from '../types/module_types';
import {ExtraModuleDependencies} from 'springboard/module_registry/module_registry';

class MockKVStore implements KVStore {
    constructor(private store: Record<string, string> = {}) {}

    getAll = async () => {
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

    callRpc = async <Args, Return>(name: string, args: Args, rpcArgs?: RpcArgs | undefined) => {
        return {} as Return;
    };

    broadcastRpc = async <Args>(name: string, args: Args, rpcArgs?: RpcArgs | undefined) => {

    };

    registerRpc = async <Args, Return>(name: string, cb: (args: Args) => Promise<Return>) => {

    };

    initialize = async () => {
        return true;
    };
}

type MakeMockCoreDependenciesOptions = {
    store: Record<string, string>;
}

export const makeMockCoreDependencies = ({store}: MakeMockCoreDependenciesOptions) => {
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
    } satisfies CoreDependencies;
};

export const makeMockExtraDependences = () => {
    return {

    } satisfies ExtraModuleDependencies;
};
