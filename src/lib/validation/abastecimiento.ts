import { z } from "zod";
import { rutError } from "@/lib/validation/user-fields";

/** Reglas compartidas (cliente y servidor) de abastecimiento y caja. */

const texto = (campo: string, max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, `Ingresa ${campo}.`)
    .max(max, `${campo[0].toUpperCase()}${campo.slice(1)} es demasiado largo.`);
const opcional = (max: number) => z.string().trim().max(max).default("");
const rut = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const error = rutError(value);
    if (error) ctx.addIssue({ code: "custom", message: `RUT: ${error}` });
  })
  .transform((v) => v.toUpperCase());
const id = (mensaje = "Selecciona una opción.") =>
  z.number(mensaje).int().positive(mensaje);
const entero = z
  .number("Ingresa una cantidad.")
  .int("Las cantidades deben ser enteras.")
  .min(0, "Las cantidades no pueden ser negativas.")
  .max(1_000_000);
const pesos = z
  .number("Ingresa un monto.")
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999)
  .multipleOf(0.01, "Usa como máximo dos decimales.");

// Marcas y proveedores

export const marcaSchema = z.object({
  nombre: texto("el nombre", 80, 2),
  laboratorio: opcional(120),
  pais: opcional(60),
  activo: z.boolean().default(true),
});

export const asignarMarcaSchema = z.object({
  medicamentoId: id("Selecciona el producto."),
  marcaId: z.number().int().positive().nullable(),
});

export const proveedorSchema = z.object({
  rut,
  razonSocial: texto("la razón social", 120, 3),
  nombreFantasia: opcional(120),
  contacto: opcional(120),
  telefono: opcional(30),
  email: z
    .union([z.email("Ingresa un correo válido."), z.literal("")])
    .default(""),
  direccion: opcional(160),
  activo: z.boolean().default(true),
});

// Compras

export const ESTADOS_ORDEN = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA: "Recibida",
  ANULADA: "Anulada",
} as const;
export type EstadoOrden = keyof typeof ESTADOS_ORDEN;

export const ordenCompraSchema = z.object({
  proveedorId: id("Selecciona el proveedor."),
  fechaEsperada: z.union([z.iso.date(), z.literal("")]).default(""),
  observaciones: opcional(300),
  items: z
    .array(
      z.object({
        medicamentoId: id("Selecciona el producto."),
        cantidad: entero.min(1, "Cada línea necesita al menos 1 unidad."),
        costoUnitario: pesos,
      }),
    )
    .min(1, "Agrega al menos un producto.")
    .max(60)
    .refine(
      (items) =>
        new Set(items.map((i) => i.medicamentoId)).size === items.length,
      "Hay productos repetidos en la orden.",
    ),
});

export const MOTIVOS_RECHAZO = {
  DANO: "Envase dañado",
  TEMPERATURA: "Cadena de frío rota",
  DOCUMENTACION: "Documentación incompleta",
  VENCIMIENTO_CORTO: "Vencimiento muy próximo",
  DIFERENCIA: "No coincide con lo pedido",
  OTRO: "Otro",
} as const;
export type MotivoRechazo = keyof typeof MOTIVOS_RECHAZO;
const motivoRechazo = z.enum(
  Object.keys(MOTIVOS_RECHAZO) as [MotivoRechazo, ...MotivoRechazo[]],
);

export const recepcionSchema = z.object({
  ubicacionId: id("Selecciona la ubicación de destino."),
  lineas: z
    .array(
      z
        .object({
          itemId: id(),
          aceptada: entero,
          numeroLote: opcional(60),
          vencimiento: z.union([z.iso.date(), z.literal("")]).default(""),
          rechazada: entero,
          motivoRechazo: motivoRechazo.optional(),
          detalle: opcional(200),
        })
        .superRefine((l, ctx) => {
          if (l.aceptada > 0 && (!l.numeroLote || !l.vencimiento))
            ctx.addIssue({
              code: "custom",
              message: "Las unidades aceptadas necesitan lote y vencimiento.",
            });
          if (l.rechazada > 0 && !l.motivoRechazo)
            ctx.addIssue({
              code: "custom",
              message: "Indica el motivo de las unidades rechazadas.",
            });
        }),
    )
    .min(1)
    .refine(
      (lineas) => lineas.some((l) => l.aceptada + l.rechazada > 0),
      "Ingresa al menos una cantidad recibida o rechazada.",
    ),
});

// Devoluciones

export const MOTIVOS_DEVOLUCION = {
  VENCIDO: "Producto vencido",
  RECHAZADO: "Rechazado en recepción",
  RETIRO_MERCADO: "Retiro de mercado (ISP)",
  OTRO: "Otro",
} as const;
export type MotivoDevolucion = keyof typeof MOTIVOS_DEVOLUCION;

export const devolucionSchema = z
  .object({
    proveedorId: id("Selecciona el proveedor."),
    motivo: z.enum(
      Object.keys(MOTIVOS_DEVOLUCION) as [
        MotivoDevolucion,
        ...MotivoDevolucion[],
      ],
    ),
    guia: opcional(40),
    observaciones: opcional(300),
    rechazoIds: z.array(id()).max(200).default([]),
    items: z
      .array(z.object({ stockId: id(), cantidad: entero.min(1) }))
      .max(200)
      .default([]),
  })
  .refine(
    (d) => d.rechazoIds.length + d.items.length > 0,
    "Selecciona al menos un producto para devolver.",
  );

export const cierreDevolucionSchema = z.object({
  notaCredito: texto("el número de la nota de crédito", 40),
  montoNotaCredito: pesos,
});

// Retiro de mercado

export const alertaRetiroSchema = z.object({
  resolucion: texto("el número de resolución o alerta del ISP", 60, 3),
  fecha: z.iso.date("Ingresa la fecha de la alerta."),
  medicamentoId: id("Selecciona el producto."),
  lotes: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Indica al menos un lote afectado.")
    .max(50),
  motivo: texto("el motivo del retiro", 300, 5),
});

// Caja

export const aperturaCajaSchema = z.object({ montoInicial: pesos });
export const movimientoCajaSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  monto: pesos.refine((m) => m > 0, "El monto debe ser mayor que cero."),
  motivo: texto("el motivo", 160, 3),
});
export const cierreCajaSchema = z.object({
  montoContado: pesos,
  observaciones: opcional(300),
});

/** Efectivo esperado al cierre de un turno. */
export function efectivoEsperado(t: {
  montoInicial: number;
  ventasEfectivo: number;
  ingresos: number;
  egresos: number;
}) {
  return (
    Math.round(
      (t.montoInicial + t.ventasEfectivo + t.ingresos - t.egresos) * 100,
    ) / 100
  );
}
