import { join } from 'path';
import { token, user, utilitas } from '../index.mjs';

const getPath = (subPath) => join('api/users', subPath);
const log = content => utilitas.log(content, import.meta.url);

const verifyToken = async (ctx, next) => {
    const tkn = (ctx.get('Authorization') || ctx.get('token')
        || ctx.query['token'] || '').replace(/^Bearer\ */i, '');
    // Use ctx.req instead of ctx to ensure compatibility to multer if you need.
    // This tips is for old version of multer only.
    try {
        tkn && (ctx.verification = await token.verifyForUser(tkn));
    } catch (err) {
        log(`${(err.message || utilitas.ensureString(err)).replace(/\.$/, '')}: '${tkn}'`);
    }
    await next();
};

const resolveToken = async (ctx, next) => {
    ctx.ok(ctx.verification);
};

const signup = async (ctx, next) => {
    ctx.ok(await user.signup(ctx.request.body));
};

const signin = async (ctx, next) => {
    ctx.ok(await user.signin(ctx.request.body.email,
        ctx.request.body.password));
};

const getMyProfile = async (ctx, next) => {
    ctx.ok(ctx.verification.user);
};

const queryById = async (ctx, next) => {
    ctx.ok(await user.queryByIdOrEmail(ctx.params.id));
};

const updateProfile = async (ctx, next) => {
    ctx.ok(await user.updateById(ctx.verification.user.id,
        ctx.request.body, { curUser: ctx.verification.user }));
};

const emailVerificationRequest = async (ctx, next) => {
    await user.sendVerificationEmail(
        ctx.verification.user.email, { user: ctx.verification.user }
    );
    ctx.ok();
};

const emailVerificationResponse = async (ctx, next) => {
    ctx.ok(await user.verifyEmail(ctx.request.body.token));
};

const passwordRecoveryRequest = async (ctx, next) => {
    await user.sendPasswordRecoveryEmail(ctx.request.body.email);
    ctx.ok();
};

const changePassword = async (ctx, next) => {
    let resp = null;
    if (ctx.request.body.token) {
        resp = await user.changePasswordByVerificationToken(
            ctx.request.body.token, ctx.request.body.newPassword
        );
    } else if (ctx.request.body.email) {
        resp = await user.changePasswordByEmailAndPassword(
            ctx.request.body.email,
            ctx.request.body.curPassword,
            ctx.request.body.newPassword
        );
    } else { throw Object.assign(new Error(), { status: 400 }); }
    ctx.ok(resp);
};

export const { link, actions } = {
    link: 'user',
    actions: [
        {
            path: '*',
            method: 'ALL',
            priority: -8940,
            process: verifyToken,
        },
        {
            path: 'api/tokens',
            method: 'GET',
            process: resolveToken,
            auth: true,
        },
        {
            path: getPath('signup'),
            method: 'POST',
            process: signup,
        },
        {
            path: getPath('signin'),
            method: 'POST',
            process: signin,
        },
        {
            path: getPath('me'),
            method: 'GET',
            process: getMyProfile,
            auth: true,
        },
        {
            path: getPath(':id'),
            method: 'GET',
            process: queryById,
        },
        {
            path: getPath('me'),
            method: 'POST',
            process: updateProfile,
            auth: true,
        },
        {
            path: getPath('email/challenge'),
            method: 'POST',
            process: emailVerificationRequest,
            auth: true,
        },
        {
            path: getPath('email/response'),
            method: 'POST',
            process: emailVerificationResponse,
        },
        {
            path: getPath('password/recover'),
            method: 'POST',
            process: passwordRecoveryRequest,
        },
        {
            path: getPath('password/change'),
            method: 'POST',
            process: changePassword,
        },
    ],
};
