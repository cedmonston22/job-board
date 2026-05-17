/*
  Warnings:

  - You are about to drop the column `fitReasoning` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "fitReasoning",
ADD COLUMN     "fitGaps" TEXT[],
ADD COLUMN     "fitScoredAt" TIMESTAMP(3),
ADD COLUMN     "fitStrengths" TEXT[],
ADD COLUMN     "fitSummary" TEXT;
