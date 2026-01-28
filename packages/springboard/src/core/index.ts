/**
 * Springboard Core Module
 * Re-exports all core functionality
 */

// Export the main springboard registry
export { springboard, getRegisteredSplashScreen } from './engine/register.js';
export { default } from './engine/register.js';

// Export types from register
export type {
  SpringboardRegistry,
  RegisterModuleOptions,
  ModuleCallback,
  ClassModuleCallback,
  DocumentMetaFunction,
  RegisterRouteOptions,
} from './engine/register.js';

// Export the Springboard engine and providers
export {
  Springboard,
  SpringboardProvider,
  SpringboardProviderPure,
  useSpringboardEngine,
} from './engine/engine.js';

// Export ModuleAPI
export { ModuleAPI } from './engine/module_api.js';

// Export types from core
export type {
  CoreDependencies,
  ModuleDependencies,
  KVStore,
  Rpc,
  RpcArgs,
} from './types/module_types.js';

// Export module registry
export {
  ModuleRegistry,
} from './module_registry/module_registry.js';

export type {
  Module,
  ExtraModuleDependencies,
  DocumentMeta,
} from './module_registry/module_registry.js';

// Export hooks
export { useMount } from './hooks/useMount.js';

// Export utility functions
export { generateId } from './utils/generate_id.js';

// Export services
export { SharedStateService } from './services/states/shared_state_service.js';
export { HttpKvStoreClient } from './services/http_kv_store_client.js';

// Export response types
export type {
  ErrorResponse,
} from './types/response_types.js';

// Export modules
export { BaseModule } from './modules/base_module/base_module.js';

// Export test utilities
export { makeMockCoreDependencies } from './test/mock_core_dependencies.js';
