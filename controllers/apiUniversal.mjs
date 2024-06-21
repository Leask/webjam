import { universal } from '../index.mjs';

const filename = 'universal.mjs';

const sendUniversal = async (ctx, next) => {
    const runtime = universal.getRuntime()
    const funcs = `const functions = ${JSON.stringify(universal.getFunc(), null, 4)};`;
    await ctx.download(`${runtime}\n\n${funcs}`, { input: 'TEXT', filename });
};

const flushSteamSession = async (ctx, next) => {
    const id = ctx.params.id;
    assert(id, 'Stream ID required.', 400);
    const resp = await universal.flushSteamSession(id);
    if (!resp) { return ctx.er('Stream Not Found', 404); }
    ctx.ok({ id, content: resp.join('') }, 206);
};

const callFunc = async (ctx, next) => {
    const params = ctx.request.body;
    const last = ~~params?.length - 1;
    const cdnStream = params[last]?.stream && ctx.request.headers['cdn-loop'] === 'cloudflare';
    if (params[last]?.stream) {
        if (cdnStream) {
            const streamer = await universal.getStreamer();
            params[last].stream = streamer.write;
            ctx.ok({ id: streamer.id, content: '' }, 201);
        } else { params[last].stream = ctx.stream; }
    }
    let resp = universal.call(
        ctx.params.func, params, { user: ctx.verification.user }
    );
    if (cdnStream) {
        (async () => { await resp; params[last].stream(); })();
        return;
    }
    params[last]?.stream ? params[last].stream() : ctx.ok(await resp);
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
        {
            path: ['api/universal/stream/:id'],
            method: 'GET',
            priority: -8910,
            process: [flushSteamSession],
            auth: false,
            upload: false,
            share: false,
        },
    ],
};
