export const PRIVATE_SECTIONS = [
  { key: "inicio", label: "Panel", href: "/panel" },
  { key: "pos", label: "POS", href: "/punto-de-venta" },
  {
    key: "catalogo",
    label: "Productos y Empaques",
    href: "/productos-y-empaques",
  },
  {
    key: "inventario",
    label: "Stocks y Lotes",
    href: "/stocks-y-lotes",
  },
  { key: "proveedores", label: "Proveedores", href: "/proveedores" },
  { key: "compras", label: "Compras", href: "/compras" },
  { key: "caja", label: "Caja del Día", href: "/caja-del-dia" },
  { key: "ventas", label: "Historial", href: "/historial-y-reportes" },
  {
    key: "indicadores",
    label: "Reportes",
    href: "/historial-y-reportes",
  },
  {
    key: "usuarios",
    label: "Usuarios",
    href: "/usuarios",
  },
  { key: "roles", label: "Roles", href: "/roles" },
] as const;
export type PrivatePermission = (typeof PRIVATE_SECTIONS)[number]["key"];
export const ALL_PRIVATE_PERMISSIONS = PRIVATE_SECTIONS.map((s) => s.key);
type Role = { nombre: string; permisos: string[] };

export function roleHasPermission(role: Role, permiso: PrivatePermission) {
  return (
    role.nombre === "Administrador" ||
    (permiso !== "usuarios" &&
      permiso !== "roles" &&
      role.permisos.includes(permiso))
  );
}

export function rolePermissions(role: Role) {
  return ALL_PRIVATE_PERMISSIONS.filter((permission) =>
    roleHasPermission(role, permission),
  );
}

const sectionPermissions = {
  "/panel": ["inicio"],
  "/punto-de-venta": ["pos"],
  "/productos-y-empaques": ["catalogo"],
  "/marcas": ["catalogo"],
  "/stocks-y-lotes": ["inventario"],
  "/otros-productos": ["inventario"],
  "/ubicaciones": ["inventario"],
  "/cuarentena-sanitaria": ["inventario"],
  "/cuarentena-transitoria": ["inventario"],
  "/segregar-productos": ["inventario"],
  "/productos-vencidos": ["inventario"],
  "/retiro-de-mercado": ["inventario"],
  "/productos-rechazados": ["inventario"],
  "/devoluciones-a-proveedor": ["inventario"],
  "/proveedores": ["proveedores"],
  "/compras": ["compras"],
  "/caja-del-dia": ["caja"],
  "/historial-y-reportes": ["ventas", "indicadores"],
  "/auditoria-fefo": ["indicadores"],
  "/inventario-historico": ["indicadores"],
  "/usuarios": ["usuarios"],
  "/roles": ["roles"],
} satisfies Record<string, PrivatePermission[]>;

export type PharmacySection = keyof typeof sectionPermissions;

export function canAccessSection(
  permissions: readonly PrivatePermission[],
  section: PharmacySection,
) {
  return sectionPermissions[section].some((permission) =>
    permissions.includes(permission),
  );
}
