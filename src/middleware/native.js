"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthNative = requireAuthNative;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signNativeJwt = signNativeJwt;
const jsonwebtoken_1 = require("jsonwebtoken");
const bcrypt_1 = require("bcrypt");
const prisma_1 = require("../db/prisma");
const logger_1 = require("../config/logger");
const auth_1 = require("../config/auth");
const authMode_1 = require("../config/authMode");
const jwtSecret = auth_1.authConfig.jwtSecret;
async function requireAuthNative(req, res, next) {
    try {
        if ((0, authMode_1.getAuthMode)() !== 'native')
            return res.status(500).json({ error: 'Native auth disabled' });
        const auth = req.headers.authorization || '';
        const [scheme, token] = auth.split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ error: 'Missing Bearer token' });
        }
        if (!jwtSecret) {
            logger_1.logger.error('JWT_SECRET is not configured for native auth');
            return res.status(500).json({ error: 'JWT_SECRET not configured' });
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret, { algorithms: ['HS256'] });
        }
        catch (err) {
            logger_1.logger.warn({ err }, 'Native JWT verification failed');
            return res.status(401).json({ error: 'Invalid token' });
        }
        const userId = decoded.uid || decoded.sub;
        const email = decoded.email;
        let user = null;
        if (userId) {
            user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        }
        if (!user && email) {
            user = await prisma_1.prisma.user.findUnique({ where: { email } });
        }
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = { id: user.id, email: user.email, role: user.role };
        return next();
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Native auth error');
        return res.status(500).json({ error: 'Auth error' });
    }
}
// Utility helpers for native mode (potentially used by register/login endpoints)
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, 10);
}
async function verifyPassword(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
function signNativeJwt(payload, expiresIn = '7d') {
    const options = { algorithm: 'HS256', expiresIn: expiresIn };
    if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
    }
    return jsonwebtoken_1.default.sign(payload, jwtSecret, options);
}
