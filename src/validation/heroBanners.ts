import { z } from 'zod';

// Require HTTPS-only URLs for image resources
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'https URL required',
});

// Create DTO: strict fields per spec
export const heroBannerCreateSchema = z.object({
  title: z.string().min(1),
  imageUrl: httpsUrl,
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  sort: z.number().int().min(0).default(0),
});

// Update DTO: all optional, same constraints
export const heroBannerUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  imageUrl: httpsUrl.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sort: z.number().int().min(0).optional(),
});

export type HeroBannerCreate = z.infer<typeof heroBannerCreateSchema>;
export type HeroBannerUpdate = z.infer<typeof heroBannerUpdateSchema>;