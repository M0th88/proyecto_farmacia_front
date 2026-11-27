import { stockDate } from "./private/stock-dates";

export const DIAS_PROXIMO_VENCIMIENTO = 30;

export function etiquetaVencimiento(
  vencimiento?: string | null,
  hoy = stockDate(new Date()),
) {
  if (!vencimiento)
    return { color: "gris", texto: "Sin vencimiento confirmado" };
  const dias = (Date.parse(vencimiento) - Date.parse(hoy)) / 86400000;
  if (!Number.isFinite(dias))
    return { color: "gris", texto: "Sin vencimiento confirmado" };
  if (dias < 0) return { color: "rojo", texto: "Vencido · Retirar" };
  if (dias <= DIAS_PROXIMO_VENCIMIENTO)
    return { color: "amarillo", texto: "Próximo a vencer" };
  return { color: "verde", texto: "Vencimiento vigente" };
}
