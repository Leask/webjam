import { checkLink } from '../lib/service.mjs';
import { cleanup } from '../lib/token.mjs';
import { utilitas } from 'utilitas';

const log = (content) => utilitas.log(content, import.meta.url);

const action = async () => {
    const resp = await cleanup();
    log(`${resp && resp.affectedRows || 0} expired tokens have been cleared.`);
};

export const { run, func, interval, tout, delay } = {
    run: checkLink('user'),
    func: action,
    interval: 60,
    tout: 60,
    delay: 30,
};
