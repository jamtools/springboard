import fs from 'node:fs';

import {KVStore} from 'springboard/types/module_types';

// TODO: this needs to be optional I think. or just have a sane default
// the file should be assumed to be in ./data/kv_data.json
// these are growing pains for not doing things in CWD thus far
//
const DATA_FILE_NAME = process.env.NODE_KV_STORE_DATA_FILE || './data/kv_data.json';

let allKVData: Record<string, Record<string, string>> = {};

if (fs.existsSync(DATA_FILE_NAME)) {
    const initialKVDataString = fs.readFileSync(DATA_FILE_NAME).toString();
    allKVData = JSON.parse(initialKVDataString) as Record<string, Record<string, string>>;
} else {
    const folder = DATA_FILE_NAME.split('/').slice(0, -1).join('/');
    if (folder) {
        fs.mkdirSync(folder, {recursive: true});
    }

    fs.writeFileSync(DATA_FILE_NAME, '{}');
}

export class LocalJsonNodeKVStoreService implements KVStore {
    constructor(private databaseName: string) {

    }

    public getAll = async () => {
        const store = allKVData[this.databaseName] || {};
        const entriesAsRecord: Record<string, any> = {};
        for (const key of Object.keys(store)) {
            const value = store[key];
            entriesAsRecord[key] = JSON.parse(value);
        }

        return entriesAsRecord;
    };

    public get = async <T>(key: string) => {
        const db = allKVData[this.databaseName];
        if (!db) {
            return null;
        }

        const s = db[key];
        if (!s) {
            return null;
        }

        return JSON.parse(s) as T;
    };

    public set = async <T>(key: string, value: T) => {
        const s = JSON.stringify(value);

        const db = allKVData[this.databaseName] || {};
        db[key] = s;

        allKVData[this.databaseName] = db;
        await fs.promises.writeFile(DATA_FILE_NAME, JSON.stringify(allKVData));
    };
}
