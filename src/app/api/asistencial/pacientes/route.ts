import { z } from "zod";
import { Prisma } from "@/generated/asistencial/client";
import { fichaPaciente } from "@/lib/asistencial/dispensacion";
import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import {
  pacienteSchema,
  previsionSchema,
  rutSchema,
} from "@/lib/validation/dispensacion";
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
  const { fechaNacimiento, telefono, direccion, tramoFonasa, ...resto } =
    parsed.data;
  try {
    const p = await db.paciente.create({
      data: {
        ...resto,
        fechaNacimiento: fechaNacimiento
          ? new Date(`${fechaNacimiento}T00:00:00Z`)
          : null,
        telefono: telefono || null,
        direccion: direccion || null,
        tramoFonasa: tramoFonasa || null,
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

/** Actualiza la previsión y el tramo Fonasa de un paciente. */
export async function PATCH(request: Request) {
  const auth = await usuarioAsistencial("pos");
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const id = z.number().int().positive().safeParse(body?.id);
  const parsed = previsionSchema.safeParse(body);
  if (!id.success || !parsed.success)
    return datosInvalidos(
      parsed.success
        ? [{ message: "Paciente inválido." }]
        : parsed.error.issues,
    );
  const r = await db.paciente.updateMany({
    where: { id: id.data },
    data: {
      prevision: parsed.data.prevision,
      tramoFonasa: parsed.data.tramoFonasa || null,
    },
  });
  return r.count
    ? Response.json({ id: id.data })
    : Response.json({ error: "El paciente no existe." }, { status: 404 });
}
