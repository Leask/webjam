'use strict';

const httpStatus = require('http-status');
const { token } = require('../');
const path = require('path');
const fs = require('fs');

const [wildcardPath, wildcardMethod] = [['(.*)'], ['ALL']];

const extendCtx = async (ctx, next) => {
    ctx.ok = (data) => {
        ctx.body = { errors: null, data: data, success: true };
    };
    ctx.er = (error, code) => {
        ctx.status = code || 400;
        ctx.body = { error: error && error.error || error, success: false };
    };
    ctx.throws = (err) => {
        ctx.status = err.status || 400;
        ctx.body = {
            error: err.message || httpStatus[`${ctx.status}_NAME`],
            details: err.errors || {},
        };
    };
    await next();
};

const errorHandler = async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        if (err.status
            && err.status >= httpStatus.BAD_REQUEST
            && err.status < httpStatus.INTERNAL_SERVER_ERROR) {
            ctx.throws(err);
            return;
        }
        throw err;
    }
};

const verifyToken = async (ctx, next) => {
    const t = ctx.request.headers.token || ctx.query.token;
    try { ctx.req.verification = await token.verifyForUser(t); } catch (err) { }
    await next(); // Use ctx.req instead of ctx to ensure compatibility to multer.
};

const poke = async (ctx, next) => {
    ctx.ok({
        time: new Date(),
        userAgent: ctx.userAgent.source,
    });
};

const resolveToken = async (ctx, next) => {
    ctx.ok(ctx.req.verification);
};

const notFound = (ctx, next) => {
    return new Promise((resolve, reject) => {
        const status = 404;
        if (/^\/api\/.*/.test(ctx.request.url)) {
            ctx.er({ error: 'API not found.' }, status);
            return resolve();
        }
        fs.readFile(path.join(
            path.dirname(module.filename), '../public/404.html'
        ), 'utf8', (err, resp) => {
            if (err) { return reject(err); }
            ctx.body = resp;
            ctx.status = status;
            resolve();
        });
    });
};

module.exports = {
    disabled: false,
    actions: [
        {
            path: wildcardPath,
            method: wildcardMethod,
            priority: -8960,
            process: [errorHandler, extendCtx, verifyToken],
            auth: false,
            upload: false,
        },
        {
            path: ['api/poke'],
            method: wildcardMethod,
            priority: -8950,
            process: [poke],
            auth: false,
            upload: false,
        },
        {
            path: ['api/tokens'],
            method: ['GET'],
            priority: -8940,
            process: [resolveToken],
            auth: true,
            upload: false,
        },
        {
            path: wildcardPath,
            method: wildcardMethod,
            priority: 8960,
            process: [notFound],
            auth: false,
            upload: false,
        },
    ],
};