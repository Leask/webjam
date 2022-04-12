import { color, dbio, email, encryption, tape, utilitas } from 'utilitas';
import { createServer } from 'http';
import { init as initFile } from './file.mjs';
import { init as initIdentity } from './identity.mjs';
import { init as initRobot } from './robot.mjs';
import { init as initRouter } from './router.mjs';
import { init as initService, end as endService } from './service.mjs';
import { init as initSplunk } from './splunk.mjs';
import { init as initTracing } from './tracing.mjs';
import { init as initUser } from './user.mjs';
import { userAgent } from 'koa-useragent';
import bodyParser from 'koa-bodyparser';
import json from 'koa-json';
import Koa from 'koa';
import logger from 'koa-logger';
import session from 'koa-session';

const httpPort = 8080;
const log = (str, opts) => utilitas.log(str, import.meta.url, opts);

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

const cors = async (ctx, next) => {
    const options = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
    };
    for (let i in options) { ctx.set(i, options[i]); }
    await next();
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
    globalThis.debug = options.debug;
    globalThis.websrv = await utilitas.which();
    if (options.bot) { await initRobot(options); }
    if (options.tape) { await tape.init(options.tape); }
    if (options.tracing) { await initTracing(options.tracing); }
    log(`${websrv.title} is launching...`, { time: true });
    websrv.port = options.port || httpPort;
    websrv.listen = `http://localhost:${websrv.port}`;
    websrv.origin = options.origin || websrv.listen;
    websrv.app = new Koa();
    websrv.app.proxy = options.proxy ?? websrv.origin !== websrv.listen;
    if (options.splunk) { await initSplunk(options.splunk); }
    if (options.database) { await dbio.init(options.database); }
    if (options.email) { await email.init(options.email); }
    if (options.user) { await initUser(options.user); }
    if (options.identity) { await initIdentity(options.identity, websrv.app); }
    if (options.googleCloud) { await initGoogleCloud(options.googleCloud); }
    if (options.tracing) { await initTracing(options.tracing, websrv.app); }
    await initFile(options.file);
    await initService(options);
    await initSession(options.session, websrv.app);
    const objRouter = await initRouter(options);
    websrv.app.use(logger((str, args) => { log(str.trim(), { time: true }); }));
    websrv.app.use(bodyParser({ onerror: (err, ctx) => ctx.error = err }));
    websrv.app.use(json());
    websrv.app.use(cors);
    websrv.app.use(userAgent);
    websrv.app.use(objRouter.routes()).use(objRouter.allowedMethods());
    websrv.server = createServer(websrv.app.callback());
    websrv.service = websrv.server.listen(websrv.port, callback);
    const duration = Math.round(process.hrtime(start)[1] / 1000000 / 10) / 100;
    log(`Listening at ${websrv.app.proxy ? `${color.green(websrv.origin)} => `
        : ''}${color.green(websrv.listen)} .`);
    log(`Successfully launched within ${color.yellow(duration)} seconds.`);
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
    try { await endService(); } catch (e) { console.error(e); }
    try { await dbio.end(); } catch (e) { console.error(e); }
    try { await tape.end(); } catch (e) { console.error(e); }
};

export {
    init,
    end,
};
