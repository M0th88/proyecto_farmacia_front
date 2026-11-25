import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/privada/client";

const connectionString = process.env.DATABASE_URL_PRIVADA;
if (!connectionString) throw new Error("Falta DATABASE_URL_PRIVADA en .env.");

const globalForPrisma = globalThis as unknown as {
  prismaPrivadaFefoDocumentos?: PrismaClient;
};
export const prismaPrivada =
  globalForPrisma.prismaPrivadaFefoDocumentos ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3000 }),
  });
if (process.env.NODE_ENV !== "production")
  globalForPrisma.prismaPrivadaFefoDocumentos = prismaPrivada;
