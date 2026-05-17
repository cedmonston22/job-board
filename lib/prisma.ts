import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 no longer ships a bundled query engine — you must supply a "driver
// adapter" that knows how to talk to your database. For Neon Postgres, the
// `@prisma/adapter-neon` adapter uses Neon's HTTP-based serverless driver,
// which avoids opening a persistent TCP connection on every cold start. That
// keeps response times fast on serverless platforms like Vercel.
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local before running queries.",
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// In Next.js dev mode the module cache is reset on every hot reload, which
// would create a fresh PrismaClient on each save and quickly exhaust the
// database's connection pool. We cache the instance on `globalThis` so the
// same client survives across reloads. In production this branch is skipped
// and we use a normal module-scoped singleton.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
