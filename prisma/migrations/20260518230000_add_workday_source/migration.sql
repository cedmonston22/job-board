-- AlterEnum
-- Insert WORKDAY between ASHBY and REMOTEOK so the enum ordering matches
-- the order declared in schema.prisma. Postgres ADD VALUE is non-blocking
-- (no table rewrite) so this is safe to run during traffic.
ALTER TYPE "ScrapeSourceType" ADD VALUE 'WORKDAY' BEFORE 'REMOTEOK';
