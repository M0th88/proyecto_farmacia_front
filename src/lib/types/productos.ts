import { z } from "zod";

export const productTextFields = [
  { name: "nombre", label: "Nombre del producto", max: 200 },
  { name: "codigoBarra", label: "Código de barras", max: 100 },
  { name: "codigoCatalogo", label: "Código de catálogo", max: 100 },
  { name: "codigoAtc", label: "Código ATC", max: 50 },
  { name: "principioActivo", label: "Principio activo", max: 300 },
  { name: "concentracion", label: "Concentración", max: 200 },
  { name: "formaFarmaceutica", label: "Forma farmacéutica", max: 200 },
  { name: "fuenteCatalogo", label: "Fuente del catálogo", max: 500 },
] as const;
export const saleConditions = [
  { value: "SIN_CLASIFICAR", label: "Sin clasificar" },
  { value: "VENTA_DIRECTA", label: "Venta directa" },
  { value: "RECETA_SIMPLE", label: "Receta simple" },
  { value: "RECETA_RETENIDA", label: "Receta retenida" },
  { value: "RECETA_CHEQUE", label: "Receta cheque" },
] as const;
export const chileFields = [
  { name: "grupoGeneral", label: "Grupo general" },
  { name: "subgrupoFarmacologico", label: "Subgrupo farmacológico" },
  { name: "mecanismoResumido", label: "Mecanismo resumido" },
  { name: "atcArchivo", label: "ATC del archivo" },
  { name: "productoIspEjemplo", label: "Producto registrado en ISP" },
  { name: "nombreFantasia", label: "Nombre de fantasía" },
  { name: "laboratorioTitular", label: "Laboratorio titular" },
  { name: "registroIsp", label: "Registro ISP" },
  { name: "estadoIsp", label: "Estado ISP" },
  { name: "fuenteIsp", label: "Fuente ISP" },
  { name: "observaciones", label: "Observaciones" },
  { name: "condicionVentaIsp", label: "Condición de venta ISP" },
  { name: "concentracionEjemplo", label: "Concentración de referencia" },
  {
    name: "formaFarmaceuticaEjemplo",
    label: "Forma farmacéutica de referencia",
  },
  { name: "viaAdministracion", label: "Vía de administración" },
  { name: "tipoAlmacenamiento", label: "Tipo de almacenamiento" },
  { name: "condicionAlmacenamiento", label: "Condición de almacenamiento" },
] as const;
type ChileField = (typeof chileFields)[number]["name"];
const fichaSchema = z.object(
  Object.fromEntries(
    chileFields.map((field) => [field.name, z.string().trim().max(2000)]),
  ) as Record<ChileField, z.ZodString>,
);
export const emptyChileFields = Object.fromEntries(
  chileFields.map((field) => [field.name, ""]),
) as Record<ChileField, string>;

export const productProfileSchema = z
  .object({
    nombre: z.string().trim().min(2, "Debe ingresar un nombre").max(200),
    codigoBarra: z.string().trim().max(100),
    codigoCatalogo: z.string().trim().max(100),
    codigoAtc: z.string().trim().max(50),
    fuenteCatalogo: z.string().trim().max(500),
    principioActivo: z.string().trim().max(300),
    concentracion: z.string().trim().max(200),
    formaFarmaceutica: z.string().trim().max(200),
    precioVenta: z
      .string()
      .trim()
      .regex(
        /^(?:\d{1,10}(?:[.,]\d{1,2})?)?$/,
        "Ingresa un precio válido con máximo dos decimales.",
      ),
    condicionVenta: z.enum(saleConditions.map((condition) => condition.value)),
    stockMinimo: z
      .number()
      .int("Ingresa un número entero.")
      .min(0)
      .max(2147483647),
    activo: z.boolean(),
    categoriaId: z.number().int().min(-1),
    categoriaNombre: z.string().trim().max(100),
    categoriaDescripcion: z.string().trim().max(500),
    fichaChile: fichaSchema,
  })
  .superRefine((value, context) => {
    if (value.categoriaId === -1 && !value.categoriaNombre)
      context.addIssue({
        code: "custom",
        path: ["categoriaNombre"],
        message: "Ingresa el nombre de la categoría.",
      });
  });
export type ProductProfile = z.infer<typeof productProfileSchema>;
export type ProductDetail = {
  id: number;
  profile: ProductProfile;
  creadoEn: string;
  actualizadoEn: string;
};
export type ProductRow = {
  id: number;
  nombre: string;
  codigoBarra: string | null;
  codigoCatalogo: string | null;
  codigoAtc: string | null;
  fuenteCatalogo: string | null;
  principioActivo: string | null;
  concentracion: string | null;
  formaFarmaceutica: string | null;
  categoria: string;
  precioVenta: number | null;
  condicionVenta: string;
  stockMinimo: number;
  stock: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
};
export type ProductMetrics = {
  productos: number;
  sinPrecio: number;
  sinCodigo: number;
  sinClasificar: number;
};
export type ProductOptions = { categorias: { id: number; nombre: string }[] };
