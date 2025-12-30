/**
 * Springboard Core Module
 * Re-exports all core functionality
 */

// Export the main springboard registry
export { springboard, getRegisteredSplashScreen } from './engine/register';
export { default } from './engine/register';

// Export types from register
export type {
  SpringboardRegistry,
  RegisterModuleOptions,
  ModuleCallback,
  ClassModuleCallback,
  DocumentMetaFunction,
  RegisterRouteOptions,
} from './engine/register';

// Export the Springboard engine and providers
export {
  Springboard,
  SpringboardProvider,
  SpringboardProviderPure,
  useSpringboardEngine,
} from './engine/engine';

// Export ModuleAPI
export { ModuleAPI } from './engine/module_api';

// Export types from core
export type {
  CoreDependencies,
  ModuleDependencies,
  KVStore,
  Rpc,
  RpcArgs,
} from './types/module_types';

// Export module registry
export {
  ModuleRegistry,
} from './module_registry/module_registry';

export type {
  Module,
  ExtraModuleDependencies,
  DocumentMeta,
} from './module_registry/module_registry';

// Export hooks
export { useMount } from './hooks/useMount';

// Export utility functions
export { generateId } from './utils/generate_id';

// Export services
export { SharedStateService } from './services/states/shared_state_service';
export { HttpKvStoreClient } from './services/http_kv_store_client';

// Export response types
export type {
  ErrorResponse,
} from './types/response_types';

// Export modules
export { BaseModule } from './modules/base_module/base_module';
export { FilesModule } from './modules/files/files_module';

// Export test utilities
export { makeMockCoreDependencies } from './test/mock_core_dependencies';
