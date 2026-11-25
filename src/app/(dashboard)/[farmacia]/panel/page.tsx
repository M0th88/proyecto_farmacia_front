import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { dashboardSnapshot } from "@/lib/private/dashboard";
import { Dashboard } from "./_components/dashboard";
import PanelLoading from "./loading";
export const instant = false;
async function PanelContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await getPharmacyUser(pharmacy);
  if (!user) redirect(`/login/${pharmacy}`);
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("inicio")
  )
    redirect(`/${pharmacy}/sin-acceso`);
  const db = pharmacy === "asistencial" ? pharmacyDb(pharmacy) : undefined;
  return <Dashboard data={await dashboardSnapshot(db)} />;
}
export default function PanelPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PanelContent params={params} />
    </Suspense>
  );
}
