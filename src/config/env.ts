import dotenvFlow from 'dotenv-flow';
import { z } from 'zod';

// Load layered environment variables early and with explicit precedence
const nodeEnv = process.env.NODE_ENV || 'development';
dotenvFlow.config({ node_env: nodeEnv, default_node_env: 'development', override: true });
// Temporary visibility for diagnosis (no secrets)
console.log(`Env loaded: NODE_ENV=${process.env.NODE_ENV}, AUTH_MODE=${(process.env.AUTH_MODE || '').trim()}`);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.string().default('8080').transform(Number),
  CORS_ORIGINS: z.string().default('*'),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
  }
};

export const env = parseEnv();