import { utilitas } from 'utilitas';

const functions = {};
const packFunc = func => ({ params: func.params, options: func.options });

const assertFunc = name => {
    assert(name, 'Function name required.');
    assert(functions[name], 'Function not registered.');
    return functions[name];
};

const getFunc = (name, options) => {
    const resp = name ? functions[name] : functions;
    assert(resp, 'Function Not Found', 404);
    let result = { ...resp };
    if (!options?.raw) {
        if (name) { result = packFunc(resp); } else {
            for (const name in resp) { result[name] = packFunc(resp[name]); }
        }
    }
    return result;
};

const register = (name, func, options = {}) => {
    assert(name && func, 'Name and function required.');
    return functions[name] = {
        name, func, params: utilitas.getFuncParams(func), options,
    };
};

const unregister = name => {
    const func = assertFunc(name);
    delete functions[name];
    return func;
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
    assertFunc,
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
        if (resp.status === 200) {
            if (options?.stream) {
                const reader = resp.body.getReader();
                for await (const chunk of readChunks(reader)) {
                    await options.stream(textDecoder.decode(
                        chunk
                    ).replace(/\n/g, '').replace(/\r/g, '\n'));
                }
            }
        }
        webAssert(resp.status !== 401, 'Authentication required.', {
            ...optAlert, handler: async () => {
                delSignin(); await options?.requireSignin?.();
            }
        });
        webAssert(resp.status !== 403, 'Permission denied.', optAlert);
        const json = await utilitas.utilitas.ignoreErrFunc(() => resp.json()) || {};
        webAssert(
            resp.status < 400 && json && !json.error,
            json?.error || 'Something went wrong.', optAlert
        );
        return json?.data;
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
    getFunc,
    getRuntime,
    register,
    unregister,
};
