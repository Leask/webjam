const sendUtilitas = async (ctx, next) => {
    await ctx.send('node_modules/utilitas/dist/utilitas.lite.mjs');
};

const sendUtilitasMap = async (ctx, next) => {
    await ctx.send('node_modules/utilitas/dist/utilitas.lite.mjs.map');
};

const sendUtilitasLic = async (ctx, next) => {
    await ctx.send('node_modules/utilitas/dist/utilitas.lite.mjs.LICENSE.txt');
};

export const { link, actions } = {
    link: 'subconscious',
    actions: [
        {
            path: 'lib/utilitas/utilitas.lite.mjs',
            method: 'GET',
            process: sendUtilitas,
        },
        {
            path: 'lib/utilitas/utilitas.lite.mjs.map',
            method: 'GET',
            process: sendUtilitasMap,
        },
        {
            path: 'lib/utilitas/utilitas.lite.mjs.LICENSE.txt',
            method: 'GET',
            process: sendUtilitasLic,
        },
    ],
};
