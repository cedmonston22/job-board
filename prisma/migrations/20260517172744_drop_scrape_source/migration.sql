/*
  Warnings:

  - You are about to drop the `ScrapeSource` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ScrapeSource" DROP CONSTRAINT "ScrapeSource_userId_fkey";

-- DropTable
DROP TABLE "ScrapeSource";
