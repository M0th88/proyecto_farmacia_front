import "server-only";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import type { StockEntry } from "@/lib/types/stock-y-lotes";
import { stockDate, stockExpiry } from "./stock-dates";

export async function addStock(
  input: StockEntry,
  userId: number,
  db = prismaPrivada,
) {
  const expires = stockExpiry(input.fechaVencimiento);
  if (expires <= new Date())
    throw new Error("No se puede añadir stock a un lote vencido.");
  if (input.fechaFabricacion && input.fechaFabricacion > stockDate(new Date()))
    throw new Error("La fecha de fabricación no puede estar en el futuro.");
  return db.$transaction(
    async (tx) => {
      const product = await tx.medicamento.findUnique({
        where: { id: input.medicamentoId },
      });
      if (!product?.activo)
        throw new Error("El producto no existe o está inactivo.");
      let location = input.ubicacionId
        ? await tx.ubicacionInventario.findUnique({
            where: { id: input.ubicacionId },
          })
        : await tx.ubicacionInventario.findFirst({
            where: { nombre: input.ubicacionNombre, tipo: input.ubicacionTipo },
          });
      if (!location && input.ubicacionId)
        throw new Error(
          "La ubicación ya no existe. Actualiza e intenta nuevamente.",
        );
      location ??= await tx.ubicacionInventario.create({
        data: { nombre: input.ubicacionNombre, tipo: input.ubicacionTipo },
      });
      const lot = await tx.lote.upsert({
        where: {
          medicamentoId_numeroLote: {
            medicamentoId: input.medicamentoId,
            numeroLote: input.numeroLote,
          },
        },
        update: {},
        create: {
          medicamentoId: input.medicamentoId,
          numeroLote: input.numeroLote,
          fechaVencimiento: expires,
          fechaFabricacion: new Date(`${input.fechaFabricacion}T12:00:00Z`),
        },
      });
      if (
        stockDate(lot.fechaVencimiento) !== input.fechaVencimiento ||
        (lot.fechaFabricacion &&
          stockDate(lot.fechaFabricacion) !== input.fechaFabricacion)
      )
        throw new Error(
          "El lote ya existe con otras fechas. Selecciona sus fechas registradas o usa otro número de lote.",
        );
      if (lot.fechaVencimiento <= new Date())
        throw new Error("No se puede añadir stock a un lote vencido.");
      if (!lot.fechaFabricacion) {
        await tx.lote.update({
          where: { id: lot.id },
          data: {
            fechaFabricacion: new Date(`${input.fechaFabricacion}T12:00:00Z`),
          },
        });
      }
      const stock = await tx.stock.upsert({
        where: {
          loteId_ubicacionId: { loteId: lot.id, ubicacionId: location.id },
        },
        create: {
          loteId: lot.id,
          ubicacionId: location.id,
          cantidad: input.cantidad,
        },
        update: { cantidad: { increment: input.cantidad } },
      });
      await tx.movimientoStock.create({
        data: {
          tipo: "ENTRADA",
          cantidad: input.cantidad,
          loteId: lot.id,
          motivo: `Entrada por usuario #${userId} · ${location.nombre}${input.motivo ? ` · ${input.motivo}` : ""}`,
        },
      });
      return { id: stock.id, cantidad: stock.cantidad };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
