import {KVStore} from '../../../core/types/module_types.js';

export class BrowserSessionKVStoreService implements KVStore {
    constructor(private ss: Window['sessionStorage']) {}

    getAll = async (): Promise<Record<string, any> | null> => {
        const allKeys = Object.keys(this.ss);

        const entriesAsRecord: Record<string, any> = {};
        for (const key of allKeys) {
            const value = this.ss.getItem(key);
            if (value) {
                try {
                    entriesAsRecord[key] = JSON.parse(value);
                } catch (e) {
                    // eslint-disable-line no-empty
                }
            }
        }

        return entriesAsRecord;
    };

    get = async <T>(key: string): Promise<T | null> => {
        const s = this.ss.getItem(key);
        if (!s) {
            return null;
        }

        return JSON.parse(s) as T;
    };

    set = async <T>(key: string, value: T): Promise<void> => {
        const s = JSON.stringify(value);
        this.ss.setItem(key, s);
    };
}
