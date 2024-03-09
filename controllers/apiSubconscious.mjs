import { info } from '../lib/webjam.mjs';
import { join } from 'path';
import { Readable } from 'stream';
import { storage, utilitas } from 'utilitas';
import geoIp from 'fast-geoip';
import httpStatus from 'http-status';
import send from 'koa-send';

const root = process.cwd();
const [ptcHttp, ptcHttps] = ['http', 'https'];
const [wildcardPath, wildcardMethod] = [['*'], ['*']];
const INTERNAL_SERVER_ERROR = 'Internal Server Error';
const UNPROCESSABLE_ENTITY = 'Unprocessable Entity';
const fTime = (time) => Math.floor(time.getTime() / 1000);
const ok = ctx => ctx.status = 200;
const ignoreError = ctx => ctx.request.header?.authorization?.startsWith?.('Splunk');

const analyze = async (ctx, next) => {
    ctx.originProtocol = ctx.socket.encrypted || (webjam.proxy
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
    if (globalThis.debug) {
        console.log('> ctx:', ctx);
        console.log('> ctx.request.body:', ctx.request.body);
    }
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
        const stat = Date.isDate(cacheTime, true)
            ? await storage.exists(join(root, file)) : null;
        if (cacheTime && stat && (fTime(cacheTime) >= fTime(stat.mtime))) {
            return ctx.status = 304;
        }
        await send(ctx, file, { root });
    };
    ctx.stream = async (chunk, options) => {
        if (!ctx._stream) {
            ctx.body = ctx._stream = new Readable();
            ctx.body._read = () => { };
            ctx.body.pipe(ctx.res);
        }
        let resp = null;
        if (utilitas.isSet(chunk, true)) {
            options?.raw || (chunk = chunk.replace(/\n/g, '\r'));
            resp = `${utilitas.ensureString(chunk)}\n`;
        }
        ctx.body.push(resp);
    };
    ctx.download = async (file, options) => {
        // https://stackoverflow.com/questions/93551/how-to-encode-the-filename-parameter-of-content-disposition-header-in-http
        const filename = encodeURIComponent(
            storage.sanitizeFilename(options?.filename || '')
        );
        ctx.set(
            'Content-Disposition', `attachment; filename*=UTF-8''${filename}`
        );
        options?.mimeType && (ctx.type = options.mimeType);
        ctx.body = await storage.convert(
            file, { ...options, expected: 'BUFFER' }
        );
    };
    await next();
};

const errorHandler = async (ctx, next) => {
    try {
        assert(
            !ctx.error || ignoreError(ctx),
            UNPROCESSABLE_ENTITY, httpStatus.UNPROCESSABLE_ENTITY,
            { details: ctx.error?.message || UNPROCESSABLE_ENTITY }
        );
        await next();
    } catch (err) {
        if (!(err.status
            && err.status >= httpStatus.OK
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
    ctx.ok(await info(ctx));
};

const notFound = async (ctx, next) => {
    const status = 404;
    if (/^\/api\/.*/.test(ctx.request.url)) {
        return ctx.er({ error: 'API not found.' }, status);
    }
    ctx.body = await storage.readFile(
        utilitas.__(import.meta.url, '../public/404.html')
    );
    ctx.status = status;
};

export const { link, actions } = {
    _NEED: ['fast-geoip'],
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
            path: wildcardPath,
            method: 'OPTIONS',
            priority: -8950,
            process: [ok],
            auth: false,
            upload: false,
            share: false,
        },
        {
            path: ['api/poke'],
            method: wildcardMethod,
            priority: -8930,
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
