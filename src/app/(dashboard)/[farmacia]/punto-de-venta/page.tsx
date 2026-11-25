import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { PuntoDeVenta } from "./_components/punto-de-venta";
import { PuntoDeVentaPrivada } from "./_components/punto-de-venta-privada";

export default async function PuntoDeVentaPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  return pharmacy === "privada" ? <PuntoDeVentaPrivada /> : <PuntoDeVenta />;
}
