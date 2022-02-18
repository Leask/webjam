// https://docs.docker.com/config/containers/logging/splunk/ (will case empty msg)
// https://github.com/splunk/docker-logging-plugin (preferred)

import { fileURLToPath } from 'url';
import { utilitas, math } from 'utilitas';
import * as token from './token.mjs';

const __filename = fileURLToPath(import.meta.url);
const [mtL, mtR, mtX] = ["}", '{"event":', '{{{\n}}}'];
const [mtC, mtN] = [`${mtL}${mtR}`, `${mtL}${mtX}${mtR}`];

let strToken, funcCollect;

const init = async (options) => {
    if (options) { strToken = options?.token; funcCollect = options?.collect; }
    utilitas.assert(strToken, 'Splunk have not been initialized.', 501);
    return strToken;
};

const assertAuth = async (auth) => {
    return token.assertToken(strToken && `Splunk ${strToken}` === auth);
};

const log = (content, host, options) => {
    utilitas.modLog(
        content, utilitas.basename(__filename) + (host ? ` > ${host}` : ''),
        { time: true, ...options || {} }
    );
};

const collect = async (body) => {
    if (funcCollect) { return await funcCollect(body); }
    body.split(mtC).join(mtN).split(mtX)
        .map(utilitas.parseJson).filter(x => x?.event && x?.time && x?.host)
        .map(x => log(x.event?.line || x.event, x.host, {
            time: math.multiply(x.time, 1000)
        }));
};

export default init;
export {
    assertAuth,
    collect,
    init,
};
