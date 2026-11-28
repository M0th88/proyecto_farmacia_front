import { z } from "zod";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { marcaSchema } from "@/lib/validation/abastecimiento";
import { ruta } from "../_gestion";

const datos = (m: z.infer<typeof marcaSchema>) => ({
  ...m,
  laboratorio: m.laboratorio || null,
  pais: m.pais || null,
});

export const POST = ruta("catalogo", marcaSchema, async (m) => {
  const r = await db.marca.create({ data: datos(m) });
  return Response.json({ id: r.id }, { status: 201 });
});

export const PATCH = ruta(
  "catalogo",
  marcaSchema.extend({ id: z.number().int().positive() }),
  async ({ id, ...m }) => {
    await db.marca.update({ where: { id }, data: datos(m) });
    return Response.json({ id });
  },
);
