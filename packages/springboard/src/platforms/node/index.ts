/**
 * Springboard Node.js Platform
 * Entry point for Node.js server and client functionality
 */

// Export Node.js services
export { NodeJsonRpcClientAndServer } from './services/node_json_rpc';
export { NodeKVStoreService } from './services/node_kvstore_service';
export { NodeLocalJsonRpcClientAndServer } from './services/node_local_json_rpc';
export { NodeFileStorageService } from './services/node_file_storage_service';
export { rpcAsyncLocalStorage } from './services/node_rpc_async_local_storage';

// Export Node.js entrypoints
export { startNodeApp } from './entrypoints/main';
export type { NodeAppDependencies } from './entrypoints/main';
export { default as nodeFlexibleEntrypoint } from './entrypoints/node_flexible_entrypoint';
