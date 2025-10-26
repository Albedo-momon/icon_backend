"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatError = formatError;
exports.formatZodError = formatZodError;
function formatError(code, message, details) {
    return { error: { code, message, details } };
}
function formatZodError(error) {
    return formatError('VALIDATION_ERROR', 'Invalid request payload', error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
    })));
}
