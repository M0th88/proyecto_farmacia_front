import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requirePharmacyUser } from "@/lib/auth/session";
import { RolesTable } from "./_components/roles-table";
import RolesLoading from "./loading";

export const instant = false;

async function RolesContent() {
  const user = await requirePharmacyUser("privada");
  if (user.rol.nombre !== "Administrador") redirect("/privada/sin-acceso");
  return <RolesTable currentUserId={user.id} />;
}

export default function RolesPage() {
  return (
    <Suspense fallback={<RolesLoading />}>
      <RolesContent />
    </Suspense>
  );
}
