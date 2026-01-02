/**
 * React Native Entrypoint
 *
 * This is the main entrypoint for React Native applications.
 * React Native apps run on mobile devices and connect to a remote server
 * (typically a Node.js server running node_server_entrypoint.ts).
 *
 * For the client-side React Native engine initialization, see:
 * - rn_app_springboard_entrypoint.ts (React hook-based initialization)
 * - platform_react_native_browser.tsx (WebView-based browser integration)
 *
 * Reference: packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts
 */

// Re-export the main React Native initialization utilities
export {
    useAndInitializeSpringboardEngine,
    createRNMainEngine,
} from './rn_app_springboard_entrypoint';
