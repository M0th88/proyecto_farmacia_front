import type { PreparedLot } from "@/lib/types/fefo";
export function expiryDay(label: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(label);
  const day = match ? `${match[3]}-${match[2]}-${match[1]}` : label;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === day
    ? day
    : null;
}
export const canOperate = (
  user: { rol: { nombre: string; permisos: string[] } },
  permission: string,
) =>
  user.rol.nombre === "Administrador" || user.rol.permisos.includes(permission);
export function aptStock(
  stock: {
    cantidad: number;
    cantidadBloqueada?: number;
    fechaRecepcion: Date | string | null;
    lote: {
      numeroLote: string;
      fechaVencimiento: Date | string;
      estado: string;
      precisionVencimiento: string;
      rotuloVencimiento: string | null;
    };
  },
  now = new Date(),
) {
  return (
    stock.cantidad > (stock.cantidadBloqueada ?? 0) &&
    !!stock.fechaRecepcion &&
    !!stock.lote.numeroLote.trim() &&
    !!stock.lote.rotuloVencimiento &&
    stock.lote.estado === "APTO" &&
    stock.lote.precisionVencimiento === "DIA" &&
    new Date(stock.lote.fechaVencimiento) > now
  );
}

export function stockDisponibleFefo(
  stock: {
    cantidad: number;
    cantidadBloqueada?: number;
    fechaRecepcion?: Date | null;
    ubicacion: { id?: number; sucursalId?: number | null };
  },
  lote: {
    numeroLote: string;
    fechaVencimiento: Date;
    estado?: string;
    precisionVencimiento?: string;
    rotuloVencimiento?: string | null;
  },
  now: Date,
) {
  return (
    !!stock.ubicacion.sucursalId &&
    aptStock(
      {
        cantidad: stock.cantidad,
        cantidadBloqueada: stock.cantidadBloqueada,
        fechaRecepcion: stock.fechaRecepcion ?? null,
        lote: {
          ...lote,
          estado: lote.estado ?? "",
          precisionVencimiento: lote.precisionVencimiento ?? "",
          rotuloVencimiento: lote.rotuloVencimiento ?? null,
        },
      },
      now,
    )
  );
}
export function allocateFefo(
  candidates: PreparedLot[],
  items: { medicamentoId: number; cantidad: number }[],
) {
  const sorted = [...candidates].sort(
    (a, b) =>
      a.vencimiento.localeCompare(b.vencimiento) ||
      a.recepcion.localeCompare(b.recepcion) ||
      a.loteId - b.loteId ||
      a.stockId - b.stockId,
  );
  const suggested: PreparedLot[] = [];
  const missing: { medicamentoId: number; nombre: string; cantidad: number }[] =
    [];
  for (const item of items) {
    let remaining = item.cantidad;
    for (const stock of sorted.filter(
      (row) => row.medicamentoId === item.medicamentoId,
    )) {
      const quantity = Math.min(remaining, stock.disponible);
      if (quantity > 0) suggested.push({ ...stock, cantidad: quantity });
      remaining -= quantity;
      if (!remaining) break;
    }
    if (remaining)
      missing.push({
        medicamentoId: item.medicamentoId,
        nombre:
          candidates.find((row) => row.medicamentoId === item.medicamentoId)
            ?.producto ?? `Producto #${item.medicamentoId}`,
        cantidad: remaining,
      });
  }
  return { suggested, missing, sorted };
}
export function sameAllocation(
  a: { stockId: number; cantidad: number }[],
  b: { stockId: number; cantidad: number }[],
) {
  return (
    a.length === b.length &&
    a.every((item) =>
      b.some(
        (other) =>
          other.stockId === item.stockId && other.cantidad === item.cantidad,
      ),
    )
  );
}
