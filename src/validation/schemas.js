"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.laptopOfferSchema = exports.specialOfferSchema = exports.offerBase = exports.heroBannerSchema = exports.adminLoginSchema = exports.adminRegisterSchema = exports.userLoginSchema = exports.userRegisterSchema = exports.passwordSchema = exports.emailSchema = void 0;
const zod_1 = require("zod");
exports.emailSchema = zod_1.z.string().email();
exports.passwordSchema = zod_1.z.string().min(8);
// Auth payloads (native mode)
exports.userRegisterSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    name: zod_1.z.string().min(1).optional(),
});
exports.userLoginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
});
exports.adminRegisterSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    name: zod_1.z.string().min(1).optional(),
    secret: zod_1.z.string().min(12),
});
exports.adminLoginSchema = exports.userLoginSchema;
// Banner
exports.heroBannerSchema = zod_1.z.object({
    imageUrl: zod_1.z.string().url(),
    title: zod_1.z.string().optional(),
    subtitle: zod_1.z.string().optional(),
    ctaText: zod_1.z.string().optional(),
    ctaLink: zod_1.z.string().url().optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    sortOrder: zod_1.z.number().int().min(0).default(0),
    validFrom: zod_1.z.string().datetime().optional(),
    validTo: zod_1.z.string().datetime().optional(),
});
// Offers
exports.offerBase = zod_1.z.object({
    imageUrl: zod_1.z.string().url(),
    productName: zod_1.z.string().min(1),
    priceCents: zod_1.z.number().int().positive(),
    discountedCents: zod_1.z.number().int().nonnegative(),
    discountPercent: zod_1.z.number().int().min(0).max(100).optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    sortOrder: zod_1.z.number().int().min(0).default(0),
    validFrom: zod_1.z.string().datetime().optional(),
    validTo: zod_1.z.string().datetime().optional(),
});
exports.specialOfferSchema = exports.offerBase;
exports.laptopOfferSchema = exports.offerBase;
