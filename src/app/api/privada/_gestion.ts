import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { canOperate } from "@/lib/fefo";
import { AbastecimientoError } from "@/lib/private/abastecimiento";
import { currentPrivateUser } from "@/lib/private/auth";

type Usuario = NonNullable<Awaited<ReturnType<typeof currentPrivateUser>>>;

/**
 * Envuelve un handler de Farmacia Privada: sesión, permiso, validación del
 * cuerpo con zod y traducción de errores conocidos a respuestas 4xx.
 */
export function ruta<S extends z.ZodType>(
  permiso: string,
  schema: S,
  handler: (
    data: z.infer<S>,
    user: Usuario,
    request: Request,
  ) => Promise<Response>,
) {
  return async (request: Request) => {
    const user = await currentPrivateUser();
    if (!user)
      return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
    if (!canOperate(user, permiso))
      return Response.json(
        { error: "Tu rol no tiene permiso para esta acción." },
        { status: 403 },
      );
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    try {
      return await handler(parsed.data, user, request);
    } catch (e) {
      if (e instanceof AbastecimientoError)
        return Response.json({ error: e.message }, { status: 409 });
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002")
          return Response.json(
            { error: "Ya existe un registro con esos datos." },
            { status: 409 },
          );
        if (e.code === "P2025")
          return Response.json(
            { error: "El registro no existe." },
            { status: 404 },
          );
        if (e.code === "P2034")
          return Response.json(
            { error: "Otro usuario modificó los datos. Intenta nuevamente." },
            { status: 409 },
          );
      }
      if (
        e instanceof Error &&
        /recepción|lote|ubicación|vencid/i.test(e.message)
      )
        return Response.json({ error: e.message }, { status: 409 });
      console.error(`API privada (${permiso}):`, e);
      return Response.json(
        { error: "No se pudo completar la acción." },
        { status: 500 },
      );
    }
  };
}
