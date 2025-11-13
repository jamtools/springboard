(globalThis as {useHashRouter?: boolean}).useHashRouter = true;

const alertErrors = false;

window.onerror = function (message, sourcefile, lineno, colno, error) {
    if (message.toString().includes('ResizeObserver')) {
        return true;
    }

    if (alertErrors) {
        alert('Alerting onerror: ' + message + ' - Source: ' + sourcefile + ' Line: ' + lineno + ':' + colno);
    }
    return true;
};

const originalConsoleError = console.error.bind(console);

console.error = function (message, ...args) {
    if (alertErrors) {
        alert('Message: ' + message);
    }

    originalConsoleError(message, ...args);

    return true;
};

import React from 'react';
import ReactDOM from 'react-dom/client';

import {CoreDependencies, KVStore, Rpc} from 'springboard/types/module_types';

import {Main} from '@springboardjs/platforms-browser/entrypoints/main';
import {Springboard} from 'springboard/engine/engine';

import {RpcWebviewToRN} from '../services/rpc/rpc_webview_to_rn';
import {WebviewToReactNativeKVService} from '../services/kv/kv_rn_and_webview';
import {BrowserJsonRpcClientAndServer} from '@springboardjs/platforms-browser/services/browser_json_rpc';
import {HttpKVStoreService} from 'springboard/services/http_kv_store_client';
import {NullKVStore} from 'springboard/services/namespaced_kv_store';
import {ReactNativeWebviewLocalTokenService} from '../services/rn_webview_local_token_service';

export const startJamToolsAndRenderApp = async (args: {remoteUrl: string}): Promise<Springboard> => {
    const DATA_HOST = args.remoteUrl;
    const WS_HOST = DATA_HOST.replace('http', 'ws');

    let WS_FULL_URL = WS_HOST + '/ws';
    const tokenService = new ReactNativeWebviewLocalTokenService();
    const queryParams = tokenService.makeQueryParams();
    if (queryParams) {
        WS_FULL_URL += `?${queryParams.toString()}`;
    }

    const remoteRpc = new BrowserJsonRpcClientAndServer(WS_FULL_URL);
    const remoteKv = new HttpKVStoreService(DATA_HOST);

    const postMessage = (message: string) => (window as any).ReactNativeWebView.postMessage(message);

    const engine = createRNWebviewEngine({remoteRpc, remoteKv, onMessageFromWebview: postMessage});

    const rootElem = document.createElement('div');
    // rootElem.style.overflowY = 'scroll';
    document.body.appendChild(rootElem);

    const root = ReactDOM.createRoot(rootElem);
    root.render(<Main engine={engine} />);

    await engine.waitForInitialize();

    return engine;
};

interface Storage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

class KvDrivenLocalStorage implements Storage {
    private kvItems: Record<string, string> = {};

    constructor(private kv: KVStore, private prefix: string) {}

    public initialize = async () => {
        const kvItems = await this.kv.getAll();
        if (!kvItems) {
            return;
        }

        for (const [keyWithPrefix, value] of Object.entries(kvItems)) {
            if (keyWithPrefix.startsWith(this.prefix)) {
                const key = keyWithPrefix.substring(this.prefix.length);
                this.kvItems[key] = value;
            }
        }
    };

    getItem = (key: string): string | null => {
        return this.kvItems[key] || null;
    };

    setItem = (key: string, value: string): void => {
        this.kvItems[key] = value;

        const keyWithPrefix = this.prefix + key;
        this.kv.set(keyWithPrefix, value);
    };

    removeItem = (key: string): void => {
        delete this.kvItems[key];
        this.kv.set(key, null);
        // await this.kv.remove(key);
    };
}

export const createRNWebviewEngine = (props: {remoteRpc: Rpc, remoteKv: KVStore, onMessageFromWebview: (message: string) => void}) => {
    const remoteRpc = props.remoteRpc;
    const localRpc = new RpcWebviewToRN({postMessage: props.onMessageFromWebview});

    const remoteKVStore = props.remoteKv;
    const userAgentKVStore = new WebviewToReactNativeKVService({rpc: localRpc, prefix: 'userAgent'});

    const isLocal = false;
    // const isLocal = localStorage.getItem('isLocal') === 'true';

    const localStorageService = new KvDrivenLocalStorage(userAgentKVStore, 'localStorage');
    localStorageService.initialize();
    window.localStorage.setItem = localStorageService.setItem;
    window.localStorage.getItem = localStorageService.getItem;
    window.localStorage.removeItem = localStorageService.removeItem;

    const coreDeps: CoreDependencies = {
        log: console.log,
        showError: (error: string) => console.error(error),
        storage: {
            shared: remoteKVStore,
            server: new NullKVStore(),
            userAgent: userAgentKVStore,
        },
        files: {
            saveFile: async () => { },
        },
        rpc: {
            remote: remoteRpc,
            local: localRpc,
        },
        isMaestro: () => isLocal,
    };

    const engine = new Springboard(coreDeps, {});
    return engine;
};

// setTimeout(startJamToolsAndRenderApp);

// export default () => {};
