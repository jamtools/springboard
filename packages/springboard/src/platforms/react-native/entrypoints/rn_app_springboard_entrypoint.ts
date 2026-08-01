import {useEffect, useState} from 'react';

import {SpringboardDescriptor} from '../../../core/engine/register.js';
import {Springboard} from '../../../core/engine/engine.js';

import {CoreDependencies, KVStore, Rpc} from '../../../core/types/module_types.js';
import {BrowserJsonRpcClientAndServer} from '../../browser/services/browser_json_rpc.js';
import {HttpKvStoreClient as HttpKVStoreService} from '../../../core/services/http_kv_store_client.js';

import {ReactNativeToWebviewKVService} from '../services/kv/kv_rn_and_webview.js';
import {RpcRNToWebview} from '../services/rpc/rpc_rn_to_webview.js';
import {SpringboardExpoWebViewHost} from '../components/expo_springboard_webview_host.js';
import type {BundledWebAssetModules} from '../services/expo_bundled_web_asset_loader.js';

type UseAndInitializeSpringboardEngineProps = {
    onMessageFromRN: (message: string) => void;
    applicationEntrypoint: SpringboardDescriptor;
    asyncStorageDependency: AsyncStorageDependency;
    remoteRpc: Rpc; // new BrowserJsonRpcClientAndServer(`${WS_HOST}/ws`);
    remoteKv: KVStore;
};

const storedOnReceiveMessageFromWebview = (message: string) => {
    console.log('default storedOnReceiveMessageFromWebview');
};
const storedOnMessageFromRN = (message: string) => {
    console.log('default storedOnMessageFromRN');
};

// class ReactNativeKVStore implements KVStore {

// }

import {AsyncStorageDependency} from '../services/kv/kv_rn_and_webview.js';

export const useAndInitializeSpringboardEngine = (props: UseAndInitializeSpringboardEngineProps) => {
    const [engineAndMessageCallback, setEngineAndMessageCallback] = useState<{engine: Springboard; handleMessageFromWebview: (message: string) => void} | null>(null);
    // const storedOnReceiveMessageFromWebview = useRef((message: string) => { });

    useEffect(() => {
        (async () => {

            const remoteRpc = props.remoteRpc;
            (remoteRpc as any).clientId = Math.random().toString().slice(2);

            // const remoteKv = new ReactNativeToWebviewKVService({rpc: localRpc, prefix: 'remote'}, props.asyncStorageDependency);
            const remoteKv = props.remoteKv;

            try {
                const localEngine = createRNMainEngine({remoteRpc, remoteKv, onMessageFromRN: props.onMessageFromRN, asyncStorageDependency: props.asyncStorageDependency});
                await localEngine.engine.registerDescriptor(props.applicationEntrypoint);
                await localEngine.engine.initialize();
                setEngineAndMessageCallback(localEngine);
                return;
            } catch (e) {
                console.error(e);
                throw e;
            }
        })();
    }, []);

    return engineAndMessageCallback;
};

export const createReactNativeRemoteServices = (remoteUrl: string) => {
    const wsHost = remoteUrl.replace('http', 'ws');
    const wsFullUrl = `${wsHost}/ws`;

    return {
        remoteRpc: new BrowserJsonRpcClientAndServer(wsFullUrl),
        remoteKv: new HttpKVStoreService(remoteUrl),
    };
};

export {SpringboardExpoWebViewHost};
export type {BundledWebAssetModules};

export const createRNMainEngine = (props: {
    remoteRpc: Rpc,
    remoteKv: KVStore,
    onMessageFromRN: (message: string) => void,
    asyncStorageDependency: AsyncStorageDependency,
}) => {
    const remoteRpc = props.remoteRpc;
    (remoteRpc as any).clientId = Math.random().toString().slice(2);

    let storedOnReceiveMessageFromWebview = (message: string) => {
        console.log('default storedOnReceiveMessageFromWebview');
    };

    // let storedOnMessageFromRN = (message: string) => {
    //     console.log('default storedOnMessageFromRN')
    // };

    const localRpc = new RpcRNToWebview({
        onReceiveMessageFromWebview: (cb) => {
            storedOnReceiveMessageFromWebview = cb;
            // storedOnReceiveMessageFromWebview.current = cb;
        },
        sendMessageToWebview: (message: string) => {
            props.onMessageFromRN(message);
            // props.onMessageFromRN(message);
        },
    });

    const coreDeps: CoreDependencies = {
        isMaestro: () => false,
        log: (...args) => console.log(...args),
        showError: (error) => console.error(error),
        storage: {
            remote: new ReactNativeToWebviewKVService({rpc: localRpc, prefix: 'remote'}, props.asyncStorageDependency),
            userAgent: new ReactNativeToWebviewKVService({rpc: localRpc, prefix: 'userAgent'}, props.asyncStorageDependency),
        },
        rpc: {
            remote: remoteRpc,
            local: localRpc,
        },
    };

    // springboard.reset();

    const engine = new Springboard(coreDeps);
    return {
        engine,
        handleMessageFromWebview: (message: string) => storedOnReceiveMessageFromWebview(message),
        // handleMessageFromWebview: storedOnReceiveMessageFromWebview.current,
    };
};
