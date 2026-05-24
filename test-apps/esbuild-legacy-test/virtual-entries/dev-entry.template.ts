import { startAndRenderBrowserApp } from 'springboard/platforms/browser/entrypoints/react_entrypoint';
import { BrowserJsonRpcClientAndServer } from 'springboard/platforms/browser/services/browser_json_rpc';
import { HttpKvStoreClient } from 'springboard/core/services/http_kv_store_client';
import { BrowserKVStoreService } from 'springboard/platforms/browser/services/browser_kvstore_service';
import '__USER_ENTRY__';

// Connect to node server via Vite proxy
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const httpProtocol = location.protocol === 'https:' ? 'https' : 'http';
const wsUrl = `${wsProtocol}://${location.host}/ws`;
const httpUrl = `${httpProtocol}://${location.host}`;

const rpc = new BrowserJsonRpcClientAndServer(wsUrl, 'http');
const remoteKvStore = new HttpKvStoreClient(httpUrl);
const userAgentKvStore = new BrowserKVStoreService(localStorage);

startAndRenderBrowserApp({
  rpc: { remote: rpc, local: undefined },
  storage: { userAgent: userAgentKvStore, remote: remoteKvStore },
  dev: { reloadCss: false, reloadJs: false },
});
