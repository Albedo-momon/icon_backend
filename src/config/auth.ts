import { z } from 'zod';

const authEnvSchema = z.object({
  AUTH_MODE: z.enum(['clerk', 'native']).default('clerk'),
  CLERK_JWKS_URL: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  ADMIN_BOOTSTRAP_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
});

const parsed = authEnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Provide a clearer error for missing/invalid envs
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
  throw new Error(`Invalid auth environment: ${issues}`);
}

const authEnv = parsed.data;

export type AuthMode = 'clerk' | 'native';

export const authConfig = {
  mode: (authEnv.AUTH_MODE ?? 'clerk') as AuthMode,
  clerkJwksUrl: authEnv.CLERK_JWKS_URL,
  clerkSecretKey: authEnv.CLERK_SECRET_KEY,
  adminBootstrapSecret: authEnv.ADMIN_BOOTSTRAP_SECRET,
  jwtSecret: authEnv.JWT_SECRET,
  isClerk(): boolean {
    return this.mode === 'clerk';
  },
  isNative(): boolean {
    return this.mode === 'native';
  },
};

export function requireAdminBootstrapSecret(secret?: string): void {
  if (!secret || secret.length < 12) {
    throw new Error('ADMIN_BOOTSTRAP_SECRET must be set and at least 12 characters');
  }
}

export function getJwtAudience(): string | undefined {
  // Placeholder: If you want to enforce audience checks later, return configured value here.
  return undefined;
}