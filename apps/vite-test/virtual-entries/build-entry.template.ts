import { startAndRenderBrowserApp } from 'springboard/platforms/browser/entrypoints/react_entrypoint';
import { MockJsonRpcClient } from 'springboard/core/services/mock_json_rpc_client';
import { BrowserKVStoreService } from 'springboard/platforms/browser/services/browser_kvstore_service';
import '__USER_ENTRY__';

// Build mode: offline, no server connection
const mockRpc = new MockJsonRpcClient();
const userAgentKvStore = new BrowserKVStoreService(localStorage);

startAndRenderBrowserApp({
  rpc: { remote: mockRpc, local: undefined },
  storage: { userAgent: userAgentKvStore, remote: undefined },
  dev: { reloadCss: false, reloadJs: false },
});
