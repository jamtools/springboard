import {ColumnType, Generated, Kysely} from 'kysely';

export type KVStoreDatabaseSchema = {
    kvstore: KVEntry;
}

export interface KVEntry {
    id: Generated<number>;
    key: string;
    value: string;
}

// workspace: string;
// store: string;
// created_at: ColumnType<Date, string | undefined, never>
// };

export type KyselyDBWithKVStoreTable = Kysely<KVStoreDatabaseSchema>;
