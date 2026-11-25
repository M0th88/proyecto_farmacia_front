import "server-only";
import bcrypt from "bcrypt";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { canAccessPharmacy, normalizeRut, rutAliases } from "./identity";
import type { Pharmacy } from "./pharmacies";

// Iguala correo sin distinguir mayúsculas y RUT con o sin puntos y guion.
export function normalizeIdentifier(identifier: string) {
  return identifier.includes("@")
    ? identifier.trim().toLowerCase()
    : normalizeRut(identifier);
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
  const where = normalized.includes("@")
    ? { email: { equals: normalized, mode: "insensitive" as const } }
    : {
        OR: rutAliases(normalized).map((value) => ({
          rut: { equals: value, mode: "insensitive" as const },
        })),
      };
  const user = await pharmacyDb(pharmacy).usuario.findFirst({
    where,
    select: {
      id: true,
      activo: true,
      password: true,
      email: true,
      rut: true,
      rol: { select: { nombre: true } },
    },
  });
  const valid = await bcrypt.compare(password, user?.password ?? dummyHash);
  if (!user?.activo || !valid || !(await canAccessPharmacy(pharmacy, user))) {
    attempts.set(key, {
      failures: (previous?.failures ?? 0) + 1,
      expires: previous?.expires ?? now + windowMs,
    });
    return { error: "Correo o RUT y contraseña incorrectos." } as const;
  }
  attempts.delete(key);
  return { userId: user.id } as const;
}
