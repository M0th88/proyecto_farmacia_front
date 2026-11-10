export const PRIVATE_SECTIONS = [
  { key: "inicio", label: "Panel", href: "/privada" },
  { key: "pos", label: "Punto de venta", href: "/privada/pos" },
  { key: "catalogo", label: "Productos", href: "/privada/catalogo" },
  { key: "inventario", label: "Stock y lotes", href: "/privada/inventario" },
  { key: "proveedores", label: "Proveedores", href: "/privada/proveedores" },
  { key: "compras", label: "Compras", href: "/privada/compras" },
  { key: "caja", label: "Caja", href: "/privada/caja" },
  { key: "ventas", label: "Historial", href: "/privada/ventas" },
  { key: "indicadores", label: "Reportes", href: "/privada/indicadores" },
  { key: "usuarios", label: "Usuarios y roles", href: "/privada/usuarios" },
] as const;
export type PrivatePermission = typeof PRIVATE_SECTIONS[number]["key"];
export const ALL_PRIVATE_PERMISSIONS = PRIVATE_SECTIONS.map(s => s.key);
export function hasPrivatePermission(permisos: string[], permiso: PrivatePermission) {
  return permisos.includes(permiso);
}
