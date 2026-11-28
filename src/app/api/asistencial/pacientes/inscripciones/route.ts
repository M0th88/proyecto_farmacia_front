import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import { inscripcionSchema } from "@/lib/validation/dispensacion";
import { hoyChile } from "@/lib/validation/recetas";
import { datosInvalidos, usuarioAsistencial } from "../../_auth";

/** Inscribe al paciente en un programa, o activa/desactiva su inscripción. */
export async function POST(request: Request) {
  const auth = await usuarioAsistencial("pos");
  if (auth.error) return auth.error;
  const parsed = inscripcionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return datosInvalidos(parsed.error.issues);
  const { pacienteId, programaId, activo } = parsed.data;
  const [paciente, programa] = await Promise.all([
    db.paciente.findUnique({ where: { id: pacienteId } }),
    db.programaSalud.findUnique({ where: { id: programaId } }),
  ]);
  if (!paciente || !programa)
    return Response.json(
      { error: "Paciente o programa inexistente." },
      { status: 404 },
    );
  const i = await db.inscripcionPrograma.upsert({
    where: { pacienteId_programaId: { pacienteId, programaId } },
    create: {
      pacienteId,
      programaId,
      activo,
      desde: new Date(`${hoyChile()}T00:00:00Z`),
    },
    update: { activo },
  });
  return Response.json({ id: i.id, activo: i.activo });
}
