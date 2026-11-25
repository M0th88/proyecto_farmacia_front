import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPrivateUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { FefoControl } from "../_components/fefo-control";
export const instant = false;
async function Content({ params }: PharmacyParams) {
  if ((await resolvePharmacy(params)) !== "privada") notFound();
  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (!canOperate(user, "inventario")) redirect("/privada/sin-acceso");
  return <FefoControl />;
}
export default function Page({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<p>Cargando control FEFO…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
