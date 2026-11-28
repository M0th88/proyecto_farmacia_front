import { z } from "zod";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { proveedorSchema } from "@/lib/validation/abastecimiento";
import { ruta } from "../_gestion";

const datos = (p: z.infer<typeof proveedorSchema>) => ({
  ...p,
  nombreFantasia: p.nombreFantasia || null,
  contacto: p.contacto || null,
  telefono: p.telefono || null,
  email: p.email || null,
  direccion: p.direccion || null,
});

export const POST = ruta("proveedores", proveedorSchema, async (p) => {
  const r = await db.proveedor.create({ data: datos(p) });
  return Response.json({ id: r.id }, { status: 201 });
});

export const PATCH = ruta(
  "proveedores",
  proveedorSchema.extend({ id: z.number().int().positive() }),
  async ({ id, ...p }) => {
    await db.proveedor.update({ where: { id }, data: datos(p) });
    return Response.json({ id });
  },
);
