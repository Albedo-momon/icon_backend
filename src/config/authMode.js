"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthMode = getAuthMode;
exports.isClerkMode = isClerkMode;
exports.isNativeMode = isNativeMode;
function getAuthMode() {
    const raw = (process.env.AUTH_MODE || '').trim().toLowerCase();
    return raw === 'native' ? 'native' : 'clerk';
}
function isClerkMode() {
    return getAuthMode() === 'clerk';
}
function isNativeMode() {
    return getAuthMode() === 'native';
}
