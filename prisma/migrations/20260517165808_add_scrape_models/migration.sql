-- CreateEnum
CREATE TYPE "ScrapeSourceType" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'REMOTEOK', 'SIMPLIFY_SUMMER', 'SIMPLIFY_NEWGRAD', 'OUCKAH_SUMMER');

-- CreateTable
CREATE TABLE "ScrapeSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ScrapeSourceType" NOT NULL,
    "identifier" TEXT,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "major" TEXT,
    "roles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ScrapeSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "postedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedJobId" TEXT,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "DiscoveredJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeSource_userId_enabled_idx" ON "ScrapeSource"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeSource_userId_type_identifier_key" ON "ScrapeSource"("userId", "type", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeFilter_userId_key" ON "ScrapeFilter"("userId");

-- CreateIndex
CREATE INDEX "DiscoveredJob_userId_dismissedAt_importedJobId_idx" ON "DiscoveredJob"("userId", "dismissedAt", "importedJobId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredJob_userId_source_sourceId_key" ON "DiscoveredJob"("userId", "source", "sourceId");

-- AddForeignKey
ALTER TABLE "ScrapeSource" ADD CONSTRAINT "ScrapeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeFilter" ADD CONSTRAINT "ScrapeFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredJob" ADD CONSTRAINT "DiscoveredJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
