const wrap = async (ctx, next) => {
    const resp = {};
    if (globalThis.debug) {
        console.log('> ctx.request.files:', ctx.request.files);
    }
    ctx.request.files.map((file) => {
        resp[file.fieldname || file.originalname] = file.receipt;
    });
    ctx.ok(resp);
};

export const { link, actions } = {
    link: 'file',
    actions: [
        {
            path: 'api/files',
            method: 'POST',
            process: wrap,
            auth: true,
            upload: true,
            share: true,
        },
    ]
};
