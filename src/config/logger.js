"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = require("pino");
const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';
const opts = { level };
if (!isProd) {
    opts.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            singleLine: true,
        },
    };
}
exports.logger = (0, pino_1.default)(opts);
