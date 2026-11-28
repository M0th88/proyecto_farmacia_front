import { z } from "zod";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import {
  AbastecimientoError,
  crearAlertaRetiro,
} from "@/lib/private/abastecimiento";
import { alertaRetiroSchema } from "@/lib/validation/abastecimiento";
import { ruta } from "../_gestion";

export const POST = ruta(
  "inventario",
  alertaRetiroSchema,
  async (input, user) => {
    const r = await crearAlertaRetiro(input, user.id);
    return Response.json(
      { id: r.alerta.id, bloqueados: r.bloqueados },
      { status: 201 },
    );
  },
);

/** Cierra la alerta; los lotes siguen bloqueados como retirados. */
export const PATCH = ruta(
  "inventario",
  z.object({ id: z.number().int().positive() }),
  async ({ id }) => {
    const r = await db.alertaRetiro.updateMany({
      where: { id, estado: "ACTIVA" },
      data: { estado: "CERRADA", cerradaEn: new Date() },
    });
    if (!r.count)
      throw new AbastecimientoError("La alerta no existe o ya está cerrada.");
    return Response.json({ id });
  },
);
