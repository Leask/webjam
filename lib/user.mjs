import { dbio, email, encryption, uoid, uuid, utilitas } from 'utilitas';
import { init as initToken } from './token.mjs';

import {
    createForUser, createForVerification,
    getLatestVerificationByUser, verifyForVerification
} from './token.mjs';

const _NEED = ['mysql2', 'pg'];
const [table, typeEmail, typePassword] = ['users', 'EMAIL', 'PASSWORD'];
const secretFields = ['password', 'salt'];
const extIdentityFields = ['email', 'phone'];
const getType = () => utilitas.basename(import.meta.url).toUpperCase();
const newId = () => uoid.create({ type: getType() });
const log = (str, opts) => utilitas.log(str, import.meta.url, opts);
const assertPassword = (p, m, s) => assert(p, m || 'Invalid password.', s || 400);
const deleteById = async (id) => await dbio.deleteById(table, id);
const deleteAll = async (options) => await dbio.deleteAll(table, options);

const initSql = {
    [dbio.MYSQL]: [[
        dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ?? (
            \`id\`                VARCHAR(255) NOT NULL,
            \`email\`             VARCHAR(255) DEFAULT NULL,
            \`password\`          VARCHAR(255) DEFAULT NULL,
            \`salt\`              VARCHAR(255) DEFAULT NULL,
            \`name\`              VARCHAR(255) DEFAULT NULL,
            \`avatar\`            VARCHAR(255) DEFAULT NULL,
            \`bio\`               VARCHAR(255) DEFAULT NULL,
            \`email_verified_at\` TIMESTAMP    DEFAULT NULL,
            \`created_at\`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY                   (\`id\`),
            UNIQUE  KEY name              (\`name\`),
            UNIQUE  KEY email             (\`email\`),
            INDEX       password          (\`password\`),
            INDEX       salt              (\`salt\`),
            INDEX       avatar            (\`avatar\`),
            INDEX       bio               (\`bio\`),
            INDEX       email_verified_at (\`email_verified_at\`),
            INDEX       created_at        (\`created_at\`),
            INDEX       updated_at        (\`updated_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`), [table],
    ]],
    [dbio.POSTGRESQL]: [[
        dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ${table} (
            id                VARCHAR(255) NOT NULL,
            email             VARCHAR(255) DEFAULT NULL,
            password          VARCHAR(255) DEFAULT NULL,
            salt              VARCHAR(255) DEFAULT NULL,
            name              VARCHAR(255) DEFAULT NULL,
            avatar            VARCHAR(255) DEFAULT NULL,
            bio               VARCHAR(255) DEFAULT NULL,
            email_verified_at TIMESTAMP    DEFAULT NULL,
            created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )`),
    ], [
        `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_name_index ON ${table} (name)`,
    ], [
        `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_email_index ON ${table} (email)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_password_index ON ${table} (password)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_salt_index ON ${table} (salt)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_avatar_index ON ${table} (avatar)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_bio_index ON ${table} (bio)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_email_verified_at_index ON ${table} (email_verified_at)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_created_at_index ON ${table} (created_at)`,
    ], [
        `CREATE INDEX IF NOT EXISTS ${table}_updated_at_index ON ${table} (updated_at)`,
    ]],
};

let systemSalt = null;
let verificationThreshold = 60 * 1; // 1 minutes
let verificationMailRender = null;

const init = async (options) => {
    if (options) {
        systemSalt = utilitas.trim(options.encryptionSalt);
        assert(systemSalt, 'Invalid encryption salt.', 500);
        verificationThreshold = parseInt(options.verificationThreshold) || 0;
        verificationMailRender = options.verificationMailRender;
        if (~~process.env.FORKED === 1) {
            // Init database
            const [provider, result] = [await dbio.getProvider(), []];
            for (const act of initSql[provider]) {
                result.push(await dbio.query(...act));
            }
            // console.log(result);
            if (!options.silent) { log('Initialized.'); }
        }
        await initToken(options);
    }
};

const saltPassword = (password, salt) => {
    salt = salt || encryption.randomString(128);
    return { salt, password: encryption.sha256(password + salt + systemSalt) };
};

const assertId = (id, msg = 'Invalid user id.', status = 400, options = {}) => {
    assert(id = utilitas.trim(id), msg, status, options);
    return id;
};

const assertUser = (user, message, status, opts) => {
    message = message || 'User not found';
    status = status || 404;
    (opts && opts.ignore404) || assert(user, message, status, opts);
};

const handle501Error = (error) => {
    if (error.status !== 501) { console.log(error); return error; };
};

const handleDupEntryError = (error) => {
    assert(error.code !== 'ER_DUP_ENTRY', 'Duplicated name or email.', 400);
    utilitas.throwError(error.message, 400);
};

const validateUser = async (data, options) => {
    options = options || {};
    const errInvalid = 'Invalid user data.';
    assert(data, errInvalid, 400);
    const now = new Date();
    const email = data.email ? utilitas.trim(data.email) : null;
    const name = data.name ? utilitas.trim(data.name) : null;
    const avatar = data.avatar ? utilitas.trim(data.avatar) : null;
    const bio = data.bio ? utilitas.trim(data.bio) : null;
    const password = data.password ? String(data.password || '') : null;
    const result = {};
    if (name) { result.name = name; }
    if (avatar) { result.avatar = avatar; }
    if (bio) { result.bio = bio; }
    switch (utilitas.trim(options.mode, { case: 'UP' })) {
        case 'CREATE':
            utilitas.assertEmail(result.email = email);
            assertPassword(password);
            Object.assign(result, saltPassword(password), {
                id: newId(), created_at: now, email_verified_at: null,
            });
            break;
        case 'AUTH':
            utilitas.assertEmail(result.email = email);
            Object.assign(result, {
                id: newId(), created_at: now,
                email_verified_at: result.email ? now : null,
            });
            break;
        case 'UPDATE':
            const curUser = options.curUser
                || await queryById(options.user_id, { asPlain: true });
            assert(curUser, errInvalid, 500);
            if (email && !utilitas.insensitiveCompare(curUser.email, email)) {
                utilitas.assertEmail(result.email = email);
                result.email_verified_at = null;
            }
            break;
        case 'VERIFIED':
            result.email_verified_at = now;
            break;
        case 'PASSWORDANDVERIFIED':
            result.email_verified_at = now;
        case 'PASSWORD':
            assertPassword(password);
            Object.assign(result, saltPassword(password));
            break;
        default:
            utilitas.throwError('Invalid validation type.', 500);
    }
    assert(Object.keys(result).length, errInvalid, 400);
    result.updated_at = now;
    return result;
};

const deleteField = (data, filter) =>
    filter.map((field) => { try { delete data[field]; } catch (e) { } });

const packUser = (data, options) => {
    options = options || {};
    if (!data) { return data; }
    data.displayName = data.name || data.email.replace(/@.*/, '') || data.id;
    if (!options.asPlain) {
        deleteField(data, [...secretFields,
        ...(options.withExternalIdentity ? [] : extIdentityFields)]);
    }
    return data;
};

const checkVerificationRequired = async (email, options) => {
    options = options || {};
    const user = options.user || await queryByEmail(email, options);
    assert(options.force
        || !user.email_verified_at, 'No verification required.', 400);
    const curToken = await getLatestVerificationByUser(user.id);
    const limited = curToken ? (curToken.created_at.getTime(
    ) + 1000 * verificationThreshold > new Date().getTime()) : false;
    assert(options.ignoreThreshold
        || !limited, 'Too many request.', 429);
    return {
        user, curToken, required: !user.email_verified_at,
        verificationThreshold, limited
    };
};

const rawSendVerificationEmail = async (add, type, options) => {
    options = options || {};
    if ((type = utilitas.trim(type, { case: 'UP' }) !== typeEmail)) {
        options.force = true;
    }
    const resp = await checkVerificationRequired(add, options);
    resp.newToken = await createForVerification(resp.user.id, options);
    resp.type = type;
    resp.senderName = email.getSenderName();
    let { subject, text, html } = verificationMailRender
        ? await verificationMailRender(resp) : [null, null, null];
    if (!verificationMailRender) {
        switch (resp.type) {
            case typeEmail:
                subject = 'Email Verification';
                break;
            case typePassword:
                subject = 'Password Recovery';
                break;
            default:
                subject = 'Verification';
        }
        text = [
            `Hi, ${resp.user.displayName}:`,
            `Your ${subject} token is: \`${resp.newToken.id}\`.`,
            `This token will expire at ${resp.newToken.expired_at}.`,
            resp.senderName
        ].join('\n\n');
        subject = `${resp.senderName} ${subject}`;
    }
    resp.email = await email.send(add, subject, text, html, null, options);
    return resp;
};

const sendVerificationEmail = async (add, options) =>
    await rawSendVerificationEmail(add, typeEmail, options);

const sendPasswordRecoveryEmail = async (add, options) =>
    await rawSendVerificationEmail(add, typePassword, options);

const create = async (data, options) => {
    options = options || {};
    data = await validateUser(data, { mode: options.mode || 'CREATE' });
    try {
        return packUser(await dbio.insert(table, data, options), options);
    } catch (err) { handleDupEntryError(err); }
};

const updateById = async (id, data, options) => {
    options = Object.assign(options || {}, { withExternalIdentity: true });
    assertId(id);
    data = await validateUser(data, {
        mode: options.mode || 'UPDATE', curUser: options.curUser, user_id: id
    });
    let user = null;
    try {
        options.user = user = packUser(await dbio.updateById(
            table, id, data, options
        ), options);
    } catch (err) { handleDupEntryError(err); }
    try {
        data.email && !options.skipVerify
            && await sendVerificationEmail(user.email, options);
    } catch (err) { handle501Error(err); }
    return user;
};

const changePasswordById = async (id, password, options) => {
    options = Object.assign(options || {}, { mode: 'PASSWORD' });
    return await updateById(id, { password }, options);
};

const changePasswordByEmailAndPassword = async (
    email, curPassword, newPassword, options
) => {
    let { user } = await signin(email, curPassword, { verifyOnly: true });
    user = await changePasswordById(user.id, newPassword, { asPlain: true });
    return await rawSignin(user, options);
};

const changePasswordByVerificationToken = async (strTkn, password, options) => {
    const resp = await verifyForVerification(strTkn, { skipUser: true });
    const user = await updateById(resp.user_id, { password }, {
        mode: 'PASSWORDANDVERIFIED', asPlain: true
    });
    return await rawSignin(user, options);
};

const verifyEmail = async (strToken, options) => {
    const resp = await verifyForVerification(strToken, { skipUser: true });
    const user = await updateById(resp.user_id, {
    }, { mode: 'VERIFIED', asPlain: true });
    return await rawSignin(user, options);
};

const queryById = async (id, options) => {
    const resp = await dbio.queryById(table, id, options);
    assertUser(resp, null, null, options);
    return packUser(resp, options);
};

const queryByKeyValue = async (key, value, options) => {
    const resp = await dbio.queryByKeyValue(table, key, value, options);
    if (Array.isArray(resp)) {
        return resp.map((user) => { return packUser(user, options); });
    }
    assertUser(resp, null, null, options);
    return packUser(resp, options);
};

const queryByEmail = async (email, options) => {
    options = Object.assign(options || {}, { unique: true });
    utilitas.assertEmail(email);
    return await queryByKeyValue('email', email, options);
};

const queryByName = async (name, options) => {
    options = Object.assign(options || {}, { unique: true });
    return await queryByKeyValue('name', name, options);
};

const verifyUserId = (str) => {
    const arId = utilitas.ensureString(str).split('|');
    return arId[0].toUpperCase() === getType() && uuid.validate(arId[1]);
}

const queryByIdOrEmail = async (str, options) => {
    if (verifyUserId(str)) {
        return await queryById(str, options);
    } else if (utilitas.verifyEmail(str)) {
        return await queryByEmail(str, options);
    }
    utilitas.throwError('Invalid id or email.', 400);
};

const signup = async (data, options) => {
    options = options || {};
    const user = options.user = await create(data, { asPlain: true });
    try {
        !options.skipVerify && await sendVerificationEmail(user.email, options);
    } catch (err) { handle501Error(err); }
    return await rawSignin(user, options);
};

const rawSignin = async (user, options) => {
    options = Object.assign(options || {}, { withExternalIdentity: true });
    user = packUser(user, options);
    const auth = await createForUser(user.id, options);
    return { user, token: auth };
};

const signin = async (str, password, options) => {
    options = options || {};
    const user = await queryByIdOrEmail(str, { asPlain: true });
    if (!options.authorized) {
        const { password: hashedPswd } = saltPassword(password, user.salt);
        assert(user.password === hashedPswd, 'Invalid password.', 400);
    }
    return options.verifyOnly ? { user } : await rawSignin(user, options);
};

export {
    _NEED,
    assertId,
    changePasswordByEmailAndPassword,
    changePasswordById,
    changePasswordByVerificationToken,
    create,
    deleteAll,
    deleteById,
    getType,
    init,
    queryByEmail,
    queryById,
    queryByIdOrEmail,
    queryByKeyValue,
    queryByName,
    rawSendVerificationEmail,
    rawSignin,
    sendPasswordRecoveryEmail,
    sendVerificationEmail,
    signin,
    signup,
    updateById,
    verifyEmail,
};
