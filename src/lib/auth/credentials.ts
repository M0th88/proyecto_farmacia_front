import "server-only";
import bcrypt from "bcrypt";
import { prismaAsistencial } from "@/lib/db/prisma-asistencial";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import type { Pharmacy } from "./pharmacies";

// Iguala correo sin distinguir mayúsculas y RUT con o sin puntos y guion.
export function normalizeIdentifier(identifier: string) {
  return identifier.includes("@")
    ? identifier.trim().toLowerCase()
    : identifier.replace(/[.\s-]/g, "").toUpperCase();
}

const attempts = new Map<string, { failures: number; expires: number }>();
const windowMs = 15 * 60 * 1000;
const dummyHash = bcrypt.hashSync("invalid-account-placeholder", 12);

export async function checkCredentials(
  pharmacy: Pharmacy,
  identifier: string,
  password: string,
) {
  const normalized = normalizeIdentifier(identifier);
  const key = `${pharmacy}:${normalized}`;
  const now = Date.now();
  for (const [storedKey, attempt] of attempts)
    if (attempt.expires <= now) attempts.delete(storedKey);
  const previous = attempts.get(key);
  if (previous && previous.failures >= 5)
    return {
      error: "Demasiados intentos. Intenta nuevamente en 15 minutos.",
    } as const;
  if (attempts.size >= 10000 && !previous)
    return { error: "Intenta nuevamente más tarde." } as const;
  const digits = normalized.slice(0, -1);
  const rut = `${digits}-${normalized.slice(-1)}`;
  const formattedRut = `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${normalized.slice(-1)}`;
  const where = normalized.includes("@")
    ? { email: { equals: normalized, mode: "insensitive" as const } }
    : {
        OR: [normalized, rut, formattedRut].map((value) => ({
          rut: { equals: value, mode: "insensitive" as const },
        })),
      };
  const select = { id: true, activo: true, password: true } as const;
  const user =
    pharmacy === "privada"
      ? await prismaPrivada.usuario.findFirst({ where, select })
      : await prismaAsistencial.usuario.findFirst({ where, select });
  const valid = await bcrypt.compare(password, user?.password ?? dummyHash);
  if (!user?.activo || !valid) {
    attempts.set(key, {
      failures: (previous?.failures ?? 0) + 1,
      expires: previous?.expires ?? now + windowMs,
    });
    return { error: "Correo o RUT y contraseña incorrectos." } as const;
  }
  attempts.delete(key);
  return { userId: user.id } as const;
}
