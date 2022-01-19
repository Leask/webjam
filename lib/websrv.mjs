import { fileURLToPath } from 'url';
import { userAgent } from 'koa-useragent';
import { utilitas, dbio, email, colors, encryption, tape } from 'utilitas';
import * as auth from './identity.mjs';
import * as file from './file.mjs';
import * as router from './router.mjs';
import * as service from './service.mjs';
import * as tracing from './tracing.mjs';
import * as user from './user.mjs';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import http from 'http';
import json from 'koa-json';
import Koa from 'koa';
import logger from 'koa-logger';
import session from 'koa-session';

const __filename = fileURLToPath(import.meta.url);
const httpPort = 8080;
const log = (str, opts) => { return utilitas.modLog(str, __filename, opts); };

const initSession = async (options, app) => {
    options = options || {};
    // https://github.com/koajs/session
    const config = utilitas.mergeAtoB(options.config || {}, {
        key: `${websrv.name}.sess`, /** (string) cookie key (default is ${package.name}.sess) */
        /** (number || 'session') maxAge in ms (default is 1 days) */
        /** 'session' will result in a cookie that expires when session/browser is closed */
        /** Warning: If a session cookie is stolen, this cookie will never expire */
        maxAge: 86400000,
        autoCommit: true, /** (boolean) automatically commit headers (default true) */
        overwrite: true, /** (boolean) can overwrite or not (default true) */
        httpOnly: true, /** (boolean) httpOnly or not (default true) */
        signed: true, /** (boolean) signed or not (default true) */
        rolling: false, /** (boolean) Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) */
        renew: false, /** (boolean) renew session when session is nearly expired, so we can always keep user logged in. (default is false)*/
        // secure: true, /** (boolean) secure cookie*/ // https://github.com/koajs/koa/issues/974
        sameSite: null, /** (string) session cookie sameSite options (default null, don't set it) */
    });
    app.keys = utilitas.ensureArray(options.keys
        || encryption.digestObject(config));
    app.use(session(config, app));
};

const initGoogleCloud = async (options) => {
    options = options || {};
    if (options.credentials) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = options.credentials;
    }
};

/**
 * @param {*} options
 *   controllerPath: 'controllers',
 *   prefix: '/api/v1'
 *   publicPath: ['absPathA', 'absPathB']
 *   storagePath: 'absPathC'
 */
const rawInit = async (options, callback) => {
    options = options || {};
    const start = options.hrtime || process.hrtime();
    global.debug = options.debug;
    global.websrv = await utilitas.which();
    if (options.tape) { await tape.init(options.tape); }
    if (options.tracing) { await tracing.init(options.tracing); }
    log(`${websrv.title} is launching...`, { time: true });
    websrv.port = options.port || httpPort;
    websrv.listen = `http://localhost:${websrv.port}`;
    websrv.origin = options.origin || websrv.listen;
    websrv.app = new Koa();
    websrv.app.proxy = options.proxy ?? websrv.origin !== websrv.listen;
    if (options.database) { await dbio.init(options.database); }
    if (options.email) { await email.init(options.email); }
    if (options.user) { await user.init(options.user); }
    if (options.identity) { await auth.init(options.identity, websrv.app); }
    if (options.googleCloud) { await initGoogleCloud(options.googleCloud); }
    if (options.tracing) { await tracing.init(options.tracing, websrv.app); }
    await file.init(options.file);
    await service.init(options);
    await initSession(options.session, websrv.app);
    const objRouter = await router.init(options);
    websrv.app.use(logger((str, args) => { log(str.trim(), { time: true }); }));
    websrv.app.use(bodyParser());
    websrv.app.use(json());
    websrv.app.use(cors());
    websrv.app.use(userAgent);
    websrv.app.use(objRouter.routes()).use(objRouter.allowedMethods());
    websrv.server = http.createServer(websrv.app.callback());
    websrv.service = websrv.server.listen(websrv.port, callback);
    const duration = Math.round(process.hrtime(start)[1] / 1000000 / 10) / 100;
    log(`Listening at ${websrv.app.proxy ? `${colors.green(websrv.origin)} => `
        : ''}${colors.green(websrv.listen)} .`);
    log(`Successfully launched within ${colors.yellow(duration)} seconds.`);
    return websrv;
};

const init = async (options) => {
    try { await rawInit(options); } catch (err) { console.error(err); }
};

const end = async () => {
    try {
        websrv && websrv.service && websrv.service.close();
        log('Terminated.');
    } catch (e) { console.error(e); }
    try { await service.end(); } catch (e) { console.error(e); }
    try { await dbio.end(); } catch (e) { console.error(e); }
    try { await tape.end(); } catch (e) { console.error(e); }
};

export {
    init,
    end,
};
