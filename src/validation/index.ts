import { ZodSchema, ZodError } from 'zod';

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }));
    const err: any = new Error('BAD_REQUEST');
    err.code = 'BAD_REQUEST';
    err.details = details;
    throw err;
  }
  return result.data;
}