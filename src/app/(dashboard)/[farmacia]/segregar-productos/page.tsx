import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { SegregarProductosTable } from "./_components/segregar-productos-table";
import Loading from "./loading";

export const instant = false;

async function Contenido({ params }: PharmacyParams) {
  const farmacia = await resolvePharmacy(params);
  const user = await getPharmacyUser(farmacia);
  if (!user) redirect(`/login/${farmacia}`);
  if (!canOperate(user, "inventario")) redirect(`/${farmacia}/sin-acceso`);
  return <SegregarProductosTable />;
}

export default function Page(props: PharmacyParams) {
  return (
    <Suspense fallback={<Loading />}>
      <Contenido {...props} />
    </Suspense>
  );
}
