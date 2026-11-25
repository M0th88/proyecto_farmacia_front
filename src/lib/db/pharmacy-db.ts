import "server-only";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import { prismaAsistencial } from "./prisma-asistencial";
import { prismaPrivada } from "./prisma-privada";

export function pharmacyDb(pharmacy: Pharmacy) {
  return pharmacy === "asistencial" ? prismaAsistencial : prismaPrivada;
}
export type PharmacyDb = ReturnType<typeof pharmacyDb>;
