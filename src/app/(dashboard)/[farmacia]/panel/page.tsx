import { Suspense } from "react";
import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { dashboardSnapshot } from "@/lib/private/dashboard";
import { roleHasPermission } from "@/lib/private/permissions";
import { Dashboard } from "./_components/dashboard";
import PanelLoading from "./loading";
export const instant = false;
async function PanelContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacySection(pharmacy, "/panel");
  const access = {
    sales: roleHasPermission(user.rol, "ventas"),
    inventory: roleHasPermission(user.rol, "inventario"),
  };
  return (
    <Dashboard
      data={await dashboardSnapshot(pharmacyDb(pharmacy), access)}
      access={access}
      canOpenCatalog={roleHasPermission(user.rol, "catalogo")}
    />
  );
}
export default function PanelPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PanelContent params={params} />
    </Suspense>
  );
}
