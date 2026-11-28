import { z } from "zod";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { AbastecimientoError } from "@/lib/private/abastecimiento";
import { ordenCompraSchema } from "@/lib/validation/abastecimiento";
import { ruta } from "../_gestion";

/** Crea una orden en borrador (o ya enviada, con enviar: true). */
export const POST = ruta(
  "compras",
  ordenCompraSchema.extend({ enviar: z.boolean().default(false) }),
  async (
    { items, fechaEsperada, observaciones, enviar, proveedorId },
    user,
  ) => {
    const proveedor = await db.proveedor.findUnique({
      where: { id: proveedorId },
    });
    if (!proveedor?.activo)
      throw new AbastecimientoError("Selecciona un proveedor activo.");
    const orden = await db.ordenCompra.create({
      data: {
        proveedorId,
        estado: enviar ? "ENVIADA" : "BORRADOR",
        enviadaEn: enviar ? new Date() : null,
        fechaEsperada: fechaEsperada
          ? new Date(`${fechaEsperada}T00:00:00Z`)
          : null,
        observaciones: observaciones || null,
        usuarioId: user.id,
        items: { create: items },
      },
    });
    return Response.json({ id: orden.id }, { status: 201 });
  },
);

/** Cambia el estado: ENVIAR un borrador o ANULAR una orden sin recepciones. */
export const PATCH = ruta(
  "compras",
  z.object({
    id: z.number().int().positive(),
    accion: z.enum(["ENVIAR", "ANULAR"]),
  }),
  async ({ id, accion }) => {
    const orden = await db.ordenCompra.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!orden) throw new AbastecimientoError("La orden no existe.");
    if (accion === "ENVIAR") {
      if (orden.estado !== "BORRADOR")
        throw new AbastecimientoError("Solo se envían órdenes en borrador.");
      await db.ordenCompra.update({
        where: { id },
        data: { estado: "ENVIADA", enviadaEn: new Date() },
      });
    } else {
      if (
        !["BORRADOR", "ENVIADA"].includes(orden.estado) ||
        orden.items.some((i) => i.recibida + i.rechazada > 0)
      )
        throw new AbastecimientoError(
          "Solo se anulan órdenes sin unidades recibidas.",
        );
      await db.ordenCompra.update({
        where: { id },
        data: { estado: "ANULADA" },
      });
    }
    return Response.json({ id });
  },
);
