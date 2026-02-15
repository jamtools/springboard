/**
 * Springboard - Full-stack JavaScript framework
 * Main entry point for core functionality
 */

// Export the main springboard registry
export { springboard } from './core/engine/register.js';
export { default } from './core/engine/register.js';

// Export the Springboard engine and providers
export {
    Springboard,
    SpringboardProvider,
    SpringboardProviderPure,
    useSpringboardEngine,
} from './core/engine/engine.js';

// Export types from core
export type {
    CoreDependencies,
    ModuleDependencies,
    KVStore,
    Rpc,
    RpcArgs,
} from './core/types/module_types.js';

export type {
    SpringboardRegistry,
} from './core/engine/register.js';

// Export module registry
export {
    ModuleRegistry,
} from './core/module_registry/module_registry.js';

export type {
    Module,
    DocumentMeta,
} from './core/module_registry/module_registry.js';

// Export ModuleAPI
export { ModuleAPI } from './core/engine/module_api.js';

// Export utility functions
export { generateId } from './core/utils/generate_id.js';

// Export services
export { SharedStateService } from './core/services/states/shared_state_service.js';
export { HttpKvStoreClient } from './core/services/http_kv_store_client.js';

// Export response types
export type {
    ErrorResponse,
} from './core/types/response_types.js';
