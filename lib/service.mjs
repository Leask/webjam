import { fileURLToPath } from 'url';
import { utilitas, event as libEvent } from 'utilitas';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultServicePath = '../services';
const link = new Set();
const checkLink = (key) => { return link.has(key); };

let event;

const init = async (options) => {
    if (options) {
        event = libEvent;
        Object.keys(options).map((key) => { link.add(key); });
        utilitas.ensureArray(
            options.servicePath || path.join(__dirname, defaultServicePath)
        ).map(x => { event.bulk(x, { silent: true }); });
    }
    utilitas.assert(event, 'Services have not been initialized.', 501);
    return event;
};

const end = async (options) => {
    return event && await event.end(options);
};

export {
    checkLink,
    end,
    init,
};
