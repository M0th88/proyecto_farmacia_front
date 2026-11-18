import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivateUser } from "@/lib/auth/session";
import { dashboardSnapshot } from "@/lib/private/dashboard";
import { Dashboard } from "./_components/dashboard";
import PanelLoading from "./loading";
export const instant = false;
async function PanelContent() {
  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("inicio")
  )
    redirect("/privada/sin-acceso");
  return <Dashboard data={await dashboardSnapshot()} />;
}
export default function PanelPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PanelContent />
    </Suspense>
  );
}
