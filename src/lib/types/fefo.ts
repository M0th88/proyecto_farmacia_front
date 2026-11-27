import { z } from "zod";
import {
  documentoVentaSchema,
  montoPos,
} from "@/lib/validation/punto-de-venta";
import { recetaSchema, type TipoReceta } from "@/lib/validation/recetas";
export const lotStates = [
  "APTO",
  "PENDIENTE_REVISION",
  "CUARENTENA",
  "DETERIORADO",
  "RETIRADO_ALERTA",
] as const;
export const preparationSchema = z.object({
  sucursalId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        medicamentoId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(2147483647),
      }),
    )
    .min(1)
    .max(100),
});
export const saleSchema = preparationSchema.extend({
  claveOperacion: z.uuid(),
  totalEsperado: montoPos,
  descuento: montoPos.default(0),
  documento: documentoVentaSchema.optional(),
  tipoOperacion: z.enum(["VENTA", "DISPENSACION"]).default("VENTA"),
  metodoPago: z.enum(["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"]),
  recibido: montoPos.optional(),
  confirmacionFisica: z.literal(
    true,
    "Confirma los lotes físicos y sus cantidades.",
  ),
  motivoExcepcion: z.string().trim().max(500).default(""),
  receta: recetaSchema.optional(),
  clienteRut: z.string().trim().min(3).max(20).optional(),
  lotes: z
    .array(
      z.object({
        medicamentoId: z.number().int().positive(),
        stockId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(2147483647),
      }),
    )
    .min(1)
    .max(500),
});
export type PreparedLot = {
  stockId: number;
  loteId: number;
  medicamentoId: number;
  producto: string;
  numeroLote: string;
  rotulo: string;
  vencimiento: string;
  recepcion: string;
  ubicacion: string;
  disponible: number;
  cantidad: number;
};
export type FefoPlan = {
  sugeridos: PreparedLot[];
  aptos: PreparedLot[];
  faltantes: { medicamentoId: number; nombre: string; cantidad: number }[];
  total: number;
  permiteExcepcion: boolean;
  /** Receta más exigente que pide el pedido; null si es de venta directa. */
  recetaRequerida: TipoReceta | null;
};
export const receiptSchema = z.object({
  medicamentoId: z.number().int().positive(),
  ubicacionId: z.number().int().positive(),
  cantidad: z.number().int().positive().max(2147483647),
  numeroLote: z.string().trim().max(100).default(""),
  rotuloVencimiento: z.string().trim().max(100).default(""),
  precisionVencimiento: z.enum(["DIA", "MES_ANIO", "NO_VERIFICADO"]),
  fechaFabricacion: z.iso.date(
    "Debe ingresar una fecha de fabricación válida.",
  ),
  fechaRecepcion: z.iso.datetime(),
  verificado: z.boolean(),
  motivo: z.string().trim().min(1).max(500),
});
export const operationalPermissions = [
  { key: "fefo_excepcion", label: "Autorizar excepción FEFO" },
  { key: "inventario_liberar", label: "Conciliar y liberar inventario" },
  { key: "inventario_configurar", label: "Configurar sucursales y alertas" },
  { key: "ventas_anular", label: "Anular ventas" },
  { key: "devoluciones", label: "Registrar devoluciones" },
  {
    key: "controlados_firmar",
    label: "Firmar y ajustar el libro de controlados (Químico Farmacéutico)",
  },
] as const;
