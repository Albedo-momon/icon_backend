import { z } from 'zod';

export const AllowedContentTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const PresignBodySchema = z.object({
  section: z.enum(['hero', 'special', 'laptop']),
  filename: z.string().min(1).max(200),
  contentType: z.enum(AllowedContentTypes),
});

export function validateContentType(ct: string): boolean {
  return (AllowedContentTypes as readonly string[]).includes(ct);
}