import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { EmptyPrivateSection } from "../_components/empty-private-section";

export const instant = false;

export default function Page({ params }: PharmacyParams) {
  return (
    <EmptyPrivateSection
      params={params}
      title="Marcas"
      description="Laboratorios y marcas comerciales para clasificar productos y comparar alternativas bioequivalentes."
      planned={[
        "Registrar laboratorios y marcas comerciales con su país y registro ISP.",
        "Asociar cada producto a su marca y mostrar alternativas del mismo principio activo.",
        "Filtrar el inventario, el POS y los reportes por marca.",
      ]}
      related={[
        { label: "Productos y Empaques", href: "/productos-y-empaques" },
        { label: "Stocks y Lotes", href: "/stocks-y-lotes" },
      ]}
    />
  );
}
