import { meta } from '../index.mjs';

const query = async (ctx, next) => {

};

const updateById = async (ctx, next) => {
    ctx.ok(await meta._.updateById(ctx.params.class, ctx.params.id, {
        ...ctx.request.body,
        updated_by: ctx.verification.user.id,
    }));
};

const create = async (ctx, next) => {
    try {
        ctx.ok(await meta._.insert(ctx.params.class, {
            ...ctx.request.body,
            created_by: ctx.verification.user.id,
            updated_by: ctx.verification.user.id,
        }));
    } catch (err) { ctx.er(err, 400); }
};

const getById = async (ctx, next) => {
    const resp = await meta._.queryById(ctx.params.class, ctx.params.id);
    resp ? ctx.ok(resp) : ctx.er('Meta Not Found', 404);
};

const deleteById = async (ctx, next) => {
    const resp = await meta._.deleteById(ctx.params.class, ctx.params.id);
    resp?.rowCount ? ctx.ok({}) : ctx.er('Meta Not Found', 404);
};

const getAll = async (ctx, next) => {
    // todo: pagination
    ctx.ok(await meta._.queryAll(ctx.params.class));
};

export const { link, actions } = {
    link: 'file',
    actions: [
        {
            path: 'api/metas/:class/query',
            method: 'PATCH',
            process: query,
            auth: true,
        },
        {
            path: 'api/metas/:class/:id',
            method: ['PUT', 'POST'],
            process: updateById,
            auth: true,
        },
        {
            path: 'api/metas/:class',
            method: 'POST',
            process: create,
            auth: true,
        },
        {
            path: 'api/metas/:class/:id',
            method: 'GET',
            process: getById,
            auth: true,
        },
        {
            path: 'api/metas/:class/:id',
            method: 'DELETE',
            process: deleteById,
            auth: true,
        },
        {
            path: 'api/metas/:class',
            method: 'GET',
            process: getAll,
            auth: true,
        },
    ]
};
