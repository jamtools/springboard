import {MockRpcService} from 'springboard/test/mock_core_dependencies';
import React from 'react';

import {BrowserKVStoreService} from '../services/browser_kvstore_service';
import {NamespacedKVStore} from 'springboard/services/namespaced_kv_store';
import {startAndRenderBrowserApp} from './react_entrypoint';

(globalThis as {useHashRouter?: boolean}).useHashRouter = true;
(globalThis as any).React = React;

setTimeout(() => {
    const rpc = new MockRpcService();
    const baseKvStore = new BrowserKVStoreService(localStorage);
    const userAgentKVStore = new BrowserKVStoreService(localStorage);

    const sharedKvStore = new NamespacedKVStore(baseKvStore, 'shared:');
    const serverKvStore = new NamespacedKVStore(baseKvStore, 'server:');

    startAndRenderBrowserApp({
        rpc: {
            remote: rpc,
            local: undefined,
        },
        isLocal: true,
        storage: {
            shared: sharedKvStore,
            server: serverKvStore,
            userAgent: userAgentKVStore,
        },
    });
});

export default () => { };
