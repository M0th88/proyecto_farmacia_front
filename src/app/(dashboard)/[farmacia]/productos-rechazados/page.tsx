import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { EmptyPrivateSection } from "../_components/empty-private-section";

export const instant = false;

export default function Page({ params }: PharmacyParams) {
  return (
    <EmptyPrivateSection
      params={params}
      title="Productos Rechazados"
      description="Productos que no se aceptan en la recepción por daño, cadena de frío rota o documentación incompleta."
      planned={[
        "Registrar el rechazo al recibir: producto, lote, cantidad y motivo.",
        "Generar el acta de rechazo con evidencia para el proveedor.",
        "Enlazar cada rechazo con su devolución y su nota de crédito.",
      ]}
      related={[
        { label: "Compras", href: "/compras" },
        { label: "Cuarentena Transitoria", href: "/cuarentena-transitoria" },
        { label: "Proveedores", href: "/proveedores" },
      ]}
    />
  );
}
