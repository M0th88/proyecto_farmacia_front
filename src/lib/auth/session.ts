import "server-only";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { canAccessPharmacy } from "./identity";
import { type Pharmacy, pharmacies } from "./pharmacies";

export function sessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    secret === "reemplazar_por_un_secreto_local"
  ) {
    throw new Error("Configura JWT_SECRET con al menos 32 caracteres.");
  }
  return secret;
}

async function sessionUserId(pharmacy: Pharmacy) {
  await connection();
  const token = (await cookies()).get(pharmacies[pharmacy].cookie)?.value;
  if (!token) return null;
  try {
    const audience = pharmacies[pharmacy].audience;
    const payload = jwt.verify(token, sessionSecret(), {
      algorithms: ["HS256"],
      issuer: audience,
      audience,
    });
    if (
      typeof payload === "string" ||
      !payload.exp ||
      typeof payload.sub !== "string"
    )
      return null;
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

const userFields = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  rut: true,
  activo: true,
  rolId: true,
  rol: true,
} as const;

export const getPharmacyUser = cache(async (pharmacy: Pharmacy) => {
  const id = await sessionUserId(pharmacy);
  if (!id) return null;
  const user = await pharmacyDb(pharmacy).usuario.findUnique({
    where: { id },
    select: userFields,
  });
  return user?.activo && (await canAccessPharmacy(pharmacy, user))
    ? user
    : null;
});

export const getPrivateUser = () => getPharmacyUser("privada");
export const getAsistencialUser = () => getPharmacyUser("asistencial");

export async function requirePharmacyUser(pharmacy: Pharmacy) {
  const user = await getPharmacyUser(pharmacy);
  if (!user) redirect(`/login/${pharmacy}`);
  return user;
}

export function createSessionToken(
  pharmacy: Pharmacy,
  userId: number,
  remember: boolean,
) {
  const config = pharmacies[pharmacy];
  const lifetime = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
  return jwt.sign({}, sessionSecret(), {
    algorithm: "HS256",
    subject: String(userId),
    issuer: config.audience,
    audience: config.audience,
    expiresIn: lifetime,
  });
}
