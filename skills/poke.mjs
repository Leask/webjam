import { checkLink } from '../lib/robot.mjs';

const action = async (ctx, next) => {
    ctx.text === 'poke' && ctx.ok(new Date());
    await next();
};

export const { run, priority, func } = {
    run: checkLink('bot'),
    priority: 10,
    func: action,
};
