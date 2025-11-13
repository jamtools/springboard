import {KVStore} from '../types/module_types';

/**
 * NamespacedKVStore is a pure decorator that wraps a KVStore and prefixes all keys with a namespace.
 * This provides storage-level isolation between different types of state (e.g., shared vs server).
 *
 * This decorator ONLY handles key namespacing - caching is handled by separate service layers.
 */
export class NamespacedKVStore implements KVStore {
    /**
     * @param inner - The underlying KVStore to wrap
     * @param namespace - The prefix to add to all keys (e.g., 'shared:', 'server:')
     */
    constructor(
        private inner: KVStore,
        private namespace: string
    ) {}

    async get<T>(key: string): Promise<T | null> {
        return this.inner.get<T>(this.namespace + key);
    }

    async set<T>(key: string, value: T): Promise<void> {
        return this.inner.set<T>(this.namespace + key, value);
    }

    async getAll(): Promise<Record<string, any> | null> {
        const allData = await this.inner.getAll();
        return this.filterAndStripNamespace(allData);
    }

    /**
     * Filters the data to only include keys that start with this namespace,
     * and strips the namespace prefix from the keys in the returned object.
     */
    private filterAndStripNamespace(data: Record<string, any> | null): Record<string, any> | null {
        if (!data) {
            return null;
        }

        const filtered: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith(this.namespace)) {
                // Strip the namespace prefix from the key
                const strippedKey = key.substring(this.namespace.length);
                filtered[strippedKey] = value;
            }
        }

        return Object.keys(filtered).length > 0 ? filtered : null;
    }
}

/**
 * NullKVStore is a stub implementation that throws errors for all operations.
 * Used on client platforms where server state should never be accessed.
 */
export class NullKVStore implements KVStore {
    private throwError(): never {
        throw new Error('This KVStore is not available. Server state cannot be accessed from client platforms.');
    }

    async get<T>(_key: string): Promise<T | null> {
        this.throwError();
    }

    async set<T>(_key: string, _value: T): Promise<void> {
        this.throwError();
    }

    async getAll(): Promise<Record<string, any> | null> {
        this.throwError();
    }
}
