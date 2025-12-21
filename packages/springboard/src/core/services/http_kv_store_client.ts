import {KVStore} from '../types/module_types';

interface KVResponse {
    key: string;
    value: string;
}

function isKVResponse(obj: any): obj is KVResponse {
    return obj &&
           typeof obj === 'object' &&
           typeof obj.key === 'string' &&
           typeof obj.value === 'string';
}

export class HttpKVStoreService implements KVStore {
    constructor(private serverUrl: string) {}

    public setUrl = (url: string) => {
        this.serverUrl = url;
    };

    getAll = async () => {
        try {
            const allEntries = await fetch(`${this.serverUrl}/kv/get-all`);

            if (!allEntries.ok) {
                try {
                    const errString = await allEntries.text();
                    console.error(`Failed to get all KV entries: ${allEntries.status} ${allEntries.statusText}: ${errString}`);
                    throw new Error(`HTTP ${allEntries.status}: Failed to retrieve KV entries: ${errString}`);
                } catch (e) {
                    console.error(`Failed to get all KV entries: ${allEntries.status} ${allEntries.statusText}`);
                    throw new Error(`HTTP ${allEntries.status}: Failed to retrieve KV entries`);
                }
            }

            const allEntriesJson = await allEntries.json() as unknown;
            if (!allEntriesJson || typeof allEntriesJson !== 'object') {
                console.error('Invalid response format from get-all endpoint');
                throw new Error('Invalid response format');
            }

            return allEntriesJson as Record<string, any>;
        } catch (error) {
            console.error('Error fetching all KV entries:', error);
            throw error;
        }
    };

    get = async <T>(key: string) => {
        try {
            const u = new URL(`${this.serverUrl}/kv/get`);
            u.searchParams.set('key', key);
            const result = await fetch(u.toString());

            if (!result.ok) {
                if (result.status === 404) {
                    // Key not found is a valid case, return null
                    return null;
                }
                console.error(`Failed to get KV entry for key '${key}': ${result.status} ${result.statusText}`);
                throw new Error(`HTTP ${result.status}: Failed to retrieve value for key '${key}'`);
            }

            const resultJson = await result.json() as unknown;
            if (!isKVResponse(resultJson)) {
                console.error('Invalid response format from get endpoint:', resultJson);
                throw new Error('Invalid response format');
            }

            try {
                return JSON.parse(resultJson.value) as T;
            } catch (parseError) {
                console.error(`Failed to parse value for key '${key}':`, parseError);
                throw new Error(`Invalid JSON value for key '${key}'`);
            }
        } catch (error) {
            console.error(`Error fetching KV entry for key '${key}':`, error);
            throw error;
        }
    };

    set = async <T>(key: string, value: T) => {
        try {
            const serialized = JSON.stringify(value);

            const result = await fetch(`${this.serverUrl}/kv/set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({key, value: serialized}),
            });

            if (!result.ok) {
                console.error(`Failed to set KV entry for key '${key}': ${result.status} ${result.statusText}`);
                throw new Error(`HTTP ${result.status}: Failed to set value for key '${key}'`);
            }
        } catch (error) {
            console.error(`Error setting KV entry for key '${key}':`, error);
            throw error;
        }
    };
}

// Export alias for backward compatibility
export const HttpKvStoreClient = HttpKVStoreService;
