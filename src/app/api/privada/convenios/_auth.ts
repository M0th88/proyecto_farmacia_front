import "server-only";
import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";

/** Usuario con permiso para administrar convenios, o la respuesta de error. */
export async function adminConvenios() {
  const user = await currentPrivateUser();
  if (!user)
    return {
      error: Response.json({ error: "Debes iniciar sesión." }, { status: 401 }),
    };
  if (!canOperate(user, "convenios"))
    return {
      error: Response.json(
        { error: "Tu rol no puede administrar convenios." },
        { status: 403 },
      ),
    };
  return { user };
}

export const primerError = (issues: { message: string }[]) =>
  Response.json(
    { error: issues[0]?.message ?? "Datos inválidos." },
    { status: 400 },
  );
