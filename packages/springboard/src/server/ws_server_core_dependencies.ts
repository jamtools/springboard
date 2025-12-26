import fs from 'fs';

import {makeKyselySqliteInstance} from '../data-storage/sqlite_db';

import {KyselyDBWithKVStoreTable} from '../data-storage/kv_store_db_types';

import {KVStoreFromKysely} from '../data-storage/kv_api_kysely';

export type WebsocketServerCoreDependencies = {
    kvDatabase: KyselyDBWithKVStoreTable;
    kvStoreFromKysely: KVStoreFromKysely;
};

const SQLITE_DATABASE_FILE = process.env.SQLITE_DATABASE_FILE || 'data/kv.db';

export const makeWebsocketServerCoreDependenciesWithSqlite = async (): Promise<WebsocketServerCoreDependencies> => {
    if (SQLITE_DATABASE_FILE.startsWith('data/')) {
        await fs.promises.mkdir('data', {recursive: true});
    }

    const db = await makeKyselySqliteInstance(SQLITE_DATABASE_FILE);

    return {
        kvDatabase: db,
        kvStoreFromKysely: new KVStoreFromKysely(db),
    };
};
