import { ensureAuthorization } from './token.mjs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { share, upload } from './file.mjs';
import { storage, utilitas } from 'utilitas';
import Router from '@koa/router';

const __controller = '../controllers';
const log = content => utilitas.log(content, import.meta.url);

const init = async (options) => {
    options = options || {};
    options.subconscious = options.subconscious || {};
    const router = new Router(options);
    const [arrPath, ctls, actions] = [[
        utilitas.__(import.meta.url, __controller),
        ...utilitas.ensureArray(options.controllerPath)
    ], [], []];
    for (let strPath of arrPath) {
        await storage.assertPath(strPath, 'D', 'R');
        const files = readdirSync(strPath).filter(
            file => /\.mjs$/i.test(file) && file.indexOf('.') !== 0
        );
        for (let file of files) {
            const ctl = await import(join(strPath, file));
            const ctlLink = (ctl && ctl.link || '').toLowerCase();
            if (ctl && (ctlLink && !options[ctlLink] || ctl.disabled)) { continue; }
            assert(ctl && ctl.actions && Array.isArray(ctl.actions)
                && ctl.actions.length, `Invalid controller: ${file}.`, 500);
            ctls.push(ctl);
        }
    }
    ctls.map((ctl) => {
        ctl.actions.map((action) => {
            assert(action && action.process,
                `Invalid action: ${JSON.stringify(action)}.`, 500);
            action.path = utilitas.ensureArray(action.path || '*');
            action.method = utilitas.ensureArray(action.method || 'GET');
            action.process = utilitas.ensureArray(action.process);
            action.path.map((path) => {
                path = utilitas.ensureString(path);
                action.method.map((method) => {
                    method = utilitas.ensureString(method, { case: 'LOW' });
                    actions.push({
                        path: path === '*' ? /.*/ : `/${path}`,
                        method: method === '*' ? 'all' : method,
                        process: utilitas.clone(action.process),
                        priority: ~~action.priority,
                        upload: !!action.upload,
                        share: !!action.share,
                        auth: !!action.auth,
                    });
                });
            });
        });
    });
    actions.sort((x, y) => { return x.priority - y.priority; });
    actions.map((action) => { initAction(router, action); });
    return router;
};

const initAction = (router, action) => {
    const process = [];
    if (action.auth) { process.push(ensureAuthorization); }
    if (action.upload) { action.uploadIndex = process.push(upload()) - 1; }
    if (action.share) { process.push(share); }
    action.process = [...process, ...action.process];
    logAction(action);
    router[action.method].apply(router, [action.path, ...action.process]);
};

const logAction = (action) => {
    const pcs = action.process.map((x) => { return x.name || 'anonymous' });
    if (action.upload) { pcs[action.uploadIndex] = 'upload'; }
    ~~process.env.FORKED === 1 && log(
        `${action.method.toUpperCase().padEnd(7, ' ')} ${action.path} => ${pcs.join(', ')}`
    );
};

export default init;
export {
    init,
};
