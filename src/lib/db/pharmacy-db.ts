import "server-only";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import { prismaAsistencial } from "./prisma-asistencial";
import { prismaPrivada } from "./prisma-privada";

// Shared modules use the common schema. Private FEFO modules use prismaPrivada directly.
export type PharmacyDb = typeof prismaAsistencial;

export function pharmacyDb(pharmacy: Pharmacy): PharmacyDb {
  return pharmacy === "asistencial"
    ? prismaAsistencial
    : (prismaPrivada as unknown as PharmacyDb);
}
