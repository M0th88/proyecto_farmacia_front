import { Prisma } from "@/generated/asistencial/client";
import { fichaPaciente } from "@/lib/asistencial/dispensacion";
import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import { pacienteSchema, rutSchema } from "@/lib/validation/dispensacion";
import { datosInvalidos, usuarioAsistencial } from "../_auth";

/** Ficha del paciente con programas, cuota del mes y stock disponible. */
export async function GET(request: Request) {
  const auth = await usuarioAsistencial("pos");
  if (auth.error) return auth.error;
  const rut = rutSchema("RUT").safeParse(
    new URL(request.url).searchParams.get("rut") ?? "",
  );
  if (!rut.success) return datosInvalidos(rut.error.issues);
  const ficha = await fichaPaciente(rut.data);
  return ficha
    ? Response.json(ficha, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        { error: "No hay un paciente registrado con ese RUT." },
        { status: 404 },
      );
}

export async function POST(request: Request) {
  const auth = await usuarioAsistencial("pos");
  if (auth.error) return auth.error;
  const parsed = pacienteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return datosInvalidos(parsed.error.issues);
  const { fechaNacimiento, telefono, direccion, ...resto } = parsed.data;
  try {
    const p = await db.paciente.create({
      data: {
        ...resto,
        fechaNacimiento: fechaNacimiento
          ? new Date(`${fechaNacimiento}T00:00:00Z`)
          : null,
        telefono: telefono || null,
        direccion: direccion || null,
      },
    });
    return Response.json({ id: p.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return Response.json(
        { error: "Ya existe un paciente con ese RUT." },
        { status: 409 },
      );
    throw e;
  }
}
