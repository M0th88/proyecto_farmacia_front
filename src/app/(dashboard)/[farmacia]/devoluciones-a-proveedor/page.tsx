import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { EmptyPrivateSection } from "../_components/empty-private-section";

export const instant = false;

export default function Page({ params }: PharmacyParams) {
  return (
    <EmptyPrivateSection
      params={params}
      title="Devoluciones a Proveedor"
      description="Salida de productos vencidos, rechazados o retirados del mercado hacia su proveedor."
      planned={[
        "Emitir la guía de devolución con los lotes y cantidades que salen.",
        "Descontar el stock con un movimiento trazable en el inventario histórico.",
        "Controlar la nota de crédito pendiente de cada proveedor.",
      ]}
      related={[
        { label: "Productos Vencidos", href: "/productos-vencidos" },
        { label: "Proveedores", href: "/proveedores" },
        { label: "Inventario Histórico", href: "/inventario-historico" },
      ]}
    />
  );
}
