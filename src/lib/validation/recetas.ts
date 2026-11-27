import { z } from "zod";
import { rutError } from "@/lib/validation/user-fields";

/**
 * Reglas de recetas del simulador (Decretos 404 y 405 del MINSAL como
 * referencia). Las vigencias máximas son parámetros del simulador y pueden
 * ajustarse con la Dirección de Carrera.
 */
export const tiposReceta = ["SIMPLE", "RETENIDA", "CHEQUE"] as const;
export type TipoReceta = (typeof tiposReceta)[number];
export const origenesReceta = ["FISICA", "DIGITAL"] as const;

export const etiquetaTipoReceta: Record<TipoReceta, string> = {
  SIMPLE: "Receta simple",
  RETENIDA: "Receta retenida (psicotrópicos)",
  CHEQUE: "Receta cheque (estupefacientes)",
};

/** Días máximos entre la emisión y el fin de vigencia. */
export const vigenciaMaximaDias: Record<TipoReceta, number> = {
  SIMPLE: 180,
  RETENIDA: 30,
  CHEQUE: 30,
};

const rango: Record<TipoReceta, number> = { SIMPLE: 1, RETENIDA: 2, CHEQUE: 3 };

/** Condición de venta del producto → receta mínima exigida (null = libre). */
export function recetaExigida(condicionVenta: string): TipoReceta | null {
  if (condicionVenta === "RECETA_CHEQUE") return "CHEQUE";
  if (condicionVenta === "RECETA_RETENIDA") return "RETENIDA";
  if (condicionVenta === "RECETA_SIMPLE") return "SIMPLE";
  return null;
}

/** Retenidas y cheque corresponden a medicamentos del libro de controlados. */
export const esControlado = (condicionVenta: string) =>
  condicionVenta === "RECETA_RETENIDA" || condicionVenta === "RECETA_CHEQUE";

/** La receta más exigente que pide un carrito. */
export function recetaRequerida(condiciones: string[]): TipoReceta | null {
  let requerida: TipoReceta | null = null;
  for (const c of condiciones) {
    const tipo = recetaExigida(c);
    if (tipo && (!requerida || rango[tipo] > rango[requerida]))
      requerida = tipo;
  }
  return requerida;
}

/** Una receta cheque cubre también retenidas y simples, y así sucesivamente. */
export const recetaCubre = (presentada: TipoReceta, exigida: TipoReceta) =>
  rango[presentada] >= rango[exigida];

const rut = (campo: string) =>
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
    .min(3, `Ingresa el nombre del ${campo}.`)
    .max(120, `El nombre del ${campo} es demasiado largo.`);

export const recetaSchema = z
  .object({
    tipo: z.enum(tiposReceta),
    origen: z.enum(origenesReceta),
    folio: z.string().trim().max(40).default(""),
    pacienteRut: rut("RUT del paciente"),
    pacienteNombre: nombre("paciente"),
    medicoRut: rut("RUT del médico"),
    medicoNombre: nombre("médico"),
    fechaEmision: z.iso.date("Ingresa la fecha de emisión."),
    vigenteHasta: z.iso.date("Ingresa la fecha de vigencia."),
    observaciones: z.string().trim().max(500).default(""),
  })
  .superRefine((r, ctx) => {
    if (r.tipo !== "SIMPLE" && !r.folio)
      ctx.addIssue({
        code: "custom",
        path: ["folio"],
        message: "Las recetas retenidas y cheque exigen folio.",
      });
    if (r.vigenteHasta < r.fechaEmision)
      ctx.addIssue({
        code: "custom",
        path: ["vigenteHasta"],
        message: "La vigencia no puede terminar antes de la emisión.",
      });
    const dias =
      (Date.parse(r.vigenteHasta) - Date.parse(r.fechaEmision)) / 86_400_000;
    if (dias > vigenciaMaximaDias[r.tipo])
      ctx.addIssue({
        code: "custom",
        path: ["vigenteHasta"],
        message: `Una ${etiquetaTipoReceta[r.tipo].toLowerCase()} tiene vigencia máxima de ${vigenciaMaximaDias[r.tipo]} días.`,
      });
  });
export type RecetaInput = z.infer<typeof recetaSchema>;

/**
 * Validaciones que dependen del día actual (en Chile) y de lo que exige el
 * carrito. Devuelve el primer problema o null.
 */
export function problemaReceta(
  receta: RecetaInput | undefined,
  exigida: TipoReceta | null,
  hoy: string,
): string | null {
  if (!exigida) return null;
  if (!receta)
    return `El pedido incluye productos que exigen ${etiquetaTipoReceta[exigida].toLowerCase()}.`;
  if (!recetaCubre(receta.tipo, exigida))
    return `La receta presentada no basta: el pedido exige ${etiquetaTipoReceta[exigida].toLowerCase()}.`;
  if (receta.fechaEmision > hoy)
    return "La fecha de emisión no puede ser posterior a hoy.";
  if (receta.vigenteHasta < hoy) return "La receta está vencida.";
  if (receta.pacienteRut === receta.medicoRut && receta.tipo !== "SIMPLE")
    return "En recetas retenidas o cheque el médico no puede ser el paciente.";
  return null;
}

/** Fecha "YYYY-MM-DD" del día actual en Chile. */
export const hoyChile = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
