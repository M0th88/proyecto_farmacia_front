import { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { listarConvenios } from "@/lib/private/convenios";
import { convenioSchema } from "@/lib/validation/convenios";
import { adminConvenios, primerError } from "./_auth";

const duplicado = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function GET() {
  const auth = await adminConvenios();
  if (auth.error) return auth.error;
  return Response.json(await listarConvenios(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const auth = await adminConvenios();
  if (auth.error) return auth.error;
  const parsed = convenioSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return primerError(parsed.error.issues);
  try {
    const c = await prismaPrivada.convenioDescuento.create({
      data: parsed.data,
    });
    return Response.json({ id: c.id }, { status: 201 });
  } catch (e) {
    if (duplicado(e))
      return Response.json(
        { error: "Ya existe un convenio con ese nombre." },
        { status: 409 },
      );
    throw e;
  }
}

export async function PATCH(request: Request) {
  const auth = await adminConvenios();
  if (auth.error) return auth.error;
  const parsed = convenioSchema
    .extend({ id: z.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return primerError(parsed.error.issues);
  const { id, ...data } = parsed.data;
  try {
    await prismaPrivada.convenioDescuento.update({ where: { id }, data });
    return Response.json({ id });
  } catch (e) {
    if (duplicado(e))
      return Response.json(
        { error: "Ya existe un convenio con ese nombre." },
        { status: 409 },
      );
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      return Response.json(
        { error: "El convenio no existe." },
        { status: 404 },
      );
    throw e;
  }
}
