import { PRIVATE_SECTIONS } from "@/lib/private/permissions";
import { operationalPermissions } from "@/lib/types/fefo";

/**
 * Permisos asignables a un rol, agrupados por área y explicados para quien
 * configura roles. Las claves son las mismas que se guardan en Rol.permisos;
 * "usuarios" y "roles" quedan fuera porque son exclusivos del Administrador.
 */
export type PermisoInfo = {
  key: string;
  label: string;
  descripcion: string;
  /** Acción delicada (libera stock, anula, firma): se destaca en la interfaz. */
  sensible?: boolean;
};
export type GrupoPermisos = {
  id: string;
  titulo: string;
  permisos: PermisoInfo[];
};

const DESCRIPCION: Record<string, string> = {
  inicio: "Ver el panel con ventas, inventario y alertas.",
  indicadores: "Consultar reportes y exportarlos a PDF o Excel.",
  ventas: "Revisar el historial de ventas y sus documentos.",
  pos: "Vender en el punto de venta y aplicar convenios.",
  caja: "Abrir y cerrar turnos de caja y registrar movimientos.",
  recetas: "Ver las recetas recibidas en el POS.",
  convenios: "Crear convenios de descuento y afiliar clientes.",
  ventas_anular: "Anular ventas confirmadas.",
  devoluciones: "Registrar devoluciones de clientes.",
  catalogo: "Crear y editar productos, marcas y etiquetas.",
  inventario: "Ver y ajustar stock, lotes, cuarentenas y retiros.",
  proveedores: "Administrar el directorio de proveedores.",
  compras: "Emitir órdenes, recibir mercadería y gestionar devoluciones.",
  inventario_liberar: "Liberar unidades de cuarentena y conciliar inventario.",
  inventario_configurar: "Configurar sucursales, ubicaciones y alertas.",
  fefo_excepcion: "Vender un lote fuera del orden FEFO con motivo.",
  controlados: "Consultar el libro de estupefacientes y psicotrópicos.",
  controlados_firmar: "Firmar el libro y registrar entradas o ajustes.",
};

const SENSIBLES = new Set([
  "ventas_anular",
  "inventario_liberar",
  "fefo_excepcion",
  "controlados_firmar",
]);

const ESTRUCTURA: { id: string; titulo: string; claves: string[] }[] = [
  {
    id: "general",
    titulo: "General",
    claves: ["inicio", "indicadores", "ventas"],
  },
  {
    id: "venta",
    titulo: "Venta y caja",
    claves: [
      "pos",
      "caja",
      "recetas",
      "convenios",
      "ventas_anular",
      "devoluciones",
    ],
  },
  {
    id: "inventario",
    titulo: "Inventario y abastecimiento",
    claves: [
      "catalogo",
      "inventario",
      "proveedores",
      "compras",
      "inventario_liberar",
      "inventario_configurar",
      "fefo_excepcion",
    ],
  },
  {
    id: "controlados",
    titulo: "Medicamentos controlados",
    claves: ["controlados", "controlados_firmar"],
  },
];

const ETIQUETAS = new Map<string, string>([
  ...PRIVATE_SECTIONS.map((s) => [s.key, s.label] as [string, string]),
  ...operationalPermissions.map((p) => [p.key, p.label] as [string, string]),
]);
const EXCLUSIVOS_ADMIN = new Set(["usuarios", "roles"]);

const info = (key: string): PermisoInfo => ({
  key,
  label: ETIQUETAS.get(key) ?? key,
  descripcion: DESCRIPCION[key] ?? "",
  sensible: SENSIBLES.has(key),
});

/** Grupos para el formulario; cualquier permiso nuevo no clasificado cae en "Otros". */
export const GRUPOS_PERMISOS: GrupoPermisos[] = (() => {
  const clasificadas = new Set(ESTRUCTURA.flatMap((g) => g.claves));
  const otros = [...ETIQUETAS.keys()].filter(
    (k) => !clasificadas.has(k) && !EXCLUSIVOS_ADMIN.has(k),
  );
  return [
    ...ESTRUCTURA.map((g) => ({
      id: g.id,
      titulo: g.titulo,
      permisos: g.claves.filter((k) => ETIQUETAS.has(k)).map(info),
    })),
    ...(otros.length
      ? [{ id: "otros", titulo: "Otros", permisos: otros.map(info) }]
      : []),
  ];
})();

/** Plantillas para partir rápido al crear un rol (se pueden ajustar después). */
export const PLANTILLAS_ROL: { nombre: string; permisos: string[] }[] = [
  {
    nombre: "Vendedor",
    permisos: ["inicio", "pos", "recetas", "catalogo", "inventario"],
  },
  {
    nombre: "Cajero",
    permisos: ["inicio", "pos", "caja", "ventas", "recetas"],
  },
  {
    nombre: "Químico Farmacéutico",
    permisos: [
      "inicio",
      "pos",
      "caja",
      "ventas",
      "indicadores",
      "recetas",
      "convenios",
      "catalogo",
      "inventario",
      "proveedores",
      "compras",
      "inventario_liberar",
      "fefo_excepcion",
      "controlados",
      "controlados_firmar",
    ],
  },
  {
    nombre: "Bodega",
    permisos: ["inicio", "catalogo", "inventario", "proveedores", "compras"],
  },
];

/** Resumen por grupo de los permisos de un rol, para la tabla. */
export function resumenPermisos(permisos: string[]) {
  return GRUPOS_PERMISOS.map((g) => ({
    titulo: g.titulo,
    total: g.permisos.length,
    activos: g.permisos.filter((p) => permisos.includes(p.key)),
  })).filter((g) => g.activos.length > 0);
}
