import {MockRpcService} from '../../../core/test/mock_core_dependencies.js';
import React from 'react';

import {BrowserKVStoreService} from '../services/browser_kvstore_service.js';
import {BrowserSessionKVStoreService} from '../services/browser_session_kvstore_service.js';
import {NamespacedKVStore} from '../../../core/services/namespaced_kv_store.js';
import {startAndRenderBrowserApp} from './react_entrypoint.js';

(globalThis as {useHashRouter?: boolean}).useHashRouter = true;
(globalThis as any).React = React;

setTimeout(() => {
    const rpc = new MockRpcService();
    const baseKvStore = new BrowserKVStoreService(localStorage);
    const userAgentKVStore = new BrowserKVStoreService(localStorage);
    const sessionKVStore = new BrowserSessionKVStoreService(sessionStorage);

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
            remote: sharedKvStore,
            session: sessionKVStore,
        },
    });
});

export default () => { };
