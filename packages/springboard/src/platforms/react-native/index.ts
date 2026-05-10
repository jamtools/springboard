/**
 * Springboard React Native Platform
 * Entry point for React Native mobile application functionality
 */

// Export React Native services
export { ReactNativeToWebviewKVService } from './services/kv/kv_rn_and_webview.js';
export type { AsyncStorageDependency } from './services/kv/kv_rn_and_webview.js';
export { ReactNativeWebviewLocalTokenService } from './services/rn_webview_local_token_service.js';
export { RpcRNToWebview } from './services/rpc/rpc_rn_to_webview.js';
export { RpcWebviewToRN } from './services/rpc/rpc_webview_to_rn.js';

// Export React Native entrypoints
export {
    useAndInitializeSpringboardEngine,
    createRNMainEngine,
    createReactNativeRemoteServices,
    SpringboardExpoWebViewHost,
} from './entrypoints/rn_app_springboard_entrypoint.js';
export { startAndRenderBrowserApp as startReactNativeBrowserApp } from './entrypoints/platform_react_native_browser.js';
export { loadBundledWebAppAssets } from './services/expo_bundled_web_asset_loader.js';
export type { BundledWebAssetModules } from './services/expo_bundled_web_asset_loader.js';
