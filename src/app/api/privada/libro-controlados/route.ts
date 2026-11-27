import { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";
import {
  LibroError,
  registrarMovimientoLibro,
} from "@/lib/private/controlados";

const entrada = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("APERTURA"),
    medicamentoId: z.number().int().positive(),
  }),
  z.object({
    tipo: z.enum(["ENTRADA", "AJUSTE"]),
    medicamentoId: z.number().int().positive(),
    cantidad: z.number().int().min(-1_000_000).max(1_000_000),
    detalle: z
      .string()
      .trim()
      .min(5, "Describe el motivo (mínimo 5 caracteres).")
      .max(300),
  }),
]);

export async function POST(request: Request) {
  const user = await currentPrivateUser();
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (!canOperate(user, "controlados_firmar"))
    return Response.json(
      { error: "Solo el Químico Farmacéutico puede registrar en el libro." },
      { status: 403 },
    );
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  const d = parsed.data;
  try {
    const registro = await registrarMovimientoLibro(
      d.tipo === "APERTURA"
        ? {
            medicamentoId: d.medicamentoId,
            tipo: "APERTURA",
            cantidad: 0,
            detalle: "Apertura manual con el stock físico actual",
            usuarioId: user.id,
          }
        : { ...d, usuarioId: user.id },
    );
    return Response.json({ id: registro.id, saldo: registro.saldo });
  } catch (error) {
    if (error instanceof LibroError)
      return Response.json({ error: error.message }, { status: 409 });
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return Response.json(
        { error: "Otro usuario modificó el libro. Inténtalo nuevamente." },
        { status: 409 },
      );
    console.error("Libro de controlados:", error);
    return Response.json(
      { error: "No se pudo registrar el movimiento." },
      { status: 500 },
    );
  }
}
