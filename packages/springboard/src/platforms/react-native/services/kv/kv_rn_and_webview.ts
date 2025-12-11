export type AsyncStorageDependency = {
    getAllKeys(): Promise<readonly string[]>;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
}

import {KVStore, Rpc} from '../../../../core/types/module_types';

type Options = {
    prefix: string;
    rpc: Rpc;
};

const ReactNativeRpcBroadcastMethods = {
    KV_SET_STATE: 'rn.kv.set',
} as const;

const ReactNativeRpcAPIMethods = {
    KV_GET_STATE: 'rn.kv.get',
    KV_GET_ALL_STATE: 'rn.kv.get_all',
} as const;

// type SharedStateMessage = {
//     key: string;
//     data: any;
// }

type GetStateArgs = {
    key: string;
};

type GetAllStateArgs = object;

type SetStateArgs = {
    key: string;
    value: any;
};

const concatDotSuffix = (value1: string, value2: string) => {
    return `${value1}.${value2}`;
};

const removeDotPrefix = (value: string) => {
    return value.split('.')[1]!;
};

export class ReactNativeToWebviewKVService implements KVStore {
    constructor(private options: Options, private asyncStorageDependency: AsyncStorageDependency) {
        options.rpc.registerRpc('host-' + concatDotSuffix(ReactNativeRpcAPIMethods.KV_GET_ALL_STATE, this.options.prefix), async () => {
            return this.getAll();
        });

        options.rpc.registerRpc('host-' + concatDotSuffix(ReactNativeRpcAPIMethods.KV_GET_STATE, this.options.prefix), async (args: GetStateArgs) => {
            return this.get(args.key);
        });

        options.rpc.registerRpc('host-' + concatDotSuffix(ReactNativeRpcBroadcastMethods.KV_SET_STATE, this.options.prefix), async (args: SetStateArgs) => {
            return this.set(args.key, args.value);
        });
    }

    getAll = async () => {
        const result: Record<string, any> = {};

        const keys = (await this.asyncStorageDependency.getAllKeys()).filter(key => key.startsWith(`${this.options.prefix}.`));
        await Promise.all(keys.map(async key => {
            const value = await this.asyncStorageDependency.getItem(key);
            if (value) {
                try {
                    const parsedValue = JSON.parse(value);
                    const trimmedKey = removeDotPrefix(key);
                    result[trimmedKey] = parsedValue;
                } catch (e) {
                    console.error(`KVReactNativeToWebviewService.getAll failed to parse json value for key ${key}`);
                }
            }
        }));

        return result;
    };

    get = async (initialKey: string) => {
        const key = concatDotSuffix(this.options.prefix, initialKey);
        const value = await this.asyncStorageDependency.getItem(key);
        if (!value) {
            return null;
        }

        if (value === 'undefined') {
            return undefined;
        } else if (value === 'null') {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch (e) {
            console.error(`KVReactNativeToWebviewService.get failed to parse json value for key ${key}`);
        }
    };

    set = async <T>(initialKey: string, value: T) => {
        const key = concatDotSuffix(this.options.prefix, initialKey);
        let valueStr = JSON.stringify(value);
        if (typeof valueStr !== 'string') {
            if (valueStr === undefined) {
                valueStr = 'undefined';
            } else if (valueStr === null) {
                valueStr = 'null';
            }
        }
        await this.asyncStorageDependency.setItem(key, valueStr);

        // const message: SetStateArgs = {
        //     key: initialKey,
        //     value,
        // };

        // const rpcMethodName = concatDotSuffix(ReactNativeRpcBroadcastMethods.KV_SET_STATE, this.options.prefix);

        // const response = await this.options.rpc.broadcastRpc(rpcMethodName, message);
        // return response;
        return undefined;
    };
}

export class WebviewToReactNativeKVService implements KVStore {
    constructor(private options: Options) {
        // options.rpc.registerRpc(concatDotSuffix(ReactNativeRpcBroadcastMethods.KV_SET_STATE, this.options.prefix), async (args: SetStateArgs) => {
        //     return this.setFromBroadcast(args.key, args.value);
        // });
    }

    getAll = async () => {
        const rpcMethod = 'host-' + concatDotSuffix(ReactNativeRpcAPIMethods.KV_GET_ALL_STATE, this.options.prefix);
        const args = {} as GetAllStateArgs;

        const result = await this.options.rpc.callRpc(rpcMethod, args) as Awaited<ReturnType<ReactNativeToWebviewKVService['getAll']>>;
        return result;
    };

    get = async (key: string) => {
        const rpcMethod = 'host-' + concatDotSuffix(ReactNativeRpcAPIMethods.KV_GET_STATE, this.options.prefix);
        const args = {
            key,
        } as GetStateArgs;

        const result = await this.options.rpc.callRpc(rpcMethod, args) as Awaited<ReturnType<ReactNativeToWebviewKVService['get']>>;
        return result;
    };

    set = async <T>(key: string, value: T) => {
        const rpcMethod = 'host-' + concatDotSuffix(ReactNativeRpcBroadcastMethods.KV_SET_STATE, this.options.prefix);
        const args = {
            key,
            value,
        } as SetStateArgs;

        const result = await this.options.rpc.callRpc(rpcMethod, args) as Awaited<ReturnType<ReactNativeToWebviewKVService['set']>>;
        return result;
    };

    // setFromBroadcast = async <T>(key: string, value: T) => {
    //     // this.options.updateValue(key, value);
    //     // for (const cb of this.onNewValueCallbacks) {
    //     //     cb(key, value);
    //     // }
    // };
}
