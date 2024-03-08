import { call, getFunc, getRuntime } from '../lib/universal.mjs';

const filename = 'universal.mjs';

const sendUniversal = async (ctx, next) => {
    const runtime = getRuntime()
    const funcs = `const functions = ${JSON.stringify(getFunc(), null, 4)};`;
    await ctx.download(`${runtime}\n\n${funcs}`, { input: 'TEXT', filename });
};

const callFunc = async (ctx, next) => {
    const { params, options } = ctx.request.body;
    const stream = options?.stream ? ctx.stream : null;
    const resp = await call(ctx.params.func, params, {
        user: ctx.verification.user, stream
    });
    stream ? stream() : ctx.ok(resp);
};

export const { actions } = {
    actions: [
        {
            path: `lib/webjam/${filename}`,
            method: 'GET',
            auth: false,
            process: sendUniversal,
        },
        {
            path: ['api/universal/:func'],
            method: 'POST',
            priority: -8920,
            process: [callFunc],
            auth: false,
            upload: false,
            share: false,
        },
    ],
};
