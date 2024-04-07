import { alan, dbio, uoid, utilitas } from 'utilitas';

const _NEED = ['mysql2', 'pg'];
const table = 'responds';

const getInitSql = async () => {
    return {
        [dbio.MYSQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ?? (
            \`id\`            VARCHAR(255) NOT NULL,
            \`object_id\`     VARCHAR(255) NOT NULL
            \`respond_type\`  VARCHAR(255) NOT NULL,
            \`respond_value\` VARCHAR(255) DEFAULT NULL,
            \`created_by\`    VARCHAR(255) NOT NULL,
            \`updated_by\`    VARCHAR(255) NOT NULL,
            \`created_at\`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY                  (\`id\`),
            INDEX          object_id     (\`object_id\`),
            INDEX          respond_type  (\`respond_type\`),
            INDEX          respond_value (\`respond_value\`),
            INDEX          created_by    (\`created_by\`),
            INDEX          updated_by    (\`updated_by\`),
            INDEX          created_at    (\`created_at\`),
            INDEX          updated_at    (\`updated_at\`),
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`), [table],
        ]],
        [dbio.POSTGRESQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS "${table}" (
            "id"            VARCHAR(255) NOT NULL,
            "object_id"     VARCHAR(255) NOT NULL,
            "respond_type"  VARCHAR(255) NOT NULL,
            "respond_value" VARCHAR(255) DEFAULT NULL,
            "created_by"    VARCHAR(255) NOT NULL,
            "updated_by"    VARCHAR(255) NOT NULL,
            "created_at"    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("id")
        )`)
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_object_id_index" ON "${table}" ("object_id")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_respond_type_index" ON "${table}" ("respond_type")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_respond_value_index" ON "${table}" ("respond_value")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_created_by_index" ON "${table}" ("created_by")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_updated_by_index" ON "${table}" ("updated_by")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_created_at_index" ON "${table}" ("created_at")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_updated_at_index" ON "${table}" ("updated_at")`,
        ], [
            `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_object_respond_creator_index" ON "${table}" ("object_id", "respond_type", "created_by")`,
        ]],
    };
};

const init = async (options) => {
    const result = [];
    if (~~process.env.FORKED === 1) {
        const provider = await dbio.getProvider();
        for (let act of (await getInitSql())[provider]) {
            result.push(await dbio.query(...act));
        }
    }
    return result;
};

const act = async (object_id, respond_type, respond_value, created_by) => {
    assert(object_id, 'Object ID is required.');
    assert(respond_type, 'Respond type is required.');
    assert(created_by, 'Creator is required.');
    return await dbio.uppsert(table, {
        object_id, respond_type, created_by, updated_by: created_by,
        respond_value: utilitas.isSet(respond_value, true) ? respond_value : null,
    });
};

export {
    _NEED,
    init,
    act,
};
