"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../config/auth");
const authMode_1 = require("../config/authMode");
const prisma_1 = require("../db/prisma");
const logger_1 = require("../config/logger");
const errors_1 = require("../utils/errors");
const schemas_1 = require("../validation/schemas");
const native_1 = require("../middleware/native");
const router = (0, express_1.Router)();
function clerkOnly(res) {
    return res.status(405).json((0, errors_1.formatError)('METHOD_NOT_ALLOWED', 'Use Clerk client SDK'));
}
// Temporary visibility to confirm mode during requests
router.use((req, _res, next) => {
    const mode = (0, authMode_1.getAuthMode)();
    logger_1.logger.debug({ mode, path: req.path, method: req.method }, 'auth:router:init');
    next();
});
// User Register
router.post('/auth/user/register', async (req, res) => {
    if ((0, authMode_1.getAuthMode)() === 'clerk')
        return clerkOnly(res);
    const parsed = schemas_1.userRegisterSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json((0, errors_1.formatZodError)(parsed.error));
    const { email, password, name } = parsed.data;
    try {
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(409).json((0, errors_1.formatError)('EMAIL_EXISTS', 'Email already registered'));
        const passwordHash = await (0, native_1.hashPassword)(password);
        const user = await prisma_1.prisma.user.create({ data: { email, name: name ?? email, passwordHash, role: 'USER' } });
        const token = (0, native_1.signNativeJwt)({ uid: user.id, email: user.email, role: user.role });
        res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'User register failed');
        res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'Failed to register'));
    }
});
// User Login
router.post('/auth/user/login', async (req, res) => {
    if ((0, authMode_1.getAuthMode)() === 'clerk')
        return clerkOnly(res);
    const parsed = schemas_1.userLoginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json((0, errors_1.formatZodError)(parsed.error));
    const { email, password } = parsed.data;
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash)
            return res.status(401).json((0, errors_1.formatError)('INVALID_CREDENTIALS', 'Invalid email or password'));
        const ok = await (0, native_1.verifyPassword)(password, user.passwordHash);
        if (!ok)
            return res.status(401).json((0, errors_1.formatError)('INVALID_CREDENTIALS', 'Invalid email or password'));
        const token = (0, native_1.signNativeJwt)({ uid: user.id, email: user.email, role: user.role });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'User login failed');
        res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'Failed to login'));
    }
});
// Admin Register
router.post('/auth/admin/register', async (req, res) => {
    if ((0, authMode_1.getAuthMode)() === 'clerk')
        return clerkOnly(res);
    const parsed = schemas_1.adminRegisterSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json((0, errors_1.formatZodError)(parsed.error));
    const { email, password, name, secret } = parsed.data;
    try {
        if (secret !== auth_1.authConfig.adminBootstrapSecret) {
            return res.status(403).json((0, errors_1.formatError)('FORBIDDEN', 'Invalid bootstrap secret'));
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(409).json((0, errors_1.formatError)('EMAIL_EXISTS', 'Email already registered'));
        const passwordHash = await (0, native_1.hashPassword)(password);
        const user = await prisma_1.prisma.user.create({ data: { email, name: name ?? email, passwordHash, role: 'ADMIN' } });
        const token = (0, native_1.signNativeJwt)({ uid: user.id, email: user.email, role: user.role });
        res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Admin register failed');
        res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'Failed to register admin'));
    }
});
// Admin Login
router.post('/auth/admin/login', async (req, res) => {
    const mode = (0, authMode_1.getAuthMode)();
    // Controller entry checkpoint
    req.log?.debug({ mode }, 'auth:enter');
    if (mode === 'clerk')
        return clerkOnly(res);
    const parsed = schemas_1.adminLoginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json((0, errors_1.formatZodError)(parsed.error));
    const { email, password } = parsed.data;
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
            req.log?.warn({ email }, 'auth:native:login_failed');
            return res.status(401).json((0, errors_1.formatError)('INVALID_CREDENTIALS', 'Invalid admin credentials'));
        }
        const ok = await (0, native_1.verifyPassword)(password, user.passwordHash);
        if (!ok) {
            req.log?.warn({ email }, 'auth:native:login_failed');
            return res.status(401).json((0, errors_1.formatError)('INVALID_CREDENTIALS', 'Invalid admin credentials'));
        }
        const token = (0, native_1.signNativeJwt)({ uid: user.id, email: user.email, role: user.role });
        req.log?.info({ userId: user.id }, 'auth:native:login_success');
        res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Admin login failed');
        res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'Failed to login admin'));
    }
});
// Handshake route for explicit user upsert (both mobile and admin clients)
router.post('/auth/handshake', async (req, res) => {
    const mode = (0, authMode_1.getAuthMode)();
    req.log?.debug({ mode }, 'auth:handshake:enter');
    if (mode === 'clerk') {
        // Clerk mode: verify JWT and perform idempotent upsert
        try {
            const auth = req.headers.authorization || '';
            const [scheme, token] = auth.split(' ');
            if (scheme !== 'Bearer' || !token) {
                res.status(401).json((0, errors_1.formatError)('UNAUTHORIZED', 'Missing Bearer token'));
                return;
            }
            // Use the same JWT verification logic as requireAuthClerk
            const jwt = require('jsonwebtoken');
            const jwksClient = require('jwks-rsa');
            const { authConfig } = require('../config/auth');
            const jwksUri = authConfig.clerkJwksUrl;
            if (!jwksUri) {
                res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'JWKS URL not configured'));
                return;
            }
            const client = jwksClient({
                jwksUri,
                cache: true,
                cacheMaxEntries: 10,
                cacheMaxAge: 60 * 60 * 1000,
                rateLimit: true,
            });
            function getKey(header, callback) {
                if (!header.kid) {
                    return callback(new Error('kid missing'));
                }
                client.getSigningKey(header.kid, (err, key) => {
                    if (err)
                        return callback(err);
                    const signingKey = key?.getPublicKey();
                    callback(null, signingKey);
                });
            }
            // Allow small clock skew to avoid NotBeforeError when token nbf is slightly ahead
            jwt.verify(token, getKey, { algorithms: ['RS256'], clockTolerance: 5 }, async (err, decoded) => {
                if (err || !decoded || typeof decoded !== 'object') {
                    if (err?.name === 'NotBeforeError') {
                        logger_1.logger.warn({ err }, 'Handshake JWT verification failed: not active yet (nbf skew)');
                    }
                    else {
                        logger_1.logger.warn({ err }, 'Handshake JWT verification failed');
                    }
                    return res.status(401).json((0, errors_1.formatError)('INVALID_TOKEN', 'Invalid token'));
                }
                let email = decoded.email;
                let name = decoded.name;
                const clerkId = decoded.sub;
                if (!clerkId) {
                    return res.status(401).json((0, errors_1.formatError)('MISSING_CLAIMS', 'Missing required claims'));
                }
                // Fallback: fetch email/name from Clerk if not present in JWT
                if (!email) {
                    try {
                        const { fetchClerkUserInfo } = await Promise.resolve().then(() => require('../lib/clerk'));
                        const info = await fetchClerkUserInfo(clerkId);
                        if (info) {
                            email = info.email ?? email;
                            name = info.name ?? name;
                        }
                    }
                    catch (e) {
                        logger_1.logger.warn({ e }, 'Failed to load Clerk helper');
                    }
                }
                // Idempotent upsert: try by clerkId, else by email, else create
                let user = await prisma_1.prisma.user.findUnique({ where: { clerkId } });
                if (!user) {
                    if (!email) {
                        return res.status(401).json((0, errors_1.formatError)('MISSING_CLAIMS', 'Missing required claims'));
                    }
                    const byEmail = await prisma_1.prisma.user.findUnique({ where: { email } });
                    if (byEmail) {
                        // Update existing user by email to attach clerkId and name
                        user = await prisma_1.prisma.user.update({
                            where: { email },
                            data: {
                                clerkId,
                                name: name ?? byEmail.name ?? byEmail.email,
                            },
                        });
                    }
                    else {
                        // Create new user with default USER role
                        user = await prisma_1.prisma.user.create({
                            data: {
                                clerkId,
                                email,
                                name: name ?? email,
                                role: 'USER',
                            },
                        });
                    }
                }
                else {
                    // Update existing user's email/name without changing role
                    const updateData = {
                        name: name ?? user.name ?? user.email,
                        ...(email ? { email } : {}),
                    };
                    user = await prisma_1.prisma.user.update({
                        where: { clerkId },
                        data: updateData,
                    });
                }
                req.log?.info({ userId: user.id, role: user.role }, 'auth:handshake:clerk:success');
                res.json({
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        name: user.name
                    }
                });
                return;
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Handshake Clerk error');
            res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'Handshake failed'));
            return;
        }
    }
    else {
        // Native mode: verify JWT and return user info
        try {
            const auth = req.headers.authorization || '';
            const [scheme, token] = auth.split(' ');
            if (scheme !== 'Bearer' || !token) {
                res.status(401).json((0, errors_1.formatError)('UNAUTHORIZED', 'Missing Bearer token'));
                return;
            }
            if (!auth_1.authConfig.jwtSecret) {
                res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'JWT_SECRET not configured'));
                return;
            }
            const jwt = require('jsonwebtoken');
            let decoded;
            try {
                decoded = jwt.verify(token, auth_1.authConfig.jwtSecret, { algorithms: ['HS256'] });
            }
            catch (err) {
                logger_1.logger.warn({ err }, 'Native handshake JWT verification failed');
                res.status(401).json((0, errors_1.formatError)('INVALID_TOKEN', 'Invalid token'));
                return;
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
                res.status(401).json((0, errors_1.formatError)('USER_NOT_FOUND', 'User not found'));
                return;
            }
            req.log?.info({ userId: user.id, role: user.role }, 'auth:handshake:native:success');
            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    name: user.name
                }
            });
            return;
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Handshake native error');
            res.status(500).json((0, errors_1.formatError)('INTERNAL_ERROR', 'Handshake failed'));
            return;
        }
    }
});
exports.default = router;
