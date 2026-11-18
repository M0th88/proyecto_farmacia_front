import { z } from "zod";

export const stockEntrySchema = z
  .object({
    medicamentoId: z.number().int().positive("Selecciona un producto."),
    numeroLote: z.string().trim().min(1, "Ingresa el número de lote.").max(100),
    fechaFabricacion: z.iso.date(
      "Debe ingresar una fecha de fabricación válida.",
    ),
    fechaVencimiento: z.iso.date("Ingresa una fecha de vencimiento válida."),
    ubicacionId: z.number().int().min(0),
    ubicacionNombre: z.string().trim().max(100),
    ubicacionTipo: z.enum(["BODEGA", "VITRINA"]),
    cantidad: z
      .number()
      .int("Ingresa una cantidad entera.")
      .positive("La cantidad debe ser mayor que cero.")
      .max(2147483647),
    motivo: z.string().trim().max(500),
  })
  .superRefine((value, context) => {
    if (value.ubicacionId === 0 && !value.ubicacionNombre)
      context.addIssue({
        code: "custom",
        path: ["ubicacionNombre"],
        message: "Ingresa el nombre de la ubicación.",
      });
    if (
      value.fechaFabricacion &&
      value.fechaFabricacion > value.fechaVencimiento
    )
      context.addIssue({
        code: "custom",
        path: ["fechaFabricacion"],
        message: "La fabricación debe ser anterior o igual al vencimiento.",
      });
  });
export type StockEntry = z.infer<typeof stockEntrySchema>;
export type StockRow = {
  id: string;
  loteId: number | null;
  stockId: number | null;
  medicamentoId: number;
  nombre: string;
  codigo: string | null;
  condicion: string;
  minimo: number;
  precio: number | null;
  numeroLote: string | null;
  fechaFabricacion: string | null;
  fechaVencimiento: string | null;
  ubicacion: string | null;
  cantidad: number;
  diasParaVencer: number | null;
  estado:
    | "Sin lotes"
    | "Vencido"
    | "Vence hoy"
    | "Vence en 1 día"
    | `Vence en ${number} días`;
};
export const stockTargetSchema = z.object({
  loteId: z.number().int().positive(),
  stockId: z.number().int().positive().nullable(),
  cantidadAnterior: z.number().int().min(0).max(2147483647),
});
export const stockEditSchema = stockTargetSchema
  .extend({
    numeroLote: z.string().trim().min(1, "Ingresa el número de lote.").max(100),
    fechaFabricacion: z.iso.date(
      "Debe ingresar una fecha de fabricación válida.",
    ),
    fechaVencimiento: z.iso.date("Ingresa una fecha de vencimiento válida."),
    cantidad: z
      .number()
      .int()
      .min(0, "La cantidad no puede ser negativa.")
      .max(2147483647),
    motivo: z.string().trim().min(1, "Ingresa el motivo del cambio.").max(500),
  })
  .superRefine((value, context) => {
    if (value.fechaFabricacion > value.fechaVencimiento)
      context.addIssue({
        code: "custom",
        path: ["fechaFabricacion"],
        message: "La fabricación debe ser anterior o igual al vencimiento.",
      });
    if (value.stockId === null && value.cantidad !== 0)
      context.addIssue({
        code: "custom",
        path: ["cantidad"],
        message: "Usa Añadir stock para asignar unidades a una ubicación.",
      });
  });
export type StockEdit = z.infer<typeof stockEditSchema>;
export type StockMetrics = {
  productos: number;
  bajo: number;
  proximos: number;
  vencidos: number;
};
export type StockOptions = {
  productos: {
    id: number;
    nombre: string;
    codigoBarra: string | null;
    lotes: {
      numeroLote: string;
      fechaFabricacion: string;
      fechaVencimiento: string;
    }[];
  }[];
  ubicaciones: { id: number; nombre: string; tipo: "BODEGA" | "VITRINA" }[];
};
