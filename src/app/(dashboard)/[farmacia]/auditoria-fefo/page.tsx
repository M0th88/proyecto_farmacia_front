import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPrivateUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { EmptyPrivateSection } from "../_components/empty-private-section";
import { AuditoriaFefo } from "./_components/auditoria-fefo";
import { AuditoriaFefoLoading } from "./_components/auditoria-fefo-loading";

export const instant = false;

async function Content({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  if (pharmacy === "asistencial")
    return <EmptyPrivateSection title="Auditoría FEFO" />;

  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (!canOperate(user, "inventario")) redirect("/privada/sin-acceso");
  return <AuditoriaFefo />;
}

export default function Page({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<AuditoriaFefoLoading />}>
      <Content params={params} />
    </Suspense>
  );
}
