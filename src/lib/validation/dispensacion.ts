import { z } from "zod";
import { rutError } from "@/lib/validation/user-fields";

/**
 * Reglas de la dispensación asistencial (CESFAM). Los valores son parámetros
 * del simulador y se pueden ajustar con la Dirección de Carrera.
 */
export const VIGENCIA_RECETA_DIAS = 180;
export const etiquetaTipoPrograma = {
  GES: "GES / AUGE",
  CRONICO: "Crónicos",
  OTRO: "Otro programa",
} as const;
export const parentescos = [
  "Padre",
  "Madre",
  "Hijo/a",
  "Cónyuge o pareja",
  "Hermano/a",
  "Cuidador/a",
  "Otro",
] as const;

export const rutSchema = (campo: string) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const error = rutError(value);
      if (error)
        ctx.addIssue({ code: "custom", message: `${campo}: ${error}` });
    })
    .transform((v) => v.toUpperCase());
const nombre = (campo: string) =>
  z
    .string()
    .trim()
    .min(3, `Ingresa el nombre ${campo}.`)
    .max(120, `El nombre ${campo} es demasiado largo.`);

export const dispensacionSchema = z.object({
  claveOperacion: z.uuid(),
  pacienteRut: rutSchema("RUT del paciente"),
  programaId: z.number().int().positive("Selecciona el programa."),
  receta: z.object({
    folio: z.string().trim().max(40).default(""),
    medicoRut: rutSchema("RUT del médico"),
    medicoNombre: nombre("del médico"),
    fecha: z.iso.date("Ingresa la fecha de la receta."),
  }),
  retira: z
    .object({
      rut: rutSchema("RUT de quien retira"),
      nombre: nombre("de quien retira"),
      parentesco: z.enum(parentescos, "Indica el parentesco."),
    })
    .optional(),
  observaciones: z.string().trim().max(300).default(""),
  items: z
    .array(
      z.object({
        medicamentoId: z.number().int().positive(),
        cantidad: z
          .number()
          .int("Las cantidades deben ser enteras.")
          .positive("Las cantidades deben ser mayores que cero.")
          .max(10_000),
      }),
    )
    .min(1, "Agrega al menos un medicamento.")
    .max(30),
});
export type DispensacionInput = z.infer<typeof dispensacionSchema>;

/** Problema de vigencia de la receta respecto de hoy (Chile), o null. */
export function problemaRecetaAsistencial(fecha: string, hoy: string) {
  if (fecha > hoy) return "La fecha de la receta no puede ser posterior a hoy.";
  const dias = (Date.parse(hoy) - Date.parse(fecha)) / 86_400_000;
  if (dias > VIGENCIA_RECETA_DIAS)
    return `La receta tiene más de ${VIGENCIA_RECETA_DIAS} días; solicita una nueva al médico.`;
  return null;
}

export const pacienteSchema = z.object({
  rut: rutSchema("RUT"),
  nombre: nombre("del paciente"),
  fechaNacimiento: z.union([z.iso.date(), z.literal("")]).default(""),
  telefono: z.string().trim().max(20).default(""),
  direccion: z.string().trim().max(160).default(""),
});

export const inscripcionSchema = z.object({
  pacienteId: z.number().int().positive(),
  programaId: z.number().int().positive("Selecciona el programa."),
  activo: z.boolean().default(true),
});

export const remesaSchema = z.object({
  guia: z
    .string()
    .trim()
    .min(1, "Ingresa el número de guía de despacho.")
    .max(40),
  proveedor: z.string().trim().min(2).max(60).default("CENABAST"),
  observaciones: z.string().trim().max(300).default(""),
  items: z
    .array(
      z.object({
        medicamentoId: z.number().int().positive("Selecciona el medicamento."),
        numeroLote: z
          .string()
          .trim()
          .min(1, "Ingresa el número de lote.")
          .max(60),
        fechaVencimiento: z.iso.date("Ingresa el vencimiento."),
        cantidad: z
          .number()
          .int()
          .positive("La cantidad debe ser mayor que 0.")
          .max(1_000_000),
        ubicacionId: z.number().int().positive("Selecciona la ubicación."),
      }),
    )
    .min(1, "Agrega al menos un lote.")
    .max(100),
});
export type RemesaInput = z.infer<typeof remesaSchema>;
