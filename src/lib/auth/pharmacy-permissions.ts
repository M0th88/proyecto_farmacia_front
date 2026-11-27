import "server-only";
import { redirect } from "next/navigation";
import {
  canAccessSection,
  type PharmacySection,
  rolePermissions,
} from "@/lib/private/permissions";
import type { Pharmacy } from "./pharmacies";
import { requirePharmacyUser } from "./session";

export async function requirePharmacySection(
  pharmacy: Pharmacy,
  section: PharmacySection,
) {
  const user = await requirePharmacyUser(pharmacy);
  if (!canAccessSection(rolePermissions(user.rol), section))
    redirect(`/${pharmacy}/sin-acceso`);
  return user;
}
