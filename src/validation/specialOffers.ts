import { z } from 'zod';

// HTTPS-only URL for images
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'https URL required',
});

// Block C DTOs (new shape)
const dateString = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
]);

export const specialOfferCreateSchema = z.object({
  name: z.string().min(1),
  imageUrl: httpsUrl,
  price: z.number().int().positive(),
  discounted: z.number().int().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  validFrom: dateString.optional(),
  validTo: dateString.optional(),
}).refine((data) => data.discounted <= data.price, {
  message: 'discounted must be ≤ price',
  path: ['discounted'],
}).refine((data) => {
  if (data.validFrom && data.validTo) {
    const from = new Date(data.validFrom);
    const to = new Date(data.validTo);
    return from <= to;
  }
  return true;
}, {
  message: 'validFrom must be before or equal to validTo',
  path: ['validFrom'],
});

export const specialOfferUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  imageUrl: httpsUrl.optional(),
  price: z.number().int().positive().optional(),
  discounted: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  validFrom: dateString.optional(),
  validTo: dateString.optional(),
}).refine((data) => {
  if (data.price != null && data.discounted != null) {
    return data.discounted <= data.price;
  }
  return true;
}, {
  message: 'discounted must be ≤ price',
  path: ['discounted'],
}).refine((data) => {
  if (data.validFrom && data.validTo) {
    const from = new Date(data.validFrom);
    const to = new Date(data.validTo);
    return from <= to;
  }
  return true;
}, {
  message: 'validFrom must be before or equal to validTo',
  path: ['validFrom'],
});

export type SpecialOfferCreate = z.infer<typeof specialOfferCreateSchema>;
export type SpecialOfferUpdate = z.infer<typeof specialOfferUpdateSchema>;