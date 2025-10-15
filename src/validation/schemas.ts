import { z } from 'zod';

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);

// Auth payloads (native mode)
export const userRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).optional(),
});

export const userLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const adminRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).optional(),
  secret: z.string().min(12),
});

export const adminLoginSchema = userLoginSchema;

// Banner
export const heroBannerSchema = z.object({
  imageUrl: z.string().url(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  sortOrder: z.number().int().min(0).default(0),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

// Offers
export const offerBase = z.object({
  imageUrl: z.string().url(),
  productName: z.string().min(1),
  priceCents: z.number().int().positive(),
  discountedCents: z.number().int().nonnegative(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  sortOrder: z.number().int().min(0).default(0),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export const specialOfferSchema = offerBase;
export const laptopOfferSchema = offerBase;