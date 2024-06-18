import { universal, utilitas } from '../index.mjs';

const filename = 'universal.mjs';

const sendUniversal = async (ctx, next) => {
    const runtime = universal.getRuntime()
    const funcs = `const functions = ${JSON.stringify(universal.getFunc(), null, 4)};`;
    await ctx.download(`${runtime}\n\n${funcs}`, { input: 'TEXT', filename });
};

// import { v4 as uuidv4 } from 'uuid';

// const streamSessions = {};

// const ensureStreamSession = async (id) => {
//     id || (id = uuidv4());
//     streamSessions[id] || (streamSessions[id] = { touchedAt: new Date(), events: [] });
//     return { id, session: streamSessions[id] };
// };

// // const endStreamSession = async (id) => {
// //     await utilitas.ignoreErrFunc(() => {
// //         delete streamSessions[id];
// //     });
// // };

// const writeStreamSession = async (id, event) => {
//     const { id, session } = await ensureStreamSession(id);
//     session.touchedAt = new Date();
//     session.events.push(event);
//     return id;
// };

// const flushSteamSession = async (id) => {
//     const { id, session } = await ensureStreamSession(id);


// };


const callFunc = async (ctx, next) => {
    const params = ctx.request.body;
    const last = ~~params?.length - 1;
    params[last]?.stream && (params[last].stream = ctx.stream);
    const resp = await universal.call(
        ctx.params.func, params, { user: ctx.verification.user }
    );
    params[last]?.stream ? params[last].stream() : ctx.ok(resp);
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
