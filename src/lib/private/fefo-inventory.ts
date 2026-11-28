import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { expiryDay } from "@/lib/fefo";
import { stockDate, stockExpiry } from "@/lib/private/stock-dates";
import { receiptSchema } from "@/lib/types/fefo";
export type Receipt = z.infer<typeof receiptSchema>;

export async function receiveFefo(input: Receipt, userId: number) {
  return prismaPrivada.$transaction((tx) => receiveFefoTx(tx, input, userId), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Recepción FEFO dentro de una transacción existente (por ejemplo, la
 * recepción de una orden de compra con varias líneas).
 */
export async function receiveFefoTx(
  tx: Prisma.TransactionClient,
  input: Receipt,
  userId: number,
) {
  if (new Date(input.fechaRecepcion) > new Date())
    throw new Error("La recepción no puede estar en el futuro.");
  {
    {
      const product = await tx.medicamento.findUnique({
        where: { id: input.medicamentoId },
      });
      const location = await tx.ubicacionInventario.findUnique({
        where: { id: input.ubicacionId },
      });
      if (!product?.activo || !location?.sucursalId)
        throw new Error(
          "Selecciona producto activo y ubicación con sucursal asignada.",
        );
      const expiry = expiryDay(input.rotuloVencimiento);
      const verified =
        input.verificado &&
        !!input.numeroLote &&
        input.precisionVencimiento === "DIA" &&
        !!expiry;
      if (!verified) {
        const review = await tx.revisionInventario.create({
          data: {
            medicamentoId: product.id,
            ubicacionId: location.id,
            cantidad: input.cantidad,
            numeroLote: input.numeroLote || null,
            rotuloVencimiento: input.rotuloVencimiento || null,
            precisionVencimiento: input.precisionVencimiento,
            fechaRecepcion: new Date(input.fechaRecepcion),
            fechaFabricacion: input.fechaFabricacion
              ? new Date(`${input.fechaFabricacion}T12:00:00Z`)
              : null,
            registradoPor: userId,
            motivo:
              input.motivo ||
              "Recepción sin lote o vencimiento verificable; pendiente de revisión física.",
          },
        });
        return { pendiente: true, id: review.id };
      }
      const expires = stockExpiry(expiry!);
      if (expires <= new Date())
        throw new Error(
          "El lote está vencido. Registra la recepción pendiente de revisión, no como stock apto.",
        );
      if (
        input.fechaFabricacion &&
        (input.fechaFabricacion > stockDate(new Date()) ||
          input.fechaFabricacion > expiry!)
      )
        throw new Error("La fecha de fabricación no es válida.");
      const lot = await tx.lote.upsert({
        where: {
          medicamentoId_numeroLote: {
            medicamentoId: product.id,
            numeroLote: input.numeroLote,
          },
        },
        update: {},
        create: {
          medicamentoId: product.id,
          numeroLote: input.numeroLote,
          fechaVencimiento: expires,
          fechaFabricacion: input.fechaFabricacion
            ? new Date(`${input.fechaFabricacion}T12:00:00Z`)
            : null,
          rotuloVencimiento: input.rotuloVencimiento,
          precisionVencimiento: "DIA",
          estado: "APTO",
        },
      });
      if (
        lot.estado !== "APTO" ||
        lot.precisionVencimiento !== "DIA" ||
        stockDate(lot.fechaVencimiento) !== expiry
      )
        throw new Error(
          "El lote existente está bloqueado o sus datos no coinciden. Revisa y concilia el lote antes de añadir unidades aptas.",
        );
      const stock = await tx.stock.findUnique({
        where: {
          loteId_ubicacionId: { loteId: lot.id, ubicacionId: location.id },
        },
      });
      if (stock && !stock.fechaRecepcion && stock.cantidad > 0)
        throw new Error(
          "La existencia histórica de esta ubicación necesita conciliar su recepción antes de sumar stock apto.",
        );
      const received =
        stock?.fechaRecepcion &&
        stock.fechaRecepcion < new Date(input.fechaRecepcion)
          ? stock.fechaRecepcion
          : new Date(input.fechaRecepcion);
      const saved = await tx.stock.upsert({
        where: {
          loteId_ubicacionId: { loteId: lot.id, ubicacionId: location.id },
        },
        create: {
          loteId: lot.id,
          ubicacionId: location.id,
          cantidad: input.cantidad,
          fechaRecepcion: received,
        },
        update: {
          cantidad: { increment: input.cantidad },
          fechaRecepcion: received,
        },
      });
      await tx.movimientoStock.create({
        data: {
          loteId: lot.id,
          ubicacionId: location.id,
          tipo: "ENTRADA",
          cantidad: input.cantidad,
          usuarioId: userId,
          origen: "RECEPCION_VERIFICADA",
          motivo: `Recepción ${input.fechaRecepcion} · ${input.motivo}`,
        },
      });
      return { pendiente: false, id: saved.id };
    }
  }
}
