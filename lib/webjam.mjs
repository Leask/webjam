import {
    alan, bot, callosum, color, dbio, email, encryption, manifest, network, ssl,
    tape, utilitas,
} from 'utilitas';

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { init as initFile } from './file.mjs';
import { init as initIdentity } from './identity.mjs';
import { init as initMeta, assertClass } from './meta.mjs';
import { init as initRespond } from './respond.mjs';
import { init as initRobot } from './robot.mjs';
import { init as initRouter } from './router.mjs';
import { init as initService, end as endService } from './service.mjs';
import { init as initSplunk } from './splunk.mjs';
import { init as initTracing } from './tracing.mjs';
import { init as initUser } from './user.mjs';
import { parseArgs } from 'node:util';
import { userAgent } from 'koa-useragent';
import bodyParser from 'koa-bodyparser';
import json from 'koa-json';
import Koa from 'koa';
import logger from 'koa-logger';
import session from 'koa-session';

const _NEED = ['mysql2'];
const [ALL, defaultPort, httpPort, httpsPort] = ['*', 8080, 80, 443];
const log = (str, opts) => utilitas.log(str, import.meta.url, opts);
const warning = message => utilitas.log(message, 'WARNING');

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
        // sameSite: null, /** (string) session cookie sameSite options (default null, don't set it) */ // https://github.com/koajs/session/pull/231
    });
    app.keys = utilitas.ensureArray(options.keys
        || encryption.digestObject(config));
    app.use(session(config, app));
};

const toInit = {
    database: dbio.init, email: email.init, meta: initMeta,
    respond: initRespond, user: initUser,
};

const cors = async (ctx, next) => {
    const options = {
        'Access-Control-Allow-Origin': ALL,
        'Access-Control-Allow-Headers': ALL,
        'Access-Control-Allow-Methods': ALL,
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
    const { values: args } = parseArgs({ strict: false });
    options = options || {};
    globalThis.debug = options.debug;
    globalThis.webjam = await utilitas.which();
    options.domain = options.domain || 'localhost';
    options.bot && await initRobot(options);
    options.tape && await tape.init(options.tape);
    options.tracing && await initTracing(options.tracing);
    options.alan && await Promise.all(utilitas.ensureArray(options.alan).map(alan.init));
    const scheme = `http${options.https ? 's' : ''}`;
    callosum.isPrimary && log(`${webjam.title} is launching...`, { time: true });
    webjam.origin = options.origin || webjam.listen;
    webjam.port = options.https ? httpsPort : (options.port || defaultPort);
    const standarPorts = [httpPort, httpsPort].includes(webjam.port);
    webjam.listen = `${scheme}://${options.domain}${standarPorts ? '' : `:${webjam.port}`}`;
    webjam.proxy = options.proxy ?? webjam.origin !== webjam.listen;
    for (let i in toInit) {
        if (!options[i]) { continue; }
        const opts = { ...options[i] };
        switch (i) {
            case 'database':
                if (!callosum.isPrimary && opts.vector) {
                    opts.vector = false;
                }
                break;
            case 'meta':
                for (let m in opts) {
                    if (opts[m].respond == false) { continue; }
                    const key = await assertClass(m, { quick: true });
                    options.respond = options?.respond || {}
                    options.respond[key] = options.respond[key] || {};
                }
                break;
        }
        await toInit[i](opts);
    }
    await callosum.init({
        initPrimary: async () => {
            if (!webjam.proxy && options.https) {
                ssl.isLocalhost(options.domain)
                    ? warning(`Using self-signed certificate for ${options.domain}.`)
                    : await ssl.init(options.domain, { debug: options.debug });
            } else { warning('HTTP-only mode is not recommended.'); }
            await initService(options);
        },
        initWorker: async () => {
            webjam.app = new Koa();
            options.splunk && await initSplunk(options.splunk);
            options.identity && await initIdentity(options.identity, webjam.app);
            options.tracing && await initTracing(options.tracing, webjam.app);
            await initFile(options.file);
            await initSession(options.session, webjam.app);
            const objRouter = await initRouter(options);
            webjam.app.use(logger((str, args) => log(str.trim(), { time: true })));
            webjam.app.use(bodyParser({
                jsonLimit: '100mb',
                onerror: (err, ctx) => ctx.error = err
            }));
            webjam.app.use(json());
            webjam.app.use(cors);
            webjam.app.use(userAgent);
            webjam.app.use(objRouter.routes()).use(objRouter.allowedMethods());
            webjam.server = (options?.https ? createHttpsServer : createHttpServer)({
                ...options.https ? await ssl.httpsServerOptions() : {}
            }, webjam.app.callback());
            webjam.service = webjam.server.listen(
                webjam.port, _ => Function.isFunction(callback) && callback(_)
            );
            process.on('SIGTERM', process.exit);
        },
        onReady: async () => {
            log(`Listening at ${webjam.proxy
                ? `${color.green(webjam.origin)} => `
                : ''}${color.green(webjam.listen)}.`);
            args.repl && (await import('repl')).start('> ');
        },
        workerCount: options.workerCount || ~~!!options.debug || undefined,
    });
    return webjam;
};

const init = async (options) => {
    try { return await _init(options); } catch (err) { console.error(err); }
};

const _end = async () => {
    webjam && webjam.service && webjam.service.close();
    log('Terminated.');
};

const end = async () => {
    for (let end of [
        endService, dbio.end, tape.end, bot.end, _end, callosum.end
    ]) { try { await end(); } catch (err) { console.error(err); } }
};

const info = async (ctx) => {
    return {
        service: {
            title: (await utilitas.which()).title,
            time: new Date(),
            uptime: process.uptime(),
            foundation: {
                utilitas: manifest.version,
                webjam: (await utilitas.which('./package.json')).version,
            },
            geolocation: await network.getCurrentPosition(),
        },
        client: ctx ? {
            userAgent: ctx.userAgent.source,
            ip: ctx.request.ip,
            geolocation: ctx.userAgent.geoIp,
        } : null,
    };
};

export {
    _NEED,
    init,
    end,
    info,
};
