import type { Request } from 'express';

export function parsePagination(req: Request) {
  const q = req.query as Record<string, string | undefined>;
  const rawLimit = q.limit ?? '20';
  const rawOffset = q.offset ?? '0';
  let limit = Math.max(1, Math.min(100, parseInt(String(rawLimit), 10) || 20));
  let offset = Math.max(0, parseInt(String(rawOffset), 10) || 0);
  return { limit, offset };
}

export function parseOrder(req: Request, defaultField = 'sort') {
  const q = req.query as Record<string, string | undefined>;
  const rawField = (q.sortBy || defaultField) as string;
  const rawDir = (q.direction || 'asc') as string;
  // Simple whitelist: only allow letters, numbers, underscore for field
  const safeField = /^[a-zA-Z0-9_]+$/.test(rawField) ? rawField : defaultField;
  const direction = rawDir?.toLowerCase() === 'desc' ? 'desc' : 'asc';
  return { sortBy: safeField, direction } as const;
}