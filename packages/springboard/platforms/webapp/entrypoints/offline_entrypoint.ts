import {MockRpcService} from 'springboard/test/mock_core_dependencies';
import React from 'react';

import {BrowserKVStoreService} from '../services/browser_kvstore_service';
import {startAndRenderBrowserApp} from './react_entrypoint';

(globalThis as {useHashRouter?: boolean}).useHashRouter = true;
(globalThis as any).React = React;

setTimeout(() => {
    const rpc = new MockRpcService();
    const remoteKvStore = new BrowserKVStoreService(localStorage);
    const userAgentKVStore = new BrowserKVStoreService(localStorage);

    startAndRenderBrowserApp({
        rpc: {
            remote: rpc,
            local: undefined,
        },
        isLocal: true,
        storage: {
            userAgent: userAgentKVStore,
            remote: remoteKvStore,
        },
    });
});

export default () => { };
