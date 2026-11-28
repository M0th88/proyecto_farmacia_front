import "server-only";
import { getAsistencialUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";

/** Usuario asistencial con el permiso pedido, o la respuesta de error. */
export async function usuarioAsistencial(permiso: string) {
  const user = await getAsistencialUser();
  if (!user)
    return {
      error: Response.json({ error: "Debes iniciar sesión." }, { status: 401 }),
    };
  if (!canOperate(user, permiso))
    return {
      error: Response.json(
        { error: "Tu rol no tiene permiso para esta acción." },
        { status: 403 },
      ),
    };
  return { user };
}

export const datosInvalidos = (issues: { message: string }[]) =>
  Response.json(
    { error: issues[0]?.message ?? "Datos inválidos." },
    { status: 400 },
  );
