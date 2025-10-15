import dotenvFlow from 'dotenv-flow';
import { z } from 'zod';

// Load layered environment variables (.env, .env.development, .env.local)
dotenvFlow.config();

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