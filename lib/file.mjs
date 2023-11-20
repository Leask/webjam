import { dbio, encryption, storage, uoid, utilitas, uuid } from 'utilitas';
import { join, parse } from 'path';
import { promises as fs } from 'fs';
import { queryById } from './user.mjs';
import multer from '@koa/multer';
import serve from 'koa-static';

const _NEED = ['@google-cloud/storage', 'mysql2'];
const [table, storageSubPath] = ['files', 'storage'];
const log = content => utilitas.log(content, import.meta.url);
const newId = () => uoid.create({ file: import.meta.url });
const getStoragePath = opts => opts.storagePath || getPublicPath(opts)[0];
const getBufferPath = options => options.bufferPath || '/tmp';
const upload = (method, options) => objMulter[method || 'any'](options);

let [objMulter, client, bucket, gcUrl] = [null, null, null, null];

const handle501Error = (error) => {
    if (error.status !== 501) {
        console.log(error);
        return error;
    };
};

const getPublicPath = (options) => utilitas.ensureArray(options.publicPath
    || utilitas.__(import.meta.url, '../public'));

const formatPath = (filename, options) => {
    const subPath = join(
        storageSubPath, storage.mapFilename(filename), filename
    );
    const fullPath = join(getStoragePath(options), subPath);
    const url = `${gcUrl || globalThis.webjam.origin}/${subPath}`;
    return { subPath, fullPath, url };
};

const allocate = async (filename, options) => {
    options = options || {};
    filename = (options.newName ? uuid.v4()
        : await encryption.sha256File(filename)) + parse(filename).ext;
    const { subPath, fullPath, url } = formatPath(filename, options);
    const slot = Object.assign(parse(fullPath),
        { url, path: fullPath, subPath });
    slot.destination = slot.dir; delete slot.dir;
    slot.filename = slot.base; delete slot.base;
    try {
        slot.fileStat = await (client
            ? storage.existsOnCloud(subPath) : fs.stat(fullPath));
    } catch (err) { }
    if (options.touchPath) {
        slot.dirStat = await storage.touchPath(slot.destination);
    }
    return slot;
};

const packFile = async (data, options) => {
    options = options || {};
    if (data && !options.asPlain) {
        data.url = formatPath(data.filename, options).url;
    }
    if (data && data.userId && !options.skipUser) {
        data.user = options.user || await queryById(data.userId);
    }
    return data;
};

const record = async (data, options) => {
    const now = new Date();
    const field = {
        id: newId(),
        userId: data.userId || '',
        filename: data.filename,
        originalname: data.originalname || '',
        mimetype: data.mimetype || '',
        size: data.size || 0,
        createdAt: now,
        updatedAt: now,
    };
    try {
        return packFile(await dbio.insert(table, field, options), options);
    } catch (err) { handle501Error(err); }
};

const publish = async (options) => {
    options = options || {};
    const arrPath = getPublicPath(options);
    for (let pubPath of arrPath) {
        await storage.assertPath(pubPath, 'D', 'R');
        globalThis.webjam.app.use(serve(pubPath));
        ~~process.env.FORKED === 1 && log(`PUBLIC: ${pubPath}`);
    }
    return arrPath;
};

const accept = async (options) => {
    const bufferPath = getBufferPath(options);
    ~~process.env.FORKED === 1 && log(`BUFFER: ${bufferPath}`);
    if (utilitas.ensureString(options?.provider, { case: 'UP' }) === 'GOOGLE') {
        const resp = await storage.init(options);
        [client, bucket, gcUrl] = [resp.client, resp.bucket, resp.url];
    }
    return objMulter = multer(options.multer || {
        storage: multer.diskStorage({
            destination: bufferPath,
            filename: (req, file, cbf) => {
                cbf(null, uuid.v4() + parse(file.originalname).ext.toLowerCase());
            },
        }),
    });
};

// https://github.com/googleapis/nodejs-storage/blob/master/samples/uploadFile.js
const share = async (ctx, next) => {
    for (let file of ctx.request.files || []) {
        const slot = await allocate(file.path, { touchPath: !bucket });
        if (slot.fileStat) {
            log(`DUPLICATE: ${slot.filename}`);
        } else if (bucket) {
            console.log(file.path, slot.subPath);
            slot.fileStat = await storage.uploadToCloud(
                file.path, slot.subPath, { input: 'FILE' }
            );
        } else {
            await fs.rename(file.path, slot.path);
            slot.fileStat = await fs.stat(slot.path);
        }
        try { await fs.unlink(file.path); } catch (err) { }
        try {
            slot.receipt = await record({
                userId: ctx.verification && ctx.verification.user.id,
                filename: slot.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            }, { user: ctx.verification.user });
        } catch (err) { handle501Error(err); }
        Object.assign(file, slot);
    }
    await next();
};

const init = async (options) => {
    await publish(options);
    await accept(options);
};

export {
    _NEED,
    accept,
    init,
    publish,
    upload,
    share,
};
