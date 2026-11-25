import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/asistencial/client";

const connectionString = process.env.DATABASE_URL_ASISTENCIAL;
if (!connectionString)
  throw new Error("Falta DATABASE_URL_ASISTENCIAL en .env.");

const globalForPrisma = globalThis as unknown as {
  prismaAsistencialOperativa?: PrismaClient;
};
export const prismaAsistencial =
  globalForPrisma.prismaAsistencialOperativa ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3000 }),
  });
if (process.env.NODE_ENV !== "production")
  globalForPrisma.prismaAsistencialOperativa = prismaAsistencial;
