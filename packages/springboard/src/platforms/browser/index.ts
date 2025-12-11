/**
 * Springboard Browser Platform
 * Entry point for browser/webapp functionality
 */

// Export browser services
export { BrowserJsonRpcClientAndServer } from './services/browser_json_rpc';
export { BrowserKVStoreService } from './services/browser_kvstore_service';

// Export browser entrypoints
export { startAndRenderBrowserApp } from './entrypoints/react_entrypoint';
export { Main as BrowserMain, Main } from './entrypoints/main';
export { watchForChanges } from './entrypoints/esbuild_watch_for_changes';

// Export browser components
export { RunLocalButton } from './components/run_local_button';

// Export default entrypoints
export { default as onlineEntrypoint } from './entrypoints/online_entrypoint';
export { default as offlineEntrypoint } from './entrypoints/offline_entrypoint';
