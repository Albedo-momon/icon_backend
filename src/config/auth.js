"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authConfig = void 0;
exports.requireAdminBootstrapSecret = requireAdminBootstrapSecret;
exports.getJwtAudience = getJwtAudience;
const zod_1 = require("zod");
const authEnvSchema = zod_1.z.object({
    AUTH_MODE: zod_1.z.enum(['clerk', 'native']).default('clerk'),
    CLERK_JWKS_URL: zod_1.z.string().optional(),
    CLERK_SECRET_KEY: zod_1.z.string().optional(),
    ADMIN_BOOTSTRAP_SECRET: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().optional(),
});
const parsed = authEnvSchema.safeParse(process.env);
if (!parsed.success) {
    // Provide a clearer error for missing/invalid envs
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid auth environment: ${issues}`);
}
const authEnv = parsed.data;
exports.authConfig = {
    mode: (authEnv.AUTH_MODE ?? 'clerk'),
    clerkJwksUrl: authEnv.CLERK_JWKS_URL,
    clerkSecretKey: authEnv.CLERK_SECRET_KEY,
    adminBootstrapSecret: authEnv.ADMIN_BOOTSTRAP_SECRET,
    jwtSecret: authEnv.JWT_SECRET,
    isClerk() {
        return this.mode === 'clerk';
    },
    isNative() {
        return this.mode === 'native';
    },
};
function requireAdminBootstrapSecret(secret) {
    if (!secret || secret.length < 12) {
        throw new Error('ADMIN_BOOTSTRAP_SECRET must be set and at least 12 characters');
    }
}
function getJwtAudience() {
    // Placeholder: If you want to enforce audience checks later, return configured value here.
    return undefined;
}
