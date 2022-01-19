import { fileURLToPath } from 'url';
import { utilitas } from 'utilitas';
import * as service from '../lib/service.mjs';
import * as token from '../lib/token.mjs';

const __filename = fileURLToPath(import.meta.url);
const log = (content) => { return utilitas.modLog(content, __filename); };

const action = async () => {
    const resp = await token.cleanup();
    log(`${resp && resp.affectedRows || 0} expired tokens have been cleared.`);
};

export const { run, func, interval, tout, delay } = {
    run: service.checkLink('user'),
    func: action,
    interval: 60,
    tout: 60,
    delay: 0,
};
