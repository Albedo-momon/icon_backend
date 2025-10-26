-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OperationalStatus" AS ENUM ('FREE', 'BUSY');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('ON_SITE', 'IN_SHOP');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('REPAIR', 'PC_BUILD');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'SEARCHING', 'SENT_TO_AGENT', 'WAITING_AGENT_APPROVAL', 'AGENT_ACCEPTED', 'ETA_CONFIRMED', 'DIAGNOSIS_PENDING', 'DIAGNOSIS_STARTED', 'DIAGNOSIS_COMPLETED', 'REPAIR_IN_PROGRESS', 'BUILD_IN_PROGRESS', 'BUILD_DONE', 'SOFTWARE_INSTALL_IN_PROGRESS', 'INSTALLATION_DONE', 'TESTING_QA', 'TESTING_DONE', 'SCHEDULED_NEXT_VISIT', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_ADMIN', 'CANCELLED_BY_AGENT');

-- CreateEnum
CREATE TYPE "ServiceDomain" AS ENUM ('COMPUTER', 'LAPTOP', 'CCTV', 'PRINTER', 'NETWORKING', 'OTHER');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventActorRole" AS ENUM ('USER', 'AGENT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('CREATED', 'STATUS_CHANGED', 'OFFER_CREATED', 'OFFER_CHANGED', 'AGENT_ASSIGNED', 'AGENT_REASSIGNED', 'ETA_SET', 'SESSION_STARTED', 'SESSION_ENDED', 'FEEDBACK_ADDED', 'NOTE_ADDED', 'PAYMENT_UPDATED');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_TIMEOUT', 'ETA_CONFIRMED', 'DIAGNOSIS_STARTED', 'DIAGNOSIS_COMPLETED', 'REPAIR_IN_PROGRESS', 'BUILD_PHASE_CHANGED', 'COMPLETED', 'CANCELLED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('STARTED', 'ENDED');

-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('USER', 'AGENT', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL,
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
    "price" INTEGER NOT NULL,
    "discounted" INTEGER NOT NULL,
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
    "price" INTEGER NOT NULL,
    "discounted" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaptopOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "operationalStatus" "OperationalStatus" NOT NULL DEFAULT 'FREE',
    "serviceTags" TEXT[],
    "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "jobsDone" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingType" "BookingType" NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "serviceDomain" "ServiceDomain" NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "problemNote" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "etaMinutes" INTEGER,
    "addressLine1" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentOffer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSession" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "byUserId" TEXT,
    "byRole" "EventActorRole" NOT NULL,
    "kind" "EventKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "principalType" "PrincipalType" NOT NULL,
    "principalId" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientType" "PrincipalType" NOT NULL,
    "recipientId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "bookingId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_accountStatus_onboardingStatus_idx" ON "Agent"("accountStatus", "onboardingStatus");

-- CreateIndex
CREATE INDEX "Agent_operationalStatus_sortOrder_idx" ON "Agent"("operationalStatus", "sortOrder");

-- CreateIndex
CREATE INDEX "Booking_bookingType_issueType_serviceDomain_idx" ON "Booking"("bookingType", "issueType", "serviceDomain");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_agentId_status_idx" ON "Booking"("agentId", "status");

-- CreateIndex
CREATE INDEX "Booking_userId_updatedAt_idx" ON "Booking"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssignmentOffer_agentId_status_idx" ON "AssignmentOffer"("agentId", "status");

-- CreateIndex
CREATE INDEX "AssignmentOffer_bookingId_idx" ON "AssignmentOffer"("bookingId");

-- CreateIndex
CREATE INDEX "AssignmentOffer_bookingId_status_createdAt_idx" ON "AssignmentOffer"("bookingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "JobSession_bookingId_startAt_idx" ON "JobSession"("bookingId", "startAt");

-- CreateIndex
CREATE INDEX "JobSession_agentId_startAt_idx" ON "JobSession"("agentId", "startAt");

-- CreateIndex
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingEvent_kind_idx" ON "BookingEvent"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_bookingId_key" ON "Feedback"("bookingId");

-- CreateIndex
CREATE INDEX "Feedback_agentId_idx" ON "Feedback"("agentId");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_principalType_principalId_platform_idx" ON "DeviceToken"("principalType", "principalId", "platform");

-- CreateIndex
CREATE INDEX "Notification_recipientType_recipientId_createdAt_idx" ON "Notification"("recipientType", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_bookingId_createdAt_idx" ON "Notification"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOffer" ADD CONSTRAINT "AssignmentOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOffer" ADD CONSTRAINT "AssignmentOffer_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSession" ADD CONSTRAINT "JobSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSession" ADD CONSTRAINT "JobSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
