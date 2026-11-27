import { z } from "zod";
import { rutError } from "@/lib/validation/user-fields";

/**
 * Convenios de descuento simulados. No se conectan con Isapres, Fonasa ni
 * aseguradoras reales: el porcentaje se configura en el sistema.
 */
export const tiposConvenio = ["ISAPRE", "FONASA", "GES", "SEGURO"] as const;
export type TipoConvenio = (typeof tiposConvenio)[number];
export const etiquetaTipoConvenio: Record<TipoConvenio, string> = {
  ISAPRE: "Isapre",
  FONASA: "Fonasa",
  GES: "GES / AUGE",
  SEGURO: "Seguro complementario",
};

export const rutConvenio = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const error = rutError(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  })
  .transform((v) => v.toUpperCase());

export const convenioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "Ingresa el nombre del convenio.")
    .max(80, "El nombre es demasiado largo."),
  tipo: z.enum(tiposConvenio),
  porcentaje: z
    .number("Ingresa un porcentaje.")
    .gt(0, "El porcentaje debe ser mayor que 0.")
    .max(100, "El porcentaje no puede superar 100.")
    .multipleOf(0.01, "Usa como máximo dos decimales."),
  activo: z.boolean().default(true),
});
export type ConvenioInput = z.infer<typeof convenioSchema>;

export const afiliadoSchema = z.object({
  rut: rutConvenio,
  nombre: z
    .string()
    .trim()
    .min(3, "Ingresa el nombre del cliente.")
    .max(120, "El nombre es demasiado largo."),
  convenioId: z.number().int().positive("Selecciona un convenio."),
});
export type AfiliadoInput = z.infer<typeof afiliadoSchema>;

/** Descuento del convenio en pesos enteros sobre el subtotal con IVA. */
export function descuentoConvenio(subtotal: number, porcentaje: number) {
  return Math.round((subtotal * porcentaje) / 100);
}
