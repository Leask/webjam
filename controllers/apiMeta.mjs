import { dbio, meta } from '../index.mjs';

const [MAX_LIMIT, DEFAULT_LIMIT] = [1000, 10];

const updateById = async (ctx, next) => {
    try {
        ctx.ok(await meta._.updateById(ctx.params.class, ctx.params.id, {
            ...ctx.request.body,
            updated_by: ctx.verification.user.id,
        }));
    } catch (err) { ctx.er(err, 400); }
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
    try {
        const resp = await meta._.queryById(ctx.params.class, ctx.params.id);
        assert(resp, 'Meta Not Found', 404)
        ctx.ok(resp);
    } catch (err) { ctx.er(err, 400); }
};

const deleteById = async (ctx, next) => {
    try {
        const resp = await meta._.deleteById(ctx.params.class, ctx.params.id);
        assert(resp?.rowCount, 'Meta Not Found', 404)
        ctx.ok({});
    } catch (err) { ctx.er(err, 400); }
};

const query = async (ctx, next) => {
    try {
        const table = await meta.assertClass(ctx.params.class);
        const { order, sort, limit, offset } = {
            order: ctx.query?.order || 'created_at',
            sort: ctx.query?.sort || 'ASC',
            limit: parseInt(ctx.query?.limit) || DEFAULT_LIMIT,
            offset: parseInt(ctx.query?.offset) || 0,
        };
        const whereKey = ` WHERE "created_by" = $1 OR "shared" > $2 `;
        const whereVal = [ctx.verification.user.id, 0];
        assert(['created_at', 'updated_at'].includes(order), 'Invalid order.', 400);
        assert(['ASC', 'DESC'].includes(sort), 'Invalid order.', 400);
        assert(0 < limit && limit <= MAX_LIMIT, 'Invalid limit.', 400);
        const [cResp, resp] = await Promise.all([[
            dbio.assembleQuery(table, { fields: 'COUNT("id")' })
            + whereKey, whereVal,
        ], [
            dbio.assembleQuery(table) + whereKey
            + dbio.assembleTail({ order: { [order]: sort }, limit, offset }),
            whereVal,
        ]].map(x => dbio.query(...x)));
        assert(resp.length, 'Meta Not Found', 404)
        ctx.ok({ total: parseInt(cResp[0]['count']), metas: resp });
    } catch (err) { ctx.er(err, 400); }
};

export const { link, actions } = {
    link: 'file',
    actions: [
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
            process: query,
            auth: true,
        },
    ]
};
