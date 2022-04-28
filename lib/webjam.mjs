import { color, dbio, email, encryption, tape, utilitas } from 'utilitas';
import { cpus } from 'os';
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
import cluster from 'cluster';
import json from 'koa-json';
import Koa from 'koa';
import logger from 'koa-logger';
import nopt from 'nopt';
import session from 'koa-session';

const [cpuCount, httpPort] = [cpus().length, 8080];
const log = (str, opts) => utilitas.log(str, import.meta.url, opts);

const initSession = async (options, app) => {
    options = options || {};
    // https://github.com/koajs/session
    const config = utilitas.mergeAtoB(options.config || {}, {
        key: `${webjam.name}.sess`, /** (string) cookie key (default is ${package.name}.sess) */
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

const toInit = {
    database: dbio.init, email: email.init,
    user: initUser, googleCloud: initGoogleCloud,
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
const _init = async (options, callback) => {
    options = options || {};
    const start = options.hrtime || process.hrtime();
    globalThis.debug = options.debug;
    globalThis.webjam = await utilitas.which();
    options.bot && await initRobot(options);
    options.tape && await tape.init(options.tape);
    options.tracing && await initTracing(options.tracing);
    cluster.isPrimary && log(`${webjam.title} is launching...`, { time: true });
    webjam.argv = nopt();
    webjam.origin = options.origin || webjam.listen;
    webjam.port = options.port || httpPort;
    webjam.listen = `http://localhost:${webjam.port}`;
    webjam.processes = [];
    webjam.proxy = options.proxy ?? webjam.origin !== webjam.listen;
    webjam.forked = ~~process.env.FORKED;
    for (let i in toInit) { options[i] && await toInit[i](options[i]); }
    if (cluster.isPrimary) {
        let responded = 0;
        cluster.on('exit', (worker, code, signal) => {
            log(`Process ${worker.process.pid} ended: ${code}.`);
            for (let i = webjam.processes.length - 1; i >= 0; i--) {
                webjam.processes[i].isDead() && webjam.processes.splice(i, 1);
            }
        });
        cluster.on('listening', _ => {
            if (++responded < cpuCount) { return; }
            const duration = Math.round(
                process.hrtime(start)[1] / 1000000 / 10
            ) / 100;
            log(`Listening at ${webjam.proxy
                ? `${color.green(webjam.origin)} => `
                : ''}${color.green(webjam.listen)} .`
            );
            log(`Successfully launched within ${color.yellow(duration)} seconds.`);
        });
        await initService(options);
        webjam.argv.repl && (await import('repl')).start('> ');
    } else {
        webjam.app = new Koa();
        options.splunk && await initSplunk(options.splunk);
        options.identity && await initIdentity(options.identity, webjam.app);
        options.tracing && await initTracing(options.tracing, webjam.app);
        await initFile(options.file);
        await initSession(options.session, webjam.app);
        const objRouter = await initRouter(options);
        webjam.app.use(logger((str, args) => log(str.trim(), { time: true })));
        webjam.app.use(bodyParser({ onerror: (err, ctx) => ctx.error = err }));
        webjam.app.use(json());
        webjam.app.use(cors);
        webjam.app.use(userAgent);
        webjam.app.use(objRouter.routes()).use(objRouter.allowedMethods());
        webjam.server = createServer(webjam.app.callback());
        webjam.service = webjam.server.listen(webjam.port, async (_) => {
            utilitas.log(
                `Service worker is online: ${webjam.forked}`,
                `PID-${process.pid}`
            );
            return Function.isFunction(callback) && await callback(_);
        });
        process.on('SIGTERM', process.exit);
    }
    return webjam;
};

const init = async (options) => {
    try { await _init(options); } catch (err) { console.error(err); }
};

const end = async () => {
    try { await endService(); } catch (e) { console.error(e); }
    try { await dbio.end(); } catch (e) { console.error(e); }
    try { await tape.end(); } catch (e) { console.error(e); }
    try {
        webjam && webjam.service && webjam.service.close();
        log('Terminated.');
    } catch (e) { console.error(e); }
    for (let i in webjam.processes) { webjam.processes[i].kill(); }
    process.exit(); // @todo by @LeaskH: Should be removed.
};

export {
    init,
    end,
};
