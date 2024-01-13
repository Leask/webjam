import { create, queryByIdOrEmail, queryByName, rawSignin } from './user.mjs';
import { dbio, encryption, uoid, utilitas } from 'utilitas';

const _NEED = ['mysql2', 'koa-passport', 'passport-twitter'];
const successRedirect = '/home';           // Remove successRedirect if you want
const failureRedirect = '/signin?error=authfailed';     // to run custom routes.
const authOptions = { /* successRedirect, */ failureRedirect };
const userOptions = { asPlain: true, ignore404: true };
const wthOgn = { withOrigin: true };
const table = 'identities';
const log = content => utilitas.log(content, import.meta.url);

const [sDefault, sTwitter, sFacebook, sGoogle]
    = ['passport', 'twitter', 'facebook', 'google'];

const commonFields = [
    'id', 'user_id', 'provider', 'account', 'username', 'fullName',
    'email', 'avatar', 'bio', 'created_at', 'updated_at'
];

const strategies = {
    [sDefault]: { package: 'koa-passport' },
    [sTwitter]: { package: 'passport-twitter', strategy: 'Strategy' },
    // [sFacebook]: { package: 'passport-facebook', strategy: 'Strategy' },
    // [sGoogle]: { package: 'passport-google-oauth20', strategy: 'Strategy' },
};

const newId = (provider, id) =>
    uoid.create({ file: import.meta.url, id: `${id}@${provider}` });

const queryById = async (id, options) => {
    options = options || {};
    options.fields || (options.fields = commonFields);
    return await dbio.queryById(table, id, options);
};

const upsertIdentity = async (identity, options) => {
    let { sql, values } = dbio.assembleInsert(table, identity);
    const id = identity.id;
    delete identity.id;
    delete identity.created_at;
    const { sql: updSql, values: updValues } = dbio.assembleSet(identity);
    sql += ` ON DUPLICATE KEY UPDATE${updSql.replace(/^SET/, '')}`;
    await dbio.execute(sql, [...values, ...updValues]);
    const resp = await queryById(id, options);
    assert(resp, 'Error updating identity.', 500);
    return resp;
};

const updateById = async (id, data, options) => {
    options = options || {};
    options.fields || (options.fields = commonFields);
    data = data || {};
    data.updated_at = new Date();
    return await dbio.updateById(table, id, data, options);
};

const linkUser = async (identityId, user_id, options) =>
    await updateById(identityId, { user_id }, options);

const handleCallback = (rawIdentity, callback) => {
    (async () => {
        let identity = await upsertIdentity(rawIdentity);
        let cUser = null;
        if (identity.user_id || identity.email) {
            const idOrEmail = identity.user_id || identity.email;
            cUser = await queryByIdOrEmail(idOrEmail, userOptions);
        }
        if (!cUser) {
            const nck = await queryByName(identity.username, userOptions);
            const name = identity.username
                + (nck ? `.${encryption.randomString(4)}` : '');
            const nUser = Object.assign({ name }, identity);
            cUser = await create(nUser, { mode: 'AUTH', asPlain: true });
        }
        if (!identity.user_id) {
            identity = await linkUser(identity.id, cUser.id);
        }
        const resp = Object.assign({ identity }, await rawSignin(cUser));
        callback(null, resp);
    })();
};

const initStrategy = {
    [sTwitter]: async (opt) => {
        opt = opt || {};
        assert(opt.consumerKey, 'Twitter Key is required.', 400);
        assert(opt.consumerSecret, 'Twitter Secret is required.', 400);
        utilitas.isUndefined(opt.includeEmail) && (opt.includeEmail = true);
        opt.callbackURL = opt.callbackURL || getCallbackUrl(sTwitter, wthOgn);
        (await getPassport()).use(new (await getPassport(sTwitter))(opt,
            (token, tokenSecret, profile, callback) => {
                const created_at = new Date();
                handleCallback({
                    id: newId(sTwitter, profile.id),
                    provider: sTwitter,
                    account: profile.id,
                    username: profile.username || null,
                    fullName: profile.displayName || null,
                    email: profile._json.email || null,
                    avatar: profile.photos && profile.photos.length
                        ? profile.photos[0].value : null,
                    bio: profile._json.description || null,
                    profile: profile._raw,
                    keys: JSON.stringify({ token, tokenSecret, created_at }),
                    created_at,
                    updated_at: created_at,
                }, callback);
            }
        ));
        strategies[sTwitter].options = opt.options || authOptions;
    },
};

const assertProvider = (prvdr) => {
    prvdr = utilitas.trim(prvdr, { case: 'LOW' });
    assert(strategies[prvdr], `Invalid strategy: '${prvdr}'.`, 400);
    return prvdr;
};

const getPassport = async (provider = sDefault) => {
    if (!strategies[provider = assertProvider(provider)].module) {
        const load = await utilitas.need(strategies[provider].package);
        strategies[provider].module = strategies[provider].strategy
            ? load[strategies[provider].strategy] : load;
        assert(strategies[provider].module,
            `Error loading passport strategy: '${provider}'.`, 500);
        ~~process.env.FORKED === 1 && log(`Initialized: ${provider}.`);
    }
    return strategies[provider].module;
};

const getApiRoot = (opt) =>
    `${opt && opt.withOrigin ? `${webjam.origin}/` : ''}api/identities/`;

const getAuthUrl = (provider, options) =>
    `${getApiRoot(options)}${assertProvider(provider)}/signin`;

const getCallbackUrl = (provider, options) =>
    `${getApiRoot(options)}${assertProvider(provider)}/callback`;

const authenticate = async (provider) =>
    strategies[sDefault].module && await (await getPassport(
    )).authenticate(assertProvider(provider), strategies[provider].options);

const init = async (options, app) => {
    options = options || {};
    for (let provider in strategies) {
        options[provider] && await initStrategy[provider](options[provider]);
    }
    (await getPassport()).serializeUser((obj, cbf) => { cbf(null, obj); });
    (await getPassport()).deserializeUser((obj, cbf) => { cbf(null, obj); });
    app.use((await getPassport()).initialize());
    app.use((await getPassport()).session());
};

export {
    _NEED,
    sFacebook,
    sGoogle,
    sTwitter,
    successRedirect,
    assertProvider,
    authenticate,
    getAuthUrl,
    getCallbackUrl,
    getPassport,
    init,
};
