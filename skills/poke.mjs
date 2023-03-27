import { checkLink } from '../lib/robot.mjs';

const action = async (ctx, next) => {
    if (ctx.end) { return await next(); }
    ctx.text === 'poke' && ctx.reply(new Date());
    await next();
};

export const { run, priority, func } = {
    run: checkLink('bot'),
    priority: 10,
    func: action,
};
