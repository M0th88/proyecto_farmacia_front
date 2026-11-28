import { Prisma } from "@/generated/asistencial/client";
import {
  DispensacionError,
  recibirRemesa,
} from "@/lib/asistencial/dispensacion";
import { remesaSchema } from "@/lib/validation/dispensacion";
import { datosInvalidos, usuarioAsistencial } from "../_auth";

export async function POST(request: Request) {
  const auth = await usuarioAsistencial("inventario");
  if (auth.error) return auth.error;
  const parsed = remesaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return datosInvalidos(parsed.error.issues);
  try {
    const r = await recibirRemesa(parsed.data, auth.user.id);
    return Response.json({ id: r.id }, { status: 201 });
  } catch (e) {
    if (e instanceof DispensacionError)
      return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034")
      return Response.json(
        { error: "Otro usuario modificó el stock. Intenta nuevamente." },
        { status: 409 },
      );
    console.error("Remesa:", e);
    return Response.json(
      { error: "No se pudo registrar la remesa." },
      { status: 500 },
    );
  }
}
