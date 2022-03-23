import { default as send } from 'koa-send';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { utilitas, geoIp, storage } from 'utilitas';
import httpStatus from 'http-status';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();
const [ptcHttp, ptcHttps] = ['http', 'https'];
const [wildcardPath, wildcardMethod] = [['*'], ['*']];
const INTERNAL_SERVER_ERROR = 'Internal Server Error';
const UNPROCESSABLE_ENTITY = 'Unprocessable Entity';
const fTime = (time) => Math.floor(time.getTime() / 1000);

const analyze = async (ctx, next) => {
    ctx.originProtocol = ctx.socket.encrypted || (ctx.app.proxy
        && ctx.get('X-Forwarded-Proto').split(/\s*,\s*/)[0] === ptcHttps)
        ? ptcHttps : ptcHttp; // patch: https://github.com/koajs/koa/issues/974
    ctx.cookies.secure = ctx.encrypted = ctx.originProtocol === ptcHttps;
    ctx.userAgent._agent.versionNormalized
        = utilitas.parseVersion(ctx.userAgent.version);
    if (/^::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ctx.request.ip)) {
        ctx.request.ip = ctx.request.ip.replace(/^::ffff:/, '');
    }
    ctx.userAgent._agent.geoIp
        = ctx.request.ip ? await geoIp.lookup(ctx.request.ip) : null;
    await next();
};

const extendCtx = async (ctx, next) => {
    ctx.ok = (data) => {
        ctx.body = {
            data: utilitas.isUndefined(data) ? {} : data,
            error: null, success: true,
        };
    };
    ctx.er = (error, status) => {
        ctx.status = error?.status || status || 400;
        ctx.body = {
            error: error?.message
                || (typeof error === 'string' ? error : null)
                || httpStatus[`${ctx.status}_NAME`] || 'Unknown error.',
            details: error?.details || {}, success: false,
        };
    };
    ctx.send = async (file) => {
        const cacheTime = ctx.request.header?.['if-modified-since']
            ? new Date(ctx.request.header?.['if-modified-since']) : null;
        const stat = utilitas.isDate(cacheTime, true)
            ? await storage.exists(path.join(root, file)) : null;
        if (cacheTime && stat && (fTime(cacheTime) >= fTime(stat.mtime))) {
            return ctx.status = 304;
        }
        await send(ctx, file, { root });
    };
    await next();
};

const ignoreError = (ctx) => {
    return ctx.request.header?.authorization?.startsWith?.('Splunk');
};

const errorHandler = async (ctx, next) => {
    try {
        utilitas.assert(
            !ctx.error || ignoreError(ctx),
            UNPROCESSABLE_ENTITY, httpStatus.UNPROCESSABLE_ENTITY,
            { details: ctx.error?.message || UNPROCESSABLE_ENTITY }
        );
        await next();
    } catch (err) {
        if (!(err.status
            && err.status >= httpStatus.BAD_REQUEST
            && err.status < httpStatus.INTERNAL_SERVER_ERROR)) {
            console.error(err);
            err = utilitas.newError(
                INTERNAL_SERVER_ERROR, httpStatus.INTERNAL_SERVER_ERROR
            );
        }
        return ctx.er(err);
    }
};

const poke = async (ctx, next) => {
    ctx.ok({
        time: new Date(),
        userAgent: ctx.userAgent.source,
    });
};

const notFound = async (ctx, next) => {
    const status = 404;
    if (/^\/api\/.*/.test(ctx.request.url)) {
        return ctx.er({ error: 'API not found.' }, status);
    }
    ctx.body = await fs.readFile(path.join(__dirname, '../public/404.html'), 'utf8');
    ctx.status = status;
};

export const { link, actions } = {
    link: 'subconscious',
    disabled: false,
    actions: [
        {
            path: wildcardPath,
            method: wildcardMethod,
            priority: -8960,
            process: [analyze, extendCtx, errorHandler],
            auth: false,
            upload: false,
            share: false,
        },
        {
            path: ['api/poke'],
            method: wildcardMethod,
            priority: -8940,
            process: [poke],
            auth: false,
            upload: false,
            share: false,
        },
        {
            path: wildcardPath,
            method: wildcardMethod,
            priority: 8960,
            process: [notFound],
            auth: false,
            upload: false,
            share: false,
        },
    ],
};
