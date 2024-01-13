import { assertId, getType as userType, queryById } from './user.mjs';
import { dbio, uoid, utilitas } from 'utilitas';

const _NEED = ['mysql2', 'pg'];
const { __filename } = utilitas.__(import.meta.url);
const table = 'tokens';
const typeVerification = 'VERIFICATION';
const sec1Day = 60 * 60 * 24;
const sec7Days = sec1Day * 7;
const sec10Year = sec1Day * 365 * 10;
const getType = () => utilitas.basename(__filename).toUpperCase();
const newId = () => uoid.create({ type: getType(), security: 1 });
const assertToken = token => assert(token, 'Invalid token.', 401);
const buildRevoke = options => ({ expired_at: delay(options && options.delay) });
const revokeById = async (id, options) => await revoke('id', id, options);
const deleteById = async id => await dbio.deleteById(table, id);
const deleteAll = async options => await dbio.deleteAll(table, options);

const initSql = {
    [dbio.MYSQL]: [[
        dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ?? (
            \`id\`         VARCHAR(255) NOT NULL,
            \`user_id\`    VARCHAR(255) NOT NULL,
            \`type\`       VARCHAR(255) NOT NULL,
            \`created_at\` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`expired_at\` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            INDEX user_id    (\`user_id\`),
            INDEX type       (\`type\`),
            INDEX created_at (\`created_at\`),
            INDEX updated_at (\`updated_at\`),
            INDEX expired_at (\`expired_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`), [table],
    ]],
    [dbio.POSTGRESQL]: [[
        dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ${table} (
            id         VARCHAR(255) NOT NULL,
            user_id    VARCHAR(255) NOT NULL,
            type       VARCHAR(255) NOT NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expired_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )`)
    ], [
        `CREATE INDEX IF NOT EXISTS user_id ON ${table} (user_id)`,
    ], [
        `CREATE INDEX IF NOT EXISTS type ON ${table} (type)`,
    ], [
        `CREATE INDEX IF NOT EXISTS created_at ON ${table} (created_at)`,
    ], [
        `CREATE INDEX IF NOT EXISTS updated_at ON ${table} (updated_at)`,
    ], [
        `CREATE INDEX IF NOT EXISTS expired_at ON ${table} (expired_at)`,
    ]],
};

const assertTokenString = token => {
    assertToken(token = utilitas.trim(token));
    return token;
};

const assertType = type => {
    type = utilitas.trim(type, { case: 'UP' });
    assert(type, 'Invalid token type.', 400);
    return type;
};

const delay = (se, now) =>
    new Date((now || new Date()).getTime() + 1000 * (parseInt(se) || 0));

const create = async (tokenType, user_id, expireInSecond, options) => {
    const now = new Date();
    return dbio.insert(table, {
        id: newId(),
        user_id: assertId(user_id),
        type: assertType(tokenType),
        created_at: now,
        updated_at: now,
        expired_at: delay(expireInSecond || sec7Days, now),
    }, options);
};

const createForUser = async (user_id, options) =>
    await create(userType(), user_id, sec10Year, options);

const createForVerification = async (user_id, options) => {
    await revokeByUserIdAndType(user_id, typeVerification);
    return await create(typeVerification, user_id, sec7Days, options);
};

const getLatestByUserAndType = async (user_id, type) => {
    const sql = dbio.assembleQuery(table)
        + ' WHERE `user_id` = ? AND `type` = ?'
        + ' ORDER BY `created_at` DESC LIMIT 1';
    const val = [assertId(user_id), assertType(type)];
    const resp = await dbio.query(sql, val);
    return resp && resp.length ? resp[0] : null;
};

const getLatestVerificationByUser = async (user_id) =>
    await getLatestByUserAndType(user_id, typeVerification);

const verify = async (token, options) => {
    options = Object.assign(options || {}, { withExternalIdentity: true });
    token = assertTokenString(token);
    options.type = options.type ? assertType(options.type) : null;
    const sql = dbio.assembleQuery(table)
        + ' WHERE `id` = ? AND `expired_at` > ?';
    const resp = (await dbio.query(sql, [token, new Date()]))[0];
    assertToken(resp && (!options.type || options.type === resp.type));
    if (!options.skipUser) {
        assertToken(resp.user = await queryById(resp.user_id, options));
    }
    try {
        if (options.refresh) {
            const delayOpts = { delay: options.refresh };
            Object.assign(resp, buildRevoke(delayOpts));
            revokeById(token, delayOpts);
        }
    } catch (err) { console.log(err); }
    return resp;
};

const verifyForUser = async (token, options) => {
    options = { ...options || {}, type: userType(), refresh: sec10Year };
    return verify(token, options);
};

const verifyForVerification = async (token, opt) => {
    opt = { ...opt || {}, type: typeVerification, refresh: opt.refresh || 1 };
    return verify(token, opt);
};

const ensureAuthorization = async (ctx, next) => {
    assertToken(ctx.verification && ctx.verification.user);
    await next();
};

const revoke = async (key, value, options) => {
    options = options || {};
    return await dbio.updateByKeyValue(
        table, key, value, buildRevoke(options), { skipEcho: true }
    );
};

const revokeByUserId = async (user_id, options) =>
    await revoke('user_id', user_id, options);

const revokeByUserIdAndType = async (user_id, type, options) => {
    assertId(user_id);
    let { sql, values } = dbio.assembleUpdate(table, buildRevoke(options));
    sql += ` WHERE ${dbio.rawAssembleKeyValue('user_id', user_id)}`
        + ` AND ${dbio.rawAssembleKeyValue('type', type)}`;
    return await dbio.query(sql, [...values, user_id, type]);
};

const revokeVerificationByUserId = async (user_id, options) =>
    await revokeByUserIdAndType(user_id, typeVerification, options);

const cleanup = async () => {
    let placeholder;
    switch (dbio.getProvider()) {
        case dbio.MYSQL: placeholder = '?'; break;
        case dbio.POSTGRESQL: placeholder = '$1'; break;
    }
    const sql = `DELETE FROM ${table} WHERE expired_at < ${placeholder}`
    return await dbio.query(sql, ['NOW()']);
};

const init = async (options) => {
    if (~~process.env.FORKED === 1) {
        // Init database
        const [provider, result] = [await dbio.getProvider(), []];
        for (const act of initSql[provider]) {
            result.push(await dbio.query(...act));
        }
        // console.log(result);
    }
};

export {
    _NEED,
    assertToken,
    cleanup,
    create,
    createForUser,
    createForVerification,
    deleteAll,
    deleteById,
    ensureAuthorization,
    getLatestByUserAndType,
    getLatestVerificationByUser,
    init,
    revoke,
    revokeById,
    revokeByUserId,
    revokeByUserIdAndType,
    revokeVerificationByUserId,
    verify,
    verifyForUser,
    verifyForVerification,
};
