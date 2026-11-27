import { operationalPermissions } from "@/lib/types/fefo";
export const PRIVATE_SECTIONS = [
  { key: "inicio", label: "Panel", href: "/privada/panel" },
  { key: "pos", label: "POS", href: "/privada/punto-de-venta" },
  {
    key: "catalogo",
    label: "Productos y Empaques",
    href: "/privada/productos-y-empaques",
  },
  {
    key: "inventario",
    label: "Stocks y Lotes",
    href: "/privada/stocks-y-lotes",
  },
  { key: "proveedores", label: "Proveedores", href: "/privada/proveedores" },
  { key: "compras", label: "Compras", href: "/privada/compras" },
  { key: "caja", label: "Caja del Día", href: "/privada/caja-del-dia" },
  { key: "recetas", label: "Recetas", href: "/privada/recetas" },
  { key: "convenios", label: "Convenios", href: "/privada/convenios" },
  {
    key: "controlados",
    label: "Libro de Controlados",
    href: "/privada/libro-controlados",
  },
  { key: "ventas", label: "Historial", href: "/privada/historial-y-reportes" },
  {
    key: "indicadores",
    label: "Reportes",
    href: "/privada/historial-y-reportes",
  },
  {
    key: "usuarios",
    label: "Usuarios",
    href: "/privada/usuarios",
  },
  { key: "roles", label: "Roles", href: "/privada/roles" },
] as const;
export type PrivatePermission = (typeof PRIVATE_SECTIONS)[number]["key"];
export const ALL_PRIVATE_PERMISSIONS = [
  ...PRIVATE_SECTIONS.map((s) => s.key),
  ...operationalPermissions.map((p) => p.key),
];
export function hasPrivatePermission(
  permisos: string[],
  permiso: PrivatePermission,
) {
  return permisos.includes(permiso);
}
