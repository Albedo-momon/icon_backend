import { ZodError } from 'zod';

export function formatError(code: string, message: string, details?: any) {
  return { error: { code, message, details } };
}

export function formatZodError(error: ZodError) {
  return formatError('VALIDATION_ERROR', 'Invalid request payload', error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  })));
}