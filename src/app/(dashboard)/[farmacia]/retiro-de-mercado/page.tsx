import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { EmptyPrivateSection } from "../_components/empty-private-section";

export const instant = false;

export default function Page({ params }: PharmacyParams) {
  return (
    <EmptyPrivateSection
      params={params}
      title="Retiro de Mercado"
      description="Alertas sanitarias del ISP que obligan a retirar lotes específicos de la venta y de bodega."
      planned={[
        "Registrar la alerta del ISP: resolución, producto y lotes afectados.",
        "Bloquear automáticamente esos lotes en el POS y en la dispensación.",
        "Seguir las unidades retiradas hasta su devolución o destrucción, con acta.",
      ]}
      related={[
        { label: "Cuarentena Sanitaria", href: "/cuarentena-sanitaria" },
        { label: "Stocks y Lotes", href: "/stocks-y-lotes" },
        { label: "Inventario Histórico", href: "/inventario-historico" },
      ]}
    />
  );
}
