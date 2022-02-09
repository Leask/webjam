import { fileURLToPath } from 'url';
import { utilitas } from '../index.mjs';

const __filename = fileURLToPath(import.meta.url);
const c = (s, r) => { return ~~utilitas.insensitiveCompare(s, r, { w: true }) };

const questions = [{
    q: ['The Ultimate Question of Life, the Universe, and Everything',
        'The answer to life the universe and everything'],
    a: '42',
}];

const log = (c, o) => {
    utilitas.modLog(c, utilitas.basename(__filename), { time: true, ...o || {} });
};

const poke = async (bot) => {
    bot.on('text', (ctx) => {
        log(`@${ctx.update.message.from.username}: ${ctx.update.message.text}`);
        let f = 0;
        questions.map(Q => { Q.q.map(x => { f += c(x, ctx.update.message.text) }) });
        f && ctx.reply('42');
    });
};

export const { link, actions } = {
    link: 'bot',
    disabled: false,
    actions: [
        {
            priority: -8960,
            name: 'chi',
            train: poke,
        },
    ],
};
