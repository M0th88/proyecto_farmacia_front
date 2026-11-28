import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  ConfiguracionAlmacen,
  ConfiguracionAlmacenLoading,
  type VistaAlmacen,
} from "@/components/configuracion-almacen";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { EmptyPrivateSection } from "./empty-private-section";

type Props = PharmacyParams & { vista: VistaAlmacen };

async function Contenido({ params, vista }: Props) {
  const farmacia = await resolvePharmacy(params);
  const user = await getPharmacyUser(farmacia);
  if (!user) redirect(`/login/${farmacia}`);
  if (!canOperate(user, "inventario")) redirect(`/${farmacia}/sin-acceso`);
  if (farmacia === "asistencial")
    return <EmptyPrivateSection params={params} title={vista} />;
  return <ConfiguracionAlmacen vista={vista} />;
}

export function ConfiguracionAlmacenPage(props: Props) {
  return (
    <Suspense fallback={<ConfiguracionAlmacenLoading vista={props.vista} />}>
      <Contenido {...props} />
    </Suspense>
  );
}
