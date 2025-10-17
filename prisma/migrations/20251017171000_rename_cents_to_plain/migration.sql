-- Rename legacy cents columns to plain integer fields and migrate data

BEGIN;

-- SpecialOffer: add new columns with safe defaults, copy data, drop defaults, remove old columns
ALTER TABLE "SpecialOffer" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SpecialOffer" ADD COLUMN "discounted" INTEGER NOT NULL DEFAULT 0;
UPDATE "SpecialOffer" SET "price" = "priceCents", "discounted" = "discountedCents";
ALTER TABLE "SpecialOffer" ALTER COLUMN "price" DROP DEFAULT;
ALTER TABLE "SpecialOffer" ALTER COLUMN "discounted" DROP DEFAULT;
ALTER TABLE "SpecialOffer" DROP COLUMN "priceCents";
ALTER TABLE "SpecialOffer" DROP COLUMN "discountedCents";

-- LaptopOffer: add new columns with safe defaults, copy data, drop defaults, remove old columns
ALTER TABLE "LaptopOffer" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LaptopOffer" ADD COLUMN "discounted" INTEGER NOT NULL DEFAULT 0;
UPDATE "LaptopOffer" SET "price" = "priceCents", "discounted" = "discountedCents";
ALTER TABLE "LaptopOffer" ALTER COLUMN "price" DROP DEFAULT;
ALTER TABLE "LaptopOffer" ALTER COLUMN "discounted" DROP DEFAULT;
ALTER TABLE "LaptopOffer" DROP COLUMN "priceCents";
ALTER TABLE "LaptopOffer" DROP COLUMN "discountedCents";

COMMIT;