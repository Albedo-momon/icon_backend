/*
  Warnings:

  - You are about to drop the `addresses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `banners` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `devices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feedback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `offers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `request_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sections_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shops` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `timers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AGENT', 'ADMIN');

-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."agents" DROP CONSTRAINT "agents_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."agents" DROP CONSTRAINT "agents_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."banners" DROP CONSTRAINT "banners_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."devices" DROP CONSTRAINT "devices_agentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."devices" DROP CONSTRAINT "devices_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."feedback" DROP CONSTRAINT "feedback_requestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."offers" DROP CONSTRAINT "offers_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."request_events" DROP CONSTRAINT "request_events_requestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."requests" DROP CONSTRAINT "requests_addressId_fkey";

-- DropForeignKey
ALTER TABLE "public"."requests" DROP CONSTRAINT "requests_assignedAgentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."requests" DROP CONSTRAINT "requests_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."requests" DROP CONSTRAINT "requests_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."sections_configs" DROP CONSTRAINT "sections_configs_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."timers" DROP CONSTRAINT "timers_requestId_fkey";

-- DropTable
DROP TABLE "public"."addresses";

-- DropTable
DROP TABLE "public"."agents";

-- DropTable
DROP TABLE "public"."banners";

-- DropTable
DROP TABLE "public"."devices";

-- DropTable
DROP TABLE "public"."feedback";

-- DropTable
DROP TABLE "public"."offers";

-- DropTable
DROP TABLE "public"."products";

-- DropTable
DROP TABLE "public"."request_events";

-- DropTable
DROP TABLE "public"."requests";

-- DropTable
DROP TABLE "public"."sections_configs";

-- DropTable
DROP TABLE "public"."shops";

-- DropTable
DROP TABLE "public"."timers";

-- DropTable
DROP TABLE "public"."users";

-- DropEnum
DROP TYPE "public"."AgentStatus";

-- DropEnum
DROP TYPE "public"."IssueType";

-- DropEnum
DROP TYPE "public"."Platform";

-- DropEnum
DROP TYPE "public"."RequestStatus";

-- DropEnum
DROP TYPE "public"."UserRole";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "mobileNum" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroBanner" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialOffer" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "discountedCents" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaptopOffer" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "discountedCents" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaptopOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
