import {KVStore} from '../../../core/types/module_types';

export class BrowserKVStoreService implements KVStore {
    constructor(private ls: Window['localStorage']) {}

    getAll = async (): Promise<Record<string, any> | null> => {
        const allKeys = Object.keys(this.ls);

        const entriesAsRecord: Record<string, any> = {};
        for (const key of allKeys) {
            // if (key.startsWith('iconify')) {
            //     continue;
            // }

            const value = this.ls.getItem(key);
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
        const s = this.ls.getItem(key);
        if (!s) {
            return null;
        }

        return JSON.parse(s) as T;
    };

    set = async <T>(key: string, value: T): Promise<void> => {
        const s = JSON.stringify(value);
        this.ls.setItem(key, s);
    };
}
