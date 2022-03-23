// @Workaround: apiSubconscious.ignoreError

import { splunk } from '../index.mjs';

const [serviceUrl, wildcardMethod] = [['services/collector/event/1.0'], ['*']];
const success = { text: 'Success', code: 0 };

const collect = async (ctx, next) => {
    await splunk.assertAuth(ctx.request.header?.authorization);
    await splunk.collect(ctx.error.body);
    ctx.ok(success);
};

export const { link, actions } = {
    link: 'splunk',
    actions: [
        {
            path: serviceUrl,
            method: wildcardMethod,
            process: collect,
        },
    ],
};
