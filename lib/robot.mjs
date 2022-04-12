import { bot as robot, utilitas } from 'utilitas';
import { join } from 'path';

const { __dirname } = utilitas.__(import.meta.url);
const defaultSkillPath = '../skills';
const link = new Set();
const checkLink = (key) => link.has(key);
const end = async (options) => bot && await bot.end(options);

let bot;

const init = async (options) => {
    if (options?.bot) {
        bot = robot;
        Object.keys(options).map((key) => { link.add(key); });
        await bot.init({
            ...options.bot, skillPath: [
                join(__dirname, defaultSkillPath),
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
