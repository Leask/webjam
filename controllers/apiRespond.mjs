import { respond } from '../index.mjs';

const act = async (ctx, next) => {
    ctx.ok(await respond.act(
        ctx.params.class, ctx.params.id,
        ctx.request.body?.type, ctx.request.body?.value,
        ctx.verification.user.id,
    ));
};

export const { link, actions } = {
    link: 'file',
    actions: [
        {
            path: 'api/responds/:class/:id',
            method: ['POST', 'PUT', 'PATCH'],
            process: act,
            auth: true,
        },
    ]
};
