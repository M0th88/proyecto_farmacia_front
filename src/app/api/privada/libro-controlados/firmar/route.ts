import bcrypt from "bcrypt";
import { z } from "zod";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";
import { firmarRegistros } from "@/lib/private/controlados";

const entrada = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  password: z.string().min(1, "Ingresa tu contraseña para firmar.").max(200),
});

/** Firma electrónica simple: exige reingresar la contraseña del firmante. */
export async function POST(request: Request) {
  const user = await currentPrivateUser();
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (!canOperate(user, "controlados_firmar"))
    return Response.json(
      { error: "Solo el Químico Farmacéutico puede firmar el libro." },
      { status: 403 },
    );
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  const cuenta = await prismaPrivada.usuario.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!cuenta || !(await bcrypt.compare(parsed.data.password, cuenta.password)))
    return Response.json(
      { error: "La contraseña no es correcta." },
      { status: 403 },
    );
  const firmados = await firmarRegistros(parsed.data.ids, user.id);
  return Response.json({ firmados });
}
