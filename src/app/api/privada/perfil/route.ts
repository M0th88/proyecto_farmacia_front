import bcrypt from "bcrypt";
import { getPrivateUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { serializeUser, userSelect } from "@/lib/private/users";
import { ownProfileSchema } from "@/lib/types/usuarios-y-roles";

export async function PATCH(request: Request) {
  const user = await getPrivateUser();
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const parsed = ownProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Revisa tus datos. No puedes modificar roles ni cuentas ajenas desde Configuración.",
      },
      { status: 400 },
    );
  const { password, ...profile } = parsed.data;
  try {
    const updated = await prismaPrivada.usuario.update({
      where: { id: user.id },
      select: userSelect,
      data: {
        ...profile,
        ...(profile.apellido !== undefined
          ? { apellido: profile.apellido || null }
          : {}),
        ...(profile.telefono !== undefined
          ? { telefono: profile.telefono || null }
          : {}),
        ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
      },
    });
    return Response.json(serializeUser(updated));
  } catch {
    return Response.json(
      {
        error:
          "No se pudieron guardar tus datos. Comprueba que el RUT y el correo no estén usados por otra cuenta.",
      },
      { status: 409 },
    );
  }
}
