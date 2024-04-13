import { dbio, uoid, utilitas } from 'utilitas';

const _NEED = ['mysql2', 'pg'];
const table = 'responds';
const classes = new Set();
const newId = async () => uoid.create({ type: 'RESPOND' });
const uniqueKeys = '"object_class", "object_id", "respond_type", "created_by"';
const HIDDEN = 'HIDDEN';

const getInitSql = async () => {
    return {
        [dbio.MYSQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ?? (
            \`id\`            VARCHAR(255) NOT NULL,
            \`object_class\`  VARCHAR(255) NOT NULL,
            \`object_id\`     VARCHAR(255) NOT NULL
            \`respond_type\`  VARCHAR(255) NOT NULL,
            \`respond_value\` VARCHAR(255) DEFAULT NULL,
            \`created_by\`    VARCHAR(255) NOT NULL,
            \`updated_by\`    VARCHAR(255) NOT NULL,
            \`created_at\`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY                  (\`id\`),
            INDEX          object_class  (\`object_class\`),
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
            "object_class"  VARCHAR(255) NOT NULL,
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
            `CREATE INDEX IF NOT EXISTS "${table}_object_class_index" ON "${table}" ("object_class")`,
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
            `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_object_respond_creator_index" ON "${table}" (${uniqueKeys})`,
        ]],
    };
};

const init = async (_classes, options) => {
    _classes = Object.keys(_classes || {});
    assert(_classes?.length, 'Classes allowed to respond can not be empty.');
    _classes.map(x => classes.add(utilitas.trim(x, { case: 'UP' })));
    const result = [];
    if (~~process.env.FORKED === 1) {
        const provider = await dbio.getProvider();
        for (let act of (await getInitSql())[provider]) {
            result.push(await dbio.query(...act));
        }
    }
    return result;
};

const pack = data => {
    data.respond_value = utilitas.parseJson(data.respond_value, null);
    return data;
};

const act = async (object_class, object_id, respond_type, respond_value, created_by) => {
    [object_class, respond_type, respond_value] = [
        utilitas.trim(object_class, { case: 'UP' }),
        utilitas.trim(respond_type, { case: 'UP' }),
        utilitas.isSet(respond_value, true) ? JSON.stringify(respond_value) : null,
    ];
    assert(object_class && object_id, 'Object class and id are required.', 400);
    assert(classes.has(object_class), 'Object is not allowed to respond.', 400);
    assert(respond_type, 'Respond type is required.', 400);
    assert(created_by, 'Creator is required.', 400);
    return pack(await dbio.upsert(table, {
        id: await newId(), object_class, object_id, respond_type, respond_value,
        created_by, updated_by: created_by,
    }, { key: uniqueKeys }));
};

const hidden = async (object_class, object_id, created_by, hidden) =>
    await act(object_class, object_id, HIDDEN, !!hidden, created_by);

const queryByClassAndCreator = async (object_class, object_id, created_by, options) => {
    const resp = await dbio.queryByKeyValue(table, { object_class, object_id, created_by });
    return resp.map(pack);
};

export {
    _NEED,
    HIDDEN,
    act,
    hidden,
    init,
    queryByClassAndCreator,
    table,
};
