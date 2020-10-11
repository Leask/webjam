'use strict';

const builder = async (options) => {
    options = options || {};
    const router = new Router(options);
    const [ctls, actions] = [[subconscious], []];
    if (options.controllerPath) {
        await storage.assertPath(options.controllerPath, 'D', 'R');
        fs.readdirSync(options.controllerPath).filter((file) => {
            return file.indexOf('.') !== 0;
        }).forEach(file => {
            const ctl = require(path.join(options.controllerPath, file));
            utilitas.assert(
                ctl && ctl.actions && Array.isArray(ctl.actions)
                && ctl.actions.length, `Invalid controller: ${file}.`, 500
            );
            ctls.push(ctl);
        });
    }
    ctls.map((ctl) => {
        if (ctl.disabled) { return; }
        ctl.actions.map((action) => {
            utilitas.assert(
                action && action.process,
                `Invalid action: ${JSON.stringify(action)}.`, 500
            );
            action.path = utilitas.ensureArray(action.path || '*');
            action.method = utilitas.ensureArray(action.method || 'ALL');
            action.process = utilitas.ensureArray(action.process);
            action.path.map((path) => {
                action.method.map((method) => {
                    actions.push({
                        path: String(path || '').toLowerCase(),
                        method: String(method || '').toLowerCase(),
                        process: action.process,
                        priority: ~~action.priority,
                    });
                });
            });
        });
    });
    actions.sort((x, y) => { return x.priority - y.priority; });
    // console.log(actions);
    actions.map((action) => {
        action.process.unshift(`/${action.path}`);
        router[action.method].apply(router, action.process);
    });
    return router;
};

module.exports = builder;

const { utilitas, storage } = require('utilitas');
const subconscious = require('./subconscious');
const Router = require('koa-router');
const path = require('path');
const fs = require('fs');