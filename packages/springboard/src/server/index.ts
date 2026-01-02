/**
 * Springboard Server Module
 * Entry point for server-side functionality
 */

// Export server registry
export { serverRegistry } from './register';
export { serverRegistry as default } from './register';

export type {
  ServerModuleRegistry,
  ServerModuleCallback,
  ServerModuleAPI,
  RpcMiddleware,
} from './register';

// Export Hono app factory
export { initApp } from './hono_app';

// Export server dependencies (from Node platform - SQLite-backed)
export {
  makeWebsocketServerCoreDependenciesWithSqlite,
} from '../platforms/node/services/ws_server_core_dependencies';
export type { WebsocketServerCoreDependencies } from '../platforms/node/services/ws_server_core_dependencies';

// Export server JSON RPC
export { NodeJsonRpcServer } from './services/server_json_rpc';

// Export utilities
export { injectDocumentMeta } from './utils/inject_metadata';
export { matchPath } from './utils/match_path';

// Export entrypoints
export { default as startLocalServer } from './entrypoints/local-server.entrypoint';
