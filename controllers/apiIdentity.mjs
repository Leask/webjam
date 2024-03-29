import { identity } from '../index.mjs';

const getUrls = (prdr, opt) => {
    return [identity.getAuthUrl(prdr, opt), identity.getCallbackUrl(prdr, opt)];
};

const authCallback = async (ctx, next) => {
    console.log(ctx.req.user);
    ctx.redirect(`${identity.successRedirect}?token=${ctx.req.user.token.id}`);
};

export const { link, actions } = {
    link: 'identity',
    actions: [
        {
            path: getUrls(identity.sTwitter),
            method: 'GET',
            process: [await identity.authenticate(identity.sTwitter), authCallback],
        },
    ],
};
