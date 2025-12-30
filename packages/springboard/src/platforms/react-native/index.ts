/**
 * Springboard React Native Platform
 * Entry point for React Native mobile application functionality
 */

// Export React Native services
export { ReactNativeToWebviewKVService } from './services/kv/kv_rn_and_webview';
export type { AsyncStorageDependency } from './services/kv/kv_rn_and_webview';
export { ReactNativeWebviewLocalTokenService } from './services/rn_webview_local_token_service';
export { RpcRNToWebview } from './services/rpc/rpc_rn_to_webview';
export { RpcWebviewToRN } from './services/rpc/rpc_webview_to_rn';

// Export React Native entrypoints
export {
  useAndInitializeSpringboardEngine,
  createRNMainEngine,
} from './entrypoints/rn_app_springboard_entrypoint';
export { startAndRenderBrowserApp as startReactNativeBrowserApp } from './entrypoints/platform_react_native_browser';
