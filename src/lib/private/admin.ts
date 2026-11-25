import type { Pharmacy } from "@/lib/auth/pharmacies";
import { getPharmacyUser } from "@/lib/auth/session";

export async function pharmacyAdmin(pharmacy: Pharmacy) {
  const user = await getPharmacyUser(pharmacy);
  return user?.rol.nombre === "Administrador" ? user : null;
}
export const noAdmin = () =>
  Response.json(
    { error: "Acceso exclusivo del administrador." },
    { status: 403 },
  );
