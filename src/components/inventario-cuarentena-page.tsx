import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import type { VistaInventario } from "@/lib/types/cuarentena";
import { InventarioCuarentena } from "./inventario-cuarentena";
import { SectionLoading } from "./section-loading";

async function Contenido({
  params,
  vista,
}: PharmacyParams & { vista: Exclude<VistaInventario, "SEGREGAR"> }) {
  const farmacia = await resolvePharmacy(params);
  const user = await getPharmacyUser(farmacia);
  if (!user) redirect(`/login/${farmacia}`);
  if (!canOperate(user, "inventario")) redirect(`/${farmacia}/sin-acceso`);
  return <InventarioCuarentena vista={vista} />;
}

export function InventarioCuarentenaPage(
  props: PharmacyParams & {
    vista: Exclude<VistaInventario, "SEGREGAR">;
    titulo: string;
  },
) {
  return (
    <Suspense fallback={<SectionLoading title={props.titulo} />}>
      <Contenido {...props} />
    </Suspense>
  );
}
