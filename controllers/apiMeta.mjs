import { meta } from '../index.mjs';

const updateById = async (ctx, next) => {
    ctx.ok(await meta.updateById(
        ctx.params.class, ctx.params.id,
        ctx.request.body, ctx.verification.user.id
    ));
};

const create = async (ctx, next) => {
    ctx.ok(await meta.insert(
        ctx.params.class, ctx.request.body, ctx.verification.user.id
    ));
};

const getById = async (ctx, next) => {
    ctx.ok(await meta.queryById(
        ctx.params.class, ctx.params.id, ctx.verification.user.id
    ));
};

const deleteById = async (ctx, next) => {
    ctx.ok((await meta.deleteById(
        ctx.params.class, ctx.params.id, ctx.verification.user.id
    )) && {});
};

const query = async (ctx, next) => {
    ctx.ok(await meta.query(
        ctx.params.class, ctx.verification.user.id, ctx.query
    ));
};

export const { link, actions } = {
    link: 'file',
    actions: [
        {
            path: 'api/metas/:class/:id',
            method: ['POST', 'PUT', 'PATCH'],
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
            process: query,
            auth: true,
        },
    ]
};
