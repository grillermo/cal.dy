-- CreateEnum
CREATE TYPE "public"."VennProvider" AS ENUM ('CALENDLY', 'CALCOM', 'LOCAL');

-- CreateEnum
CREATE TYPE "public"."VennStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "public"."VennContact" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bookingUrl" TEXT NOT NULL,
    "provider" "public"."VennProvider" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VennContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VennSearch" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "contactIds" INTEGER[],
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "status" "public"."VennStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VennSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VennSearchResult" (
    "id" SERIAL NOT NULL,
    "searchId" TEXT NOT NULL,
    "contactId" INTEGER NOT NULL,
    "status" "public"."VennStatus" NOT NULL DEFAULT 'PENDING',
    "durationMinutes" INTEGER,
    "freeIntervals" JSONB,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3),

    CONSTRAINT "VennSearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VennContact_userId_bookingUrl_key" ON "public"."VennContact"("userId", "bookingUrl");

-- CreateIndex
CREATE INDEX "VennSearch_userId_createdAt_idx" ON "public"."VennSearch"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VennSearchResult_searchId_contactId_key" ON "public"."VennSearchResult"("searchId", "contactId");

-- AddForeignKey
ALTER TABLE "public"."VennContact" ADD CONSTRAINT "VennContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VennSearchResult" ADD CONSTRAINT "VennSearchResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "public"."VennSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
