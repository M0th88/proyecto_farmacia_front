import "server-only";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import type { StockEdit } from "@/lib/types/stock-y-lotes";
import { stockDate, stockExpiry } from "./stock-dates";

export async function editStock(
  input: StockEdit,
  userId: number,
  db = prismaPrivada,
) {
  if (input.fechaFabricacion > stockDate(new Date()))
    throw new Error("La fecha de fabricación no puede estar en el futuro.");
  return db.$transaction(
    async (tx) => {
      const lot = await tx.lote.findUnique({ where: { id: input.loteId } });
      if (!lot) throw new Error("El lote ya no existe.");
      const stock = input.stockId
        ? await tx.stock.findUnique({
            where: { id: input.stockId },
            include: { ubicacion: true },
          })
        : null;
      if (
        input.stockId &&
        (!stock ||
          stock.loteId !== lot.id ||
          stock.cantidad !== input.cantidadAnterior)
      )
        throw new Error(
          "El stock cambió o ya no existe. Actualiza la tabla antes de editar.",
        );
      await tx.lote.update({
        where: { id: lot.id },
        data: {
          numeroLote: input.numeroLote,
          fechaFabricacion: new Date(`${input.fechaFabricacion}T12:00:00Z`),
          fechaVencimiento: stockExpiry(input.fechaVencimiento),
        },
      });
      if (stock)
        await tx.stock.update({
          where: { id: stock.id },
          data: { cantidad: input.cantidad },
        });
      await tx.movimientoStock.create({
        data: {
          tipo: "AJUSTE",
          cantidad: stock ? input.cantidad - stock.cantidad : 0,
          loteId: lot.id,
          motivo: `Edición por usuario #${userId} · ${stock?.ubicacion.nombre ?? "Lote sin ubicación"} · Stock ${stock?.cantidad ?? 0} → ${input.cantidad} · Lote ${lot.numeroLote} → ${input.numeroLote} · Fabricación ${lot.fechaFabricacion ? stockDate(lot.fechaFabricacion) : "Sin fecha"} → ${input.fechaFabricacion} · Vencimiento ${stockDate(lot.fechaVencimiento)} → ${input.fechaVencimiento} · ${input.motivo}`,
        },
      });
      return { success: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
