import { cpus } from 'os';
import { utilitas } from 'utilitas';
import cluster from 'cluster';

const log = (content) => utilitas.log(content, import.meta.url);
const cpuCount = cpus().length;

let forked = 0;

const action = async () => {
    while (Object.keys(webjam.processes).length < cpuCount) {
        webjam.processes.push(cluster.fork({ FORKED: ++forked }));
    }
};

export const { run, func, interval, tout, delay } = {
    run: true,
    func: action,
    interval: 3,
    tout: 10,
    delay: 0,
};
