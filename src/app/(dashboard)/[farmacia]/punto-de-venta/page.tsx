import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { rolePermissions } from "@/lib/private/permissions";
import { PuntoDeVenta } from "./_components/punto-de-venta";

export const instant = false;

export default async function PuntoDeVentaPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacySection(pharmacy, "/punto-de-venta");
  return <PuntoDeVenta permissions={rolePermissions(user.rol)} />;
}
