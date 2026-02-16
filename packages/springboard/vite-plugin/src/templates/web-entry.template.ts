import { startAndRenderBrowserApp } from 'springboard/platforms/browser/entrypoints/react_entrypoint';
import { BrowserJsonRpcClientAndServer } from 'springboard/platforms/browser/services/browser_json_rpc';
import { HttpKvStoreClient } from 'springboard/core/services/http_kv_store_client';
import { BrowserKVStoreService } from 'springboard/platforms/browser/services/browser_kvstore_service';
import '__USER_ENTRY__';

// Determine protocol based on current page
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const httpProtocol = location.protocol === 'https:' ? 'https' : 'http';

// Allow custom hosts via Vite environment variables, default to current location
const WS_HOST = import.meta.env.VITE_WS_HOST || `${wsProtocol}://${location.host}`;
const DATA_HOST = import.meta.env.VITE_DATA_HOST || `${httpProtocol}://${location.host}`;

// Connect to backend server
const rpc = new BrowserJsonRpcClientAndServer(`${WS_HOST}/ws`);
const remoteKvStore = new HttpKvStoreClient(DATA_HOST);
const userAgentKvStore = new BrowserKVStoreService(localStorage);

startAndRenderBrowserApp({
  rpc: { remote: rpc, local: undefined },
  storage: { userAgent: userAgentKvStore, remote: remoteKvStore },
  dev: { reloadCss: false, reloadJs: false },
});
