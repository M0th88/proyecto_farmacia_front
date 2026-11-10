import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prismaPrivada } from "@/config/prismaPrivada";

export const PRIVATE_COOKIE = "farmacia_privada_session";

export function privateSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === "reemplazar_por_un_secreto_local") throw new Error("Configura JWT_SECRET con al menos 32 caracteres en .env.");
  return secret;
}

export async function currentPrivateUser() {
  const token = (await cookies()).get(PRIVATE_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, privateSecret(), { issuer: "farmacia-privada", audience: "farmacia-privada" });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const user = await prismaPrivada.usuario.findUnique({ where: { id }, include: { rol: true } });
    return user?.activo ? user : null;
  } catch { return null; }
}
