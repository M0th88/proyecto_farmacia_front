import { Prisma } from "@/generated/asistencial/client";
import { DispensacionError, dispensar } from "@/lib/asistencial/dispensacion";
import { dispensacionSchema } from "@/lib/validation/dispensacion";
import { datosInvalidos, usuarioAsistencial } from "../_auth";

export async function POST(request: Request) {
  const auth = await usuarioAsistencial("pos");
  if (auth.error) return auth.error;
  const parsed = dispensacionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return datosInvalidos(parsed.error.issues);
  try {
    const d = await dispensar(parsed.data, auth.user.id);
    return Response.json({ id: d.id }, { status: 201 });
  } catch (e) {
    if (e instanceof DispensacionError)
      return Response.json({ error: e.message }, { status: 409 });
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2034" || e.code === "P2002")
    )
      return Response.json(
        { error: "Otro usuario modificó los datos. Intenta nuevamente." },
        { status: 409 },
      );
    console.error("Dispensación:", e);
    return Response.json(
      { error: "No se pudo registrar la entrega." },
      { status: 500 },
    );
  }
}
