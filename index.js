'use strict';

const path = require('path');
const fs = require('fs');

module.exports = require('utilitas');
const libPath = path.join(__dirname, 'lib');
fs.readdirSync(libPath).filter((file) => {
    return /\.js$/i.test(file);
}).forEach((file) => {
    module.exports[file.replace(/^(.*)\.js$/, '$1')]
        = require(path.join(libPath, file));
});