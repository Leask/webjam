import { fileURLToPath } from 'url';
import { Telegraf } from 'telegraf';
import { utilitas, storage } from 'utilitas';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const signals = ['SIGINT', 'SIGTERM'];
const defaultSkillPath = '../skills';
const log = (content) => { return utilitas.modLog(content, __filename); };

let bot;

const init = async (options) => {
    if (options?.bot) {
        utilitas.assert(
            utilitas.insensitiveCompare(options.bot?.provider, 'telegram'),
            'Invalid bot provider.', 501
        );
        bot = new Telegraf(options.bot?.botToken);
        const [arrPath, skills, actions] = [[
            path.join(__dirname, defaultSkillPath),
            ...utilitas.ensureArray(options.bot?.skillPath)
        ], [], []];
        for (let strPath of arrPath) {
            await storage.assertPath(strPath, 'D', 'R');
            const files = fs.readdirSync(strPath).filter(
                file => /\.mjs$/i.test(file) && file.indexOf('.') !== 0
            );
            for (let file of files) {
                const skill = await import(path.join(strPath, file));
                const sklLink = (skill && skill.link || '').toLowerCase();
                if (skill && (sklLink && !options[sklLink] || skill.disabled)) {
                    continue;
                }
                utilitas.assert(
                    skill && skill.actions && Array.isArray(skill.actions)
                    && skill.actions.length, `Invalid bot skill: ${file}.`, 500
                );
                skills.push(skill);
            }
        }
        skills.map((skill) => {
            skill.actions.map((action) => {
                utilitas.assert(
                    action && action.train,
                    `Invalid action: ${JSON.stringify(action)}.`, 500
                );
                actions.push(action);
            });
        });
        actions.sort((x, y) => { return ~~x.priority - ~~y.priority; });
        await Promise.all(actions.map((action) => {
            logAction(action); return action.train(bot);
        }));
        bot.launch();
        // Enable graceful stop
        signals.map(signal => process.once(signal, () => bot.stop(signal)));
    }
    utilitas.assert(bot, 'Bot have not been initialized.', 501);
    return bot;
};

const logAction = (action) => {
    log(`Skill => ${action.name || action.train.name || 'anonymous'}`);
};

const end = async (options) => {
    return bot && bot.stop(options?.signal);
};

export {
    end,
    init,
};
