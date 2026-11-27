import { prismaPrivada } from "@/lib/db/prisma-privada";
import { afiliadoSchema } from "@/lib/validation/convenios";
import { adminConvenios, primerError } from "../_auth";

/** Afilia un RUT a un convenio; si ya estaba afiliado, lo cambia de convenio. */
export async function POST(request: Request) {
  const auth = await adminConvenios();
  if (auth.error) return auth.error;
  const parsed = afiliadoSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return primerError(parsed.error.issues);
  const { rut, nombre, convenioId } = parsed.data;
  if (
    !(await prismaPrivada.convenioDescuento.findUnique({
      where: { id: convenioId },
    }))
  )
    return Response.json({ error: "El convenio no existe." }, { status: 404 });
  const c = await prismaPrivada.clienteConvenio.upsert({
    where: { rut },
    create: { rut, nombre, convenioId },
    update: { nombre, convenioId },
  });
  return Response.json({ id: c.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await adminConvenios();
  if (auth.error) return auth.error;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "Afiliado inválido." }, { status: 400 });
  const r = await prismaPrivada.clienteConvenio.deleteMany({ where: { id } });
  return r.count
    ? Response.json({ eliminado: id })
    : Response.json({ error: "El afiliado no existe." }, { status: 404 });
}
