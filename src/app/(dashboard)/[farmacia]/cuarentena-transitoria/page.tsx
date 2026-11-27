import { InventarioCuarentenaPage } from "@/components/inventario-cuarentena-page";
import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";

export const instant = false;

export default function Page(props: PharmacyParams) {
  return (
    <InventarioCuarentenaPage
      {...props}
      vista="TRANSITORIA"
      titulo="Cuarentena transitoria"
    />
  );
}
