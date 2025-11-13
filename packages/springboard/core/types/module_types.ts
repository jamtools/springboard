import {Module, ModuleRegistry} from 'springboard/module_registry/module_registry';
import {SharedStateService, ServerStateService} from '../services/states/shared_state_service';

export type ModuleCallback<T extends object,> = (coreDeps: CoreDependencies, modDependencies: ModuleDependencies) =>
Promise<Module<T>> | Module<T>;
export type Springboard = {
    registerClassModule: <T extends object>(cb: ModuleCallback<T>) => void;
    registerClassModulee: <T extends object>(cb: ModuleCallback<T>) => void;
};

export type CoreDependencies = {
    log: (...s: any[]) => void;
    showError: (error: string) => void;
    files: {
        saveFile: (name: string, content: string) => Promise<void>;
    };
    storage: {
        shared: KVStore;
        server: KVStore;
        userAgent: KVStore;
    };
    rpc: {
        remote: Rpc;
        local?: Rpc;
    };
    isMaestro: () => boolean;
}

export type KVStore = {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    getAll: () => Promise<Record<string, any> | null>;
}

export type RpcArgs = {
    isMaestroOnly: boolean;
}

export type Rpc = {
    callRpc: <Args, Return>(name: string, args: Args, rpcArgs?: RpcArgs) => Promise<Return | string>;
    broadcastRpc: <Args>(name: string, args: Args, rpcArgs?: RpcArgs) => Promise<void>;
    registerRpc: <Args, Return>(name: string, cb: (args: Args) => Promise<Return>) => void;
    initialize: () => Promise<boolean>;
    role: 'server' | 'client';
    reconnect?: (queryParams?: Record<string, string>) => Promise<boolean>;
}

type ToastOptions = {
    target: 'all' | 'self' | 'others';
    message: string;
    variant: 'info' | 'success' | 'warning' | 'error';
    onClick?: [methodName: string, args: any[]];
    flash?: boolean;
    persistent?: boolean;
};

export type ModuleDependencies = {
    moduleRegistry: ModuleRegistry;
    toast: (toastOptions: ToastOptions) => void;
    rpc: {
        remote: Rpc;
        local?: Rpc;
    };
    services: {
        remoteSharedStateService: SharedStateService;
        localSharedStateService : SharedStateService;
        serverStateService: ServerStateService;
    };
}
