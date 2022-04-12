import { bot as robot, utilitas } from 'utilitas';

const __skill = '../skills';
const link = new Set();
const checkLink = (key) => link.has(key);
const end = (options) => bot && bot.end(options); // bot.end is an async func

let bot;

const init = async (options) => {
    if (options?.bot) {
        bot = robot;
        Object.keys(options).map(link.add);
        await bot.init({
            ...options.bot, skillPath: [
                utilitas.__(import.meta.url, __skill),
                ...utilitas.ensureArray(options.bot?.skillPath),
            ]
        });
    }
    assert(bot, 'Bot have not been initialized.', 501);
    return bot;
};

export default init;
export {
    checkLink,
    end,
    init,
};
