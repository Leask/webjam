import { dbio, uoid, utilitas } from 'utilitas';

const _NEED = ['mysql2', 'pg'];
const _ = {};
const newId = async _clase => uoid.create({ type: await assertClass(_clase) });

const getClasses = async () => (await dbio.tables()).filter(
    x => x.startsWith('meta_')
).map(x => x.replace(/^meta_/, ''));

const assertClass = async (_clase, options) => {
    const _class = utilitas.ensureString(_clase, { case: 'SNAKE' });
    assert(_class && (
        options?.quick || (await getClasses()).includes(_class)
    ), 'Invalid class.');
    return `meta_${_class}`;
};

const getInitSql = async (_clase) => {
    const table = await assertClass(_clase, { quick: true });
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
        ], [
            `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_name_created_by_index" ON "${table}" ("name", "created_by")`,
        ]],
    };
};

const cleanMeta = fields => {
    delete fields.id;
    delete fields.created_at;
    delete fields.updated_at;
    return fields;
};

const insert = async (_clase, fields, options) => {
    const table = await assertClass(_clase);
    assert(fields.name = utilitas.ensureString(
        fields?.name, { trim: true }
    ), 'Invalid data.', 400);
    return await dbio.insert(table, {
        ...cleanMeta(fields), id: await newId(_clase),
    }, options);
};

const updateById = async (_clase, id, fields, options) => {
    const table = await assertClass(_clase)
    delete fields.created_by;
    return await dbio.updateById(table, id, cleanMeta(fields), options);
};

const extandable = {
    countByKeyValue: null, deleteAll: null, deleteById: null,
    deleteByKeyValue: null, desc: null, drop: null, indexes: null, insert,
    queryAll: null, queryById: null, queryByKeyValue: null, updateById,
    updateByKeyValue: null, upsert: null,
};

const init = async (_clase) => {
    const result = [];
    if (~~process.env.FORKED === 1) {
        const provider = await dbio.getProvider();
        for (let act of (await getInitSql(_clase))[provider]) {
            result.push(await dbio.query(...act));
        }
    }
    if (!Object.keys(_).length) {
        for (const func in extandable) {
            _[func] = extandable[func] || (async (...args) => await dbio[func](
                await assertClass(args[0]), ...args.slice(1),
            ));
        }
    }
    return result;
};

export {
    _NEED,
    _,
    getClasses,
    init,
    newId,
};
