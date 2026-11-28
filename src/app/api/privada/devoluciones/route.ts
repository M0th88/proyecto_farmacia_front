import { z } from "zod";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import {
  AbastecimientoError,
  crearDevolucion,
} from "@/lib/private/abastecimiento";
import {
  cierreDevolucionSchema,
  devolucionSchema,
} from "@/lib/validation/abastecimiento";
import { ruta } from "../_gestion";

export const POST = ruta("compras", devolucionSchema, async (input, user) => {
  const d = await crearDevolucion(input, user.id);
  return Response.json({ id: d.id }, { status: 201 });
});

/** Cierra la devolución al recibir la nota de crédito del proveedor. */
export const PATCH = ruta(
  "compras",
  cierreDevolucionSchema.extend({ id: z.number().int().positive() }),
  async ({ id, notaCredito, montoNotaCredito }) => {
    const r = await db.devolucionProveedor.updateMany({
      where: { id, estado: "EMITIDA" },
      data: {
        estado: "CERRADA",
        notaCredito,
        montoNotaCredito,
        cerradaEn: new Date(),
      },
    });
    if (!r.count)
      throw new AbastecimientoError(
        "La devolución no existe o ya está cerrada.",
      );
    return Response.json({ id });
  },
);
