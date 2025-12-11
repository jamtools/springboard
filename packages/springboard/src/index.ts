/**
 * Springboard - Full-stack JavaScript framework
 * Main entry point for core functionality
 */

// Export the main springboard registry
export { springboard } from './core/engine/register';
export { default } from './core/engine/register';

// Export the Springboard engine and providers
export {
  Springboard,
  SpringboardProvider,
  SpringboardProviderPure,
  useSpringboardEngine,
} from './core/engine/engine';

// Export types from core
export type {
  CoreDependencies,
  ModuleDependencies,
  KVStore,
  Rpc,
  RpcArgs,
  FileStorageProvider,
} from './core/types/module_types';

export type {
  SpringboardRegistry,
  RegisterModuleOptions,
  ModuleCallback,
  ClassModuleCallback,
  DocumentMetaFunction,
  RegisterRouteOptions,
} from './core/engine/register';

// Export module registry
export {
  ModuleRegistry,
} from './core/module_registry/module_registry';

export type {
  Module,
  ExtraModuleDependencies,
  DocumentMeta,
} from './core/module_registry/module_registry';

// Export ModuleAPI
export { ModuleAPI } from './core/engine/module_api';

// Export hooks
export { useMount } from './core/hooks/useMount';

// Export utility functions
export { generateId } from './core/utils/generate_id';

// Export services
export { SharedStateService } from './core/services/states/shared_state_service';
export { HttpKvStoreClient } from './core/services/http_kv_store_client';

// Export response types
export type {
  ErrorResponse,
  SuccessResponse,
  SpringboardResponse,
} from './core/types/response_types';

// Export modules
export { BaseModule } from './core/modules/base_module/base_module';
export { FilesModule } from './core/modules/files/files_module';
export type { FileHandle, FileMetadata } from './core/modules/files/file_types';
export { IndexedDBFileStorageProvider } from './core/modules/files/file_storage_providers/indexed_db_file_storage_provider';

// Export test utilities
export { makeMockCoreDependencies } from './core/test/mock_core_dependencies';
