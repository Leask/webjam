import { dbio, uoid, utilitas } from 'utilitas';

const _NEED = ['mysql2', 'pg'];
const _ = {};
const newId = _clase => uoid.create({ type: assertClass(_clase) });

const extandable = [
    'countByKeyValue', 'deleteAll', 'deleteById', 'deleteByKeyValue', 'desc',
    'drop', 'indexes', 'insert', 'queryAll', 'queryById', 'queryByKeyValue',
    'updateById', 'updateByKeyValue', 'upsert',
];

let initialized = false;

const assertClass = _clase => {
    const _class = utilitas.ensureString(_clase, { case: 'SNAKE' });
    assert(_class, 'Invalid class.');
    return `meta_${_class}`;
};

const getInitSql = (_clase) => {
    const table = assertClass(_clase);
    return {
        [dbio.MYSQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ?? (
            \`id\`               VARCHAR(255) NOT NULL,
            \`name\`             VARCHAR(255) DEFAULT NULL,
            \`description\`      VARCHAR(255) DEFAULT NULL,
            \`data\`             TEXT         DEFAULT NULL,
            \`distilled\`        TEXT         DEFAULT NULL,
            \`distilled_vector\` VECTOR(1536) DEFAULT NULL,
            \`created_by\`       VARCHAR(255) NOT NULL,
            \`updated_by\`       VARCHAR(255) NOT NULL,
            \`created_at\`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY                (\`id\`),
            INDEX          name        (\`name\`),
            INDEX          description (\`description\`),
            FULLTEXT INDEX data        (\`data\`(768)),
            FULLTEXT INDEX distilled   (\`distilled\`(768)),
            INDEX          created_by  (\`created_by\`),
            INDEX          updated_by  (\`updated_by\`),
            INDEX          created_at  (\`created_at\`),
            INDEX          updated_at  (\`updated_at\`),
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`), [table],
        ]],
        [dbio.POSTGRESQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS "${table}" (
            "id"               VARCHAR(255) NOT NULL,
            "name"             VARCHAR(255) DEFAULT NULL,
            "description"      VARCHAR(255) DEFAULT NULL,
            "data"             JSONB        DEFAULT NULL,
            "distilled"        TEXT         DEFAULT NULL,
            "distilled_vector" VECTOR(1536) DEFAULT NULL,
            "created_by"       VARCHAR(255) NOT NULL,
            "updated_by"       VARCHAR(255) NOT NULL,
            "created_at"       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("id")
        )`)
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_name_index" ON "${table}" ("name")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_description_index" ON "${table}" ("description")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_data_index" ON "${table}" USING gin("data")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_distilled_index" ON "${table}" ("distilled")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_distilled_vector_index" ON "${table}" USING hnsw("distilled_vector" vector_cosine_ops)`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_created_by_index" ON "${table}" ("created_by")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_updated_by_index" ON "${table}" ("updated_by")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_created_at_index" ON "${table}" ("created_at")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_updated_at_index" ON "${table}" ("updated_at")`,
        ]],
    };
};

const init = async (_clase) => {
    const [provider, result] = [await dbio.getProvider(), []];
    for (let act of getInitSql(_clase)[provider]) {
        result.push(await dbio.query(...act));
    }
    if (!initialized) {
        for (const func of extandable) {
            _[func] = async (...args) => await dbio[func](
                assertClass(args[0]), ...args.slice(1),
            );
        }
        initialized = true;
    }
    return result;
};

export {
    _NEED,
    _,
    init,
    newId,
};
