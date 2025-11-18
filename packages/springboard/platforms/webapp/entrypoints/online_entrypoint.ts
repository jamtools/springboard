import {BrowserJsonRpcClientAndServer} from '../services/browser_json_rpc';
import {BrowserKVStoreService} from '../services/browser_kvstore_service';
import {HttpKVStoreService} from 'springboard/services/http_kv_store_client';
import {startAndRenderBrowserApp} from './react_entrypoint';

let wsProtocol = 'ws';
let httpProtocol = 'http';
if (location.protocol === 'https:') {
    wsProtocol = 'wss';
    httpProtocol = 'https';
}

const WS_HOST = process.env.WS_HOST || `${wsProtocol}://${location.host}`;
const DATA_HOST = process.env.DATA_HOST || `${httpProtocol}://${location.host}`;

const reloadCss = process.env.NODE_ENV === 'development' && process.env.RELOAD_CSS === 'true';
const reloadJs = process.env.NODE_ENV === 'development' && process.env.RELOAD_JS === 'true';

setTimeout(() => {
    const rpc = new BrowserJsonRpcClientAndServer(`${WS_HOST}/ws`);
    const remoteKvStore = new HttpKVStoreService(DATA_HOST);
    const userAgentKVStore = new BrowserKVStoreService(localStorage);

    startAndRenderBrowserApp({
        rpc: {
            remote: rpc,
            local: undefined,
        },
        storage: {
            userAgent: userAgentKVStore,
            remote: remoteKvStore,
        },
        dev: {
            reloadCss,
            reloadJs,
        },
    });
});

export default () => { };
