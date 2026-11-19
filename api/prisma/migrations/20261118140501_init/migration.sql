-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'YEAR', 'FOREVER');

-- CreateEnum
CREATE TYPE "Payer" AS ENUM ('SENDER', 'RECIPIENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('VOICE', 'PHOTO');

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "senderTokenHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recipientName" TEXT NOT NULL,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "voiceKey" TEXT,
    "voiceSeconds" INTEGER,
    "photoKey" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "deliverAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "remindNextYear" BOOLEAN NOT NULL DEFAULT false,
    "remindedForYear" INTEGER,
    "showUnderTree" BOOLEAN NOT NULL DEFAULT false,
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "plan" "Plan" NOT NULL,
    "payer" "Payer" NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "requestedDeliverAt" TIMESTAMP(3),
    "email" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "giftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gift_slug_key" ON "Gift"("slug");

-- CreateIndex
CREATE INDEX "Gift_campaign_createdAt_idx" ON "Gift"("campaign", "createdAt");

-- CreateIndex
CREATE INDEX "Gift_expiresAt_idx" ON "Gift"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_giftId_idx" ON "Payment"("giftId");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_key_key" ON "Upload"("key");

-- CreateIndex
CREATE INDEX "Upload_giftId_createdAt_idx" ON "Upload"("giftId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
