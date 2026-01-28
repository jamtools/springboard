import {useEffect, useState} from 'react';

import springboard from '../../../core/engine/register';
import {Springboard} from '../../../core/engine/engine';

import {CoreDependencies, KVStore, Rpc} from '../../../core/types/module_types';

import {ReactNativeToWebviewKVService} from '../services/kv/kv_rn_and_webview';
import {RpcRNToWebview} from '../services/rpc/rpc_rn_to_webview';

type UseAndInitializeSpringboardEngineProps = {
    onMessageFromRN: (message: string) => void;
    applicationEntrypoint: ApplicationEntrypoint;
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

import {SpringboardRegistry} from '../../../core/engine/register';
import {AsyncStorageDependency} from '../services/kv/kv_rn_and_webview';

type ApplicationEntrypoint = (registry: SpringboardRegistry) => void;

export const useAndInitializeSpringboardEngine = (props: UseAndInitializeSpringboardEngineProps) => {
    const [engineAndMessageCallback, setEngineAndMessageCallback] = useState<{engine: Springboard; handleMessageFromWebview: (message: string) => void} | null>(null);
    // const storedOnReceiveMessageFromWebview = useRef((message: string) => { });

    useEffect(() => {
        (async () => {

            const remoteRpc = props.remoteRpc;
            (remoteRpc as any).clientId = Math.random().toString().slice(2);

            // const remoteKv = new ReactNativeToWebviewKVService({rpc: localRpc, prefix: 'remote'}, props.asyncStorageDependency);
            const remoteKv = props.remoteKv;

            springboard.reset();
            try {
                props.applicationEntrypoint(springboard);
            } catch (e) {
                console.error(e);
                throw e;
            }

            const localEngine = createRNMainEngine({remoteRpc, remoteKv, onMessageFromRN: props.onMessageFromRN, asyncStorageDependency: props.asyncStorageDependency});

            try {
                await localEngine.engine.initialize();
                setEngineAndMessageCallback(localEngine);
            } catch (e) {
                alert(e);
                throw e;
            }

            await new Promise<void>(r => setTimeout(() => {
                r();
            }, 20));

            console.log('initialized engine');
        })();
    }, []);

    return engineAndMessageCallback;
};

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

    const engine = new Springboard(coreDeps, {});
    return {
        engine,
        handleMessageFromWebview: (message: string) => storedOnReceiveMessageFromWebview(message),
        // handleMessageFromWebview: storedOnReceiveMessageFromWebview.current,
    };
};
