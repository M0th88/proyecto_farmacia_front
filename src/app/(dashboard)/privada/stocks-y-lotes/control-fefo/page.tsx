import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivateUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { FefoControl } from "../_components/fefo-control";
export const instant = false;
async function Content() {
  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (!canOperate(user, "inventario")) redirect("/privada/sin-acceso");
  return <FefoControl />;
}
export default function Page() {
  return (
    <Suspense fallback={<p>Cargando control FEFO…</p>}>
      <Content />
    </Suspense>
  );
}
