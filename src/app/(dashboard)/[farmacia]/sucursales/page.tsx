import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { ConfiguracionAlmacenPage } from "../_components/configuracion-almacen-page";

export const instant = false;

export default function Page(props: PharmacyParams) {
  return <ConfiguracionAlmacenPage {...props} vista="Sucursales" />;
}
