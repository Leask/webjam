import { alan, dbio, uoid, utilitas } from 'utilitas';
import { queryById as queryUserById } from './user.mjs';

const _NEED = ['mysql2', 'pg'];
const _ = {};
const [ORDERS, SORTS] = [['created_at', 'updated_at'], ['ASC', 'DESC']];
const [MAX_LIMIT, DEFAULT_LIMIT] = [1000, 10];
const newId = async _clase => uoid.create({ type: await assertClass(_clase) });
const log = content => utilitas.log(content, import.meta.url);

const extandable = [
    'countByKeyValue', 'deleteAll', 'deleteByKeyValue', 'desc', 'drop',
    'indexes', 'queryAll', 'queryByKeyValue', 'updateByKeyValue', 'upsert',
];

const getClasses = async () => (await dbio.tables()).filter(
    x => x.startsWith('meta_')
).map(x => x.replace(/^meta_/, ''));

const assertClass = async (_clase, options) => {
    const _class = utilitas.ensureString(_clase, { case: 'SNAKE' });
    assert(_class && (
        options?.quick || (await getClasses()).includes(_class)
    ), 'Invalid class.', 400);
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
            \`status\`           VARCHAR(255) DEFAULT NULL,
            \`shared\`           TINYINT(1)   NOT NULL DEFAULT 0,
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
            INDEX          status      (\`status\`),
            INDEX          shared      (\`shared\`),
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
            "status"           VARCHAR(255) DEFAULT NULL,
            "shared"           SMALLINT     NOT NULL DEFAULT 0,
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
            `CREATE INDEX IF NOT EXISTS "${table}_status_index" ON "${table}" ("status")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_data_index" ON "${table}" USING gin("data")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_shared_index" ON "${table}" ("shared")`,
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

const vectorize = async (fields, cur) => {
    if ((fields.distilled = utilitas.trim(fields?.distilled))
        && (!fields?.distilled_vector || !fields.distilled_vector?.length)
        && (!cur || cur.distilled !== fields.distilled)) {
        try {
            fields.distilled_vector = await alan.createOpenAIEmbedding(
                fields.distilled
            );
        } catch (err) {
            assert(
                err.message.includes('AI engine has not been initialized.'),
                err.message, 500
            );
            log(`WARNING: ${err.message}`);
        }
    }
    return fields;
};

const handleError = err => err.message.includes('duplicate key')
    ? utilitas.throwError('Duplicate meta.', 409) : utilitas.throwError(err);

const packMeta = async (fields, options) => {
    assert(fields, 'Meta Not Found', 404);
    if (!options?.raw) {
        delete fields.distilled_vector;
        [fields.created_by, fields.updated_by] = await Promise.all([
            fields.created_by, fields.updated_by
        ].map(async x => await utilitas.ignoreErrFunc(
            async () => await queryUserById(x)
        ) || { id: x, deleted: true }));
    }
    return fields;
};

const insert = async (_clase, fields, created_by, options) => {
    const table = await assertClass(_clase);
    assert(fields.name = utilitas.ensureString(
        fields?.name, { trim: true }
    ), 'Invalid data.', 400);
    assert(created_by, 'Invalid `created_by`.', 500);
    await vectorize(fields);
    let resp;
    try {
        resp = await dbio.insert(table, {
            ...cleanMeta(fields),
            id: await newId(_clase),
            created_by: created_by,
            updated_by: created_by,
        }, options);
    } catch (err) { handleError(err); }
    return await packMeta(resp, options);
};

const queryById = async (_clase, id, userId, options) => {
    const table = options?.table || await assertClass(_clase);
    assert(userId, 'Invalid `userId`.', 500);
    return await packMeta(await dbio.queryOne(
        dbio.assembleQuery(table)
        + ` WHERE "id" = $1 AND ("created_by" = $2 OR "shared" > $3)`,
        [id, userId, options?.shared || 0]
    ), options);
};

const updateById = async (_clase, id, fields, updated_by, options) => {
    const table = await assertClass(_clase)
    const cur = await queryById(
        null, id, updated_by, { table, shared: 1, raw: true }
    );
    delete fields.created_by;
    await vectorize(fields, cur);
    let resp;
    try {
        resp = await dbio.updateById(table, id, {
            ...cleanMeta(fields), updated_by,
        }, options);
    } catch (err) { handleError(err); }
    return await packMeta(resp, options);
};

const deleteById = async (_clase, id, userId, options) => {
    const table = await assertClass(_clase);
    assert(userId, 'Invalid `userId`.', 500);
    const resp = await dbio.execute(
        `DELETE FROM ${table} WHERE "id" = $1`
        + ` AND ("created_by" = $2 OR "shared" > $3)`,
        [id, userId, 2], options
    );
    assert(resp?.rowCount, 'Meta Not Found', 404)
    return resp;
};

const query = async (_clase, userId, options) => {
    const table = await assertClass(_clase);
    const { concept, order, sort, limit, offset } = {
        concept: utilitas.ensureString(options?.concept, { trim: true }),
        order: options?.order || 'created_at',
        sort: options?.sort || 'ASC',
        limit: parseInt(options?.limit) || DEFAULT_LIMIT,
        offset: parseInt(options?.offset) || 0,
    };
    assert(userId, 'Invalid `userId`.', 500);
    assert(ORDERS.includes(order), 'Invalid order.', 400);
    assert(SORTS.includes(sort), 'Invalid order.', 400);
    assert(0 < limit && limit <= MAX_LIMIT, 'Invalid limit.', 400);
    const whereKey = ` WHERE "created_by" = $1 OR "shared" > $2 `;
    const [whereValCount, whereValQuery] = [[userId, 0], [userId, 0]];
    let orderOpts = { [order]: sort };
    if (concept) {
        orderOpts = { 'distilled_vector <-> $3': 'VECTOR' };
        whereValQuery.push(await dbio.encodeVector(
            await alan.createOpenAIEmbedding(concept)
        ));
    }
    const [cResp, resp] = await Promise.all([[
        dbio.assembleQuery(table, { fields: 'COUNT("id")' }) + whereKey,
        whereValCount,
    ], [
        dbio.assembleQuery(table) + whereKey
        + dbio.assembleTail({ order: orderOpts, limit, offset }),
        whereValQuery,
    ]].map(x => dbio.query(...x)));
    for (const i in resp) { resp[i] = await packMeta(resp[i], options); }
    const total = parseInt(cResp[0]['count']);
    return {
        pagination: {
            total, order, sort, limit, offset,
            more: offset + resp.length < total,
        }, meta: resp,
    };
};

const init = async (any, options) => {
    String.isString(any) && (any = { [any]: options });
    const result = [];
    for (const _clase in any) {
        if (~~process.env.FORKED === 1) {
            const provider = await dbio.getProvider();
            for (let act of (await getInitSql(_clase))[provider]) {
                result.push(await dbio.query(...act));
            }
        }
        if (!Object.keys(_).length) {
            for (const func in extandable) {
                _[func] = async (...args) => await dbio[func](
                    await assertClass(args[0]), ...args.slice(1),
                );
            }
        }
    }
    return result;
};

export {
    _NEED,
    _,
    assertClass,
    deleteById,
    getClasses,
    init,
    insert,
    newId,
    query,
    queryById,
    updateById,
};
