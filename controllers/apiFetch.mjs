import { web } from '../index.mjs';

const fetch = async (ctx, next) => {
    const resp = await web.get(ctx.request.query.url, { encode: 'BUFFER' });
    const chT = new Date(ctx.request.header?.['if-modified-since'] || undefined);
    const mdT = new Date(resp.headers['last-modified']?.[0] || undefined);
    ctx.set('content-type', resp.headers['content-type']);
    ctx.set('last-modified', resp.headers['last-modified']);
    ctx.set('cache-control', 'max-age=0');
    if (Date.isDate(chT, true) && Date.isDate(mdT, true) && chT >= mdT) {
        return ctx.status = 304;
    }
    ctx.body = resp.content;
};

export const { link, actions } = {
    link: 'fetch',
    actions: [
        {
            path: 'api/fetch',
            method: 'GET',
            process: fetch,
        },
    ]
};
