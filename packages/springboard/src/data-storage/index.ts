/**
 * Data Storage Module
 *
 * This module provides database utilities for Springboard applications,
 * including key-value store implementations using Kysely and SQLite.
 *
 * @example
 * ```typescript
 * import { makeKyselySqliteInstance, KVStoreFromKysely } from 'springboard/data-storage';
 *
 * const db = await makeKyselySqliteInstance('data/kv.db');
 * const kvStore = new KVStoreFromKysely(db);
 *
 * await kvStore.set('myKey', { hello: 'world' });
 * const value = await kvStore.get('myKey');
 * ```
 */

// SQLite database utilities
export { makeKyselySqliteInstance, makeKyselyInstanceFromDialect } from './sqlite_db';

// KV Store implementations
export { KVStoreFromKysely } from './kv_api_kysely';
export { HttpKvStoreFromKysely } from './kv_api_trpc';

// Types
export type { KVStoreDatabaseSchema, KVEntry, KyselyDBWithKVStoreTable } from './kv_store_db_types';
