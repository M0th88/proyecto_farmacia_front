import { redirect } from "next/navigation";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { PRIVATE_SECTIONS, roleHasPermission } from "@/lib/private/permissions";

export default async function FarmaciaPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  const firstSection = PRIVATE_SECTIONS.find(({ key }) =>
    roleHasPermission(user.rol, key),
  );
  const path = firstSection?.href ?? "/sin-acceso";
  redirect(`/${pharmacy}${path}`);
}
