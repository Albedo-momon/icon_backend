import { z } from 'zod';

// HTTPS-only URL for images
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'https URL required',
});

// Block D DTOs
export const laptopOfferCreateSchema = z.object({
  model: z.string().min(1),
  imageUrl: httpsUrl.optional(),
  price: z.number().int().positive(),
  discounted: z.number().int().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  specs: z.record(z.string(), z.any()).optional(),
}).refine((data) => data.discounted <= data.price, {
  message: 'discounted must be ≤ price',
  path: ['discounted'],
});

export const laptopOfferUpdateSchema = z.object({
  model: z.string().min(1).optional(),
  imageUrl: httpsUrl.optional(),
  price: z.number().int().positive().optional(),
  discounted: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  specs: z.record(z.string(), z.any()).optional(),
}).refine((data) => {
  if (data.price != null && data.discounted != null) {
    return data.discounted <= data.price;
  }
  return true;
}, {
  message: 'discounted must be ≤ price',
  path: ['discounted'],
});

export type LaptopOfferCreate = z.infer<typeof laptopOfferCreateSchema>;
export type LaptopOfferUpdate = z.infer<typeof laptopOfferUpdateSchema>;