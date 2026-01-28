/**
 * Springboard Browser Platform
 * Entry point for browser/webapp functionality
 */

// Export browser services
export { BrowserJsonRpcClientAndServer } from './services/browser_json_rpc.js';
export { BrowserKVStoreService } from './services/browser_kvstore_service.js';

// Export browser entrypoints
export { startAndRenderBrowserApp } from './entrypoints/react_entrypoint.js';
export { Main as BrowserMain, Main } from './entrypoints/main.js';
export { watchForChanges } from './entrypoints/esbuild_watch_for_changes.js';

// Export browser components
export { RunLocalButton } from './components/run_local_button.js';

// Export default entrypoints
export { default as onlineEntrypoint } from './entrypoints/online_entrypoint.js';
export { default as offlineEntrypoint } from './entrypoints/offline_entrypoint.js';
