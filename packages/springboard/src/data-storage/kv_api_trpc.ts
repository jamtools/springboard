import {KyselyDBWithKVStoreTable} from './kv_store_db_types.js';

export class HttpKvStoreFromKysely {
    constructor(private db: KyselyDBWithKVStoreTable) {}

    getAll = async () => {
        return this.db.selectFrom('kvstore')
            .select(['key', 'value'])
            .execute();
    };

    get = async <T>(key: string) => {
        return this.db.selectFrom('kvstore')
            .select(['value'])
            .where('key', '=', key)
            .executeTakeFirst().then(result => result?.value);
    };

    set = async <T>(key: string, value: T) => {
        await this.db
            .insertInto('kvstore')
            .values({key, value: JSON.stringify(value)})
            .onConflict((oc) =>
                oc
                    .columns(['key'])
                    .where('key', '=', key)
                    .doUpdateSet({value: JSON.stringify(value)})
            )
            .execute();
    };
}
