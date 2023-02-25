import { event as _event, utilitas } from 'utilitas';

const __service = '../services';
const link = new Set();
const checkLink = (key) => link.has(key);
const end = options => event && event.end(options); // event.end is an async func

let event;

const init = async (options) => {
    if (options) {
        event = _event;
        Object.keys(options).map(key => link.add(key));
        const pmsLoad = [];
        [utilitas.__(import.meta.url, __service), options.servicePath].map(
            utilitas.ensureArray
        ).flat().map(x => { pmsLoad.push(event.bulk(x, { silent: true })); });
        await Promise.all(pmsLoad);
    }
    assert(event, 'Services have not been initialized.', 501);
    return event;
};

export {
    checkLink,
    end,
    init,
};
