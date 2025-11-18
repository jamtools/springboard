import {KVStore} from 'springboard/types/module_types';
import {KyselyDBWithKVStoreTable} from './kv_store_db_types';

export class KVStoreFromKysely implements KVStore {
    constructor(private db: KyselyDBWithKVStoreTable) { }

    get = async (key: string) => {
        return this.db.selectFrom('kvstore')
            .select(['value'])
            .where('key', '=', key)
            .executeTakeFirst().then(result => result?.value && JSON.parse(result.value));
    };

    getAll = async () => {
        const entries = await this.db.selectFrom('kvstore')
            .select(['key', 'value'])
            .execute();

        const entriesAsRecord: Record<string, any> = {};
        for (const entry of entries) {
            entriesAsRecord[entry.key] = JSON.parse(entry.value);
        }

        return entriesAsRecord;
    };

    set = async <T>(key: string, value: T): Promise<void> => {
        const valueStr = JSON.stringify(value);
        await this.db
            .insertInto('kvstore')
            .values({key: key, value: JSON.stringify(value)})
            .onConflict((oc) =>
                oc
                    .columns(['key'])
                    .where('key', '=', key)
                    .doUpdateSet({value: valueStr})
            )
            .execute();
    };
}
