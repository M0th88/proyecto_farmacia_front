import { z } from "zod";
import { formatRut } from "@/lib/user-input";
import { rutError } from "@/lib/validation/user-fields";

export const tasaIva = 19;
export const montoPos = z
  .number()
  .nonnegative()
  .max(9_999_999_999.99)
  .multipleOf(0.01);

const texto = (maximo: number) =>
  z.string().trim().min(1, "Completa este campo.").max(maximo);

export const facturacionSchema = z.object({
  rut: texto(16)
    .regex(/^[\d.\-]+[\dKk]$/, "Ingresa un RUT válido.")
    .refine(
      (valor) => valor.replace(/[.\-]/g, "").length <= 9,
      "Ingresa un RUT válido.",
    )
    .transform(formatRut)
    .refine((valor) => !rutError(valor), "Ingresa un RUT válido."),
  razonSocial: texto(100),
  giro: texto(100),
  direccion: texto(120),
  comuna: texto(60),
  ciudad: texto(60),
  email: z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.email().max(254)]))
    .default(""),
});

export type Facturacion = z.infer<typeof facturacionSchema>;

export const camposFacturacion = [
  { nombre: "rut", etiqueta: "RUT", maximo: 16 },
  { nombre: "razonSocial", etiqueta: "Razón social", maximo: 100 },
  { nombre: "giro", etiqueta: "Giro", maximo: 100 },
  { nombre: "direccion", etiqueta: "Dirección", maximo: 120 },
  { nombre: "comuna", etiqueta: "Comuna", maximo: 60 },
  { nombre: "ciudad", etiqueta: "Ciudad", maximo: 60 },
  { nombre: "email", etiqueta: "Correo electrónico", maximo: 254 },
] satisfies { nombre: keyof Facturacion; etiqueta: string; maximo: number }[];

export const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 2,
}).format;

export const fechaVenta = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
}).format;

export function calcularTotales(subtotal: number, descuento: number) {
  const centavos = Math.round(subtotal * 100) - Math.round(descuento * 100);
  const unidad = centavos % 100 === 0 ? 100 : 1;
  const neto =
    Math.round(((centavos / unidad) * 100) / (100 + tasaIva)) * unidad;
  return {
    total: centavos / 100,
    neto: neto / 100,
    iva: (centavos - neto) / 100,
  };
}
