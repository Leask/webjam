import { fileURLToPath } from 'url';
import { utilitas, bot as robot } from 'utilitas';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultSkillPath = '../skills';
const link = new Set();
const checkLink = (key) => { return link.has(key); };

let bot;

const init = async (options) => {
    if (options?.bot) {
        bot = robot;
        Object.keys(options).map((key) => { link.add(key); });
        await bot.init({
            ...options.bot, skillPath: [
                path.join(__dirname, defaultSkillPath),
                ...utilitas.ensureArray(options.bot?.skillPath),
            ]
        });
    }
    assert(bot, 'Bot have not been initialized.', 501);
    return bot;
};

const end = async (options) => {
    return bot && await bot.end(options);
};

export default init;
export {
    checkLink,
    end,
    init,
};
