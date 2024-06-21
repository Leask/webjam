import { callosum, uoid, utilitas } from 'utilitas';

const UNIVERSAL = 'UNIVERSAL';
const register = (n, f, o) => callosum.register(n, f, { type: UNIVERSAL, ...o || {} });
const unregister = callosum.register;
const isUniversal = func => func?.options?.type === UNIVERSAL;
const newUniversalStream = () => uoid.create({ type: 'STREAM_SESSION', security: 1 });
const life = 1000 * 60 * 10; // 10 minutes

const assertFunc = name => {
    let func;
    if (typeof callosum === 'undefined') {
        assert(name, 'Function name required.');
        assert(func = functions[name], 'Function not registered.');
    } else { func = callosum.assertFunc(name); }
    assert(isUniversal(func), 'Function is not universal.', 400);
    return func;
};

const getFunc = (name, options) => {
    let func = callosum.getFunc(name, options);
    if (name) { func = isUniversal(func) ? func : null; } else {
        for (const name in func) {
            if (!isUniversal(func[name])) { delete func[name]; }
        }
    }
    assert(func, 'Function Not Found', 404);
    return func;
};

const writeStreamSession = async (id, chunk, options) => {
    id || (id = newUniversalStream());
    if (utilitas.isSet(chunk, true)) {
        chunk = utilitas.ensureString(chunk || '');
    } else { chunk = null; }
    return await callosum.push(
        id, chunk, { ...options || {}, confirm: true, life }
    );
};

const flushSteamSession = async (id, options) => {
    const resp = await callosum.flush(id, options);
    if (!resp) { return; }
    resp[resp.length - 1] === null && await endStreamSession(id);
    return resp;
};

const endStreamSession = callosum.delKey;

const getStreamer = async (id) => {
    id || (id = (await writeStreamSession(null, '')).key);
    const stream = async (evt, opt) => await writeStreamSession(id, evt, opt);
    stream.id = id;
    stream.write = stream;
    stream.flush = async (options) => await flushSteamSession(id, options);
    stream.end = async (options) => await endStreamSession(id, options);
    return stream;
};

const call = async (name, params, options) => {
    const func = assertFunc(name);
    assert(!func.options?.auth || options?.user, 'Authentication required.', 401);
    return await func.func(...utilitas.assembleBuffer(params));
};

const runtime = {
    _JSON: 'application/json',
    BLOB: 'BLOB',
    BUFFER: 'BUFFER',
    DataURL: 'DataURL',
    DATAURL: 'DATAURL',
    GET: 'GET',
    POST: 'POST',
    SIGNIN: 'signin',
    UNIVERSAL: 'UNIVERSAL',
    assertFunc,
    isUniversal,
    resetSignin: () => localStorage.clear(),
    getSignin: () => utilitas.utilitas.parseJson(localStorage.getItem(SIGNIN)),
    getToken: () => getSignin()?.token?.id,
    delSignin: () => localStorage.removeItem(SIGNIN),

    webAssert: (condition, message, options) => {
        if (condition) { return; }
        (options?.alert || alert)(`Error: ${message}`);
        options?.handler?.(message);
        utilitas.utilitas.throwError(message);
    },

    readChunks: reader => ({
        async*[Symbol.asyncIterator]() {
            let result = await reader.read();
            while (!result.done) {
                yield result.value;
                result = await reader.read();
            }
        },
    }),

    callApi: async (path, query, post, options) => {
        assert(path, 'API path required.');
        const url = utilitas.utilitas.assembleUrl(`/api/${path}`, query || {});
        const token = options?.token || getToken();
        const optAlert = { alert: options?.alert };
        const textDecoder = new TextDecoder();
        let body = null, contentType = null;
        if (post?.constructor?.name === 'FormData') { body = post; }
        else if (post) { body = JSON.stringify(post); contentType = _JSON; }
        const resp = await fetch(url, {
            method: options?.method || (post ? POST : GET), body, headers: {
                'Accept': _JSON, 'Authorization': token ? `Bearer ${token}` : null,
                ...contentType ? { 'Content-Type': contentType } : {},
                ...options?.headers || {},
            }, ...options || {},
        });
        if (options?.stream) {
            switch (resp.status) {
                case 200:
                    const reader = resp.body.getReader();
                    for await (const chunk of readChunks(reader)) {
                        await options.stream(textDecoder.decode(
                            chunk
                        ).replace(/\n/g, '').replace(/\r/g, '\n'));
                    }
                    break;
                case 404:
                    return;
            }
        }
        webAssert(resp.status !== 401, 'Authentication required.', {
            ...optAlert, handler: async () => {
                delSignin(); await options?.requireSignin?.();
            }
        });
        webAssert(resp.status !== 403, 'Permission denied.', optAlert);
        const json = await utilitas.utilitas.ignoreErrFunc(() => resp.json()) || {};
        const data = json?.data;
        webAssert(
            resp.status < 400 && json && !json.error,
            json?.error || 'Something went wrong.', optAlert
        );
        if (options?.stream && [201, 206].includes(resp.status) && data.id) {
            setTimeout(async () => await options.stream((await callApi(
                `universal/stream/${data.id}`, { t: Date.now() },
                null, { stream: options.stream }))?.content || ''
            ), 1000 * 1);
        }
        return data;
    },

    callFunc: async (name, params, options) => {
        assertFunc(name);
        [params, options] = [params || [], options || {}];
        const last = params.length - 1;
        if (options?.autoStream !== false && params[last]?.stream) {
            options.stream = options?.stream || params[last].stream;
            params[last].stream = true;
        };
        return callApi(`universal/${name}`, null, params, options);
    },

    handleFileSelect: async (event, options) => {
        const files = [];
        for (let i = 0; i < event.target.files.length; i++) {
            files.push((async file => ({
                lastModified: file.lastModified,
                lastModifiedDate: file.lastModifiedDate,
                webkitRelativePath: file.webkitRelativePath,
                name: file.name, size: file.size, type: file.type,
                buffer: options?.buffer
                    ? await utilitas.storage.convert(file, { input: BLOB, expected: BUFFER })
                    : { type: DataURL, data: await utilitas.storage.convert(file, { input: BLOB, expected: DATAURL }) },
            }))(event.target.files[i]));
        }
        return await Promise.all(files);
    },
};

const getRuntime = () => {
    const resp = [];
    for (const key in runtime) {
        resp.push(`const ${key} = ${Function.isFunction(runtime[key]) ? runtime[key].toString() : JSON.stringify(runtime[key])}`);
    }
    return resp.join('\n\n');
};

export {
    call,
    endStreamSession,
    flushSteamSession,
    getFunc,
    getRuntime,
    getStreamer,
    newUniversalStream,
    register,
    unregister,
    writeStreamSession,
};
