import "server-only";
import type { Prisma } from "@/generated/privada/client";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import type { Pharmacy } from "./pharmacies";

type Identity = { email?: string; rut?: string };
export const normalizeRut = (rut: string) =>
  rut.replace(/[.\s-]/g, "").toUpperCase();
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function rutAliases(rut: string) {
  const digits = normalizeRut(rut);
  const body = digits.slice(0, -1);
  const check = digits.slice(-1);
  return [
    digits,
    `${body}-${check}`,
    `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${check}`,
  ];
}

function configuredIdentity() {
  const email = normalizeEmail(process.env.SUPERADMIN_EMAIL ?? "");
  const rut = normalizeRut(process.env.SUPERADMIN_RUT ?? "");
  return email && rut ? { email, rut } : null;
}

export function isReservedIdentity(identity: Identity) {
  const config = configuredIdentity();
  return (
    !!config &&
    ((identity.email !== undefined &&
      normalizeEmail(identity.email) === config.email) ||
      (identity.rut !== undefined && normalizeRut(identity.rut) === config.rut))
  );
}

export function isSuperAdmin(user: Identity & { rol: { nombre: string } }) {
  const config = configuredIdentity();
  return (
    !!config &&
    user.rol.nombre === "Administrador" &&
    user.email !== undefined &&
    normalizeEmail(user.email) === config.email &&
    user.rut !== undefined &&
    normalizeRut(user.rut) === config.rut
  );
}

export async function identityExistsInOtherPharmacy(
  pharmacy: Pharmacy,
  identity: Identity,
) {
  const filters: Prisma.UsuarioWhereInput[] = [];
  if (identity.email)
    filters.push({
      email: { equals: normalizeEmail(identity.email), mode: "insensitive" },
    });
  if (identity.rut)
    filters.push(
      ...rutAliases(identity.rut).map(
        (rut): Prisma.UsuarioWhereInput => ({
          rut: { equals: rut, mode: "insensitive" },
        }),
      ),
    );
  if (!filters.length) return false;
  const other = pharmacy === "privada" ? "asistencial" : "privada";
  return !!(await pharmacyDb(other).usuario.findFirst({
    where: { OR: filters },
    select: { id: true },
  }));
}

export async function canAccessPharmacy(
  pharmacy: Pharmacy,
  user: Identity & { rol: { nombre: string } },
) {
  // For pre-existing duplicates, the private account keeps its own access.
  return (
    pharmacy === "privada" ||
    isSuperAdmin(user) ||
    !(await identityExistsInOtherPharmacy(pharmacy, user))
  );
}

// Ignore formatting-only changes to an existing identifier.
export function changedIdentity(current: Identity, update: Identity): Identity {
  return {
    email:
      update.email !== undefined &&
      normalizeEmail(update.email) !== normalizeEmail(current.email ?? "")
        ? update.email
        : undefined,
    rut:
      update.rut !== undefined &&
      normalizeRut(update.rut) !== normalizeRut(current.rut ?? "")
        ? update.rut
        : undefined,
  };
}
