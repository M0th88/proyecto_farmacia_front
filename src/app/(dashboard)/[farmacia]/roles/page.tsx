import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { RolesTable } from "./_components/roles-table";
import RolesLoading from "./loading";

export const instant = false;

async function RolesContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (user.rol.nombre !== "Administrador") redirect(`/${pharmacy}/sin-acceso`);
  return <RolesTable currentUserId={user.id} />;
}

export default function RolesPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<RolesLoading />}>
      <RolesContent params={params} />
    </Suspense>
  );
}
