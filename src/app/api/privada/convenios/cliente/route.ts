import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";
import { convenioDeCliente } from "@/lib/private/convenios";
import { rutConvenio } from "@/lib/validation/convenios";

/** Consulta del POS: convenio activo de un RUT. */
export async function GET(request: Request) {
  const user = await currentPrivateUser();
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (!canOperate(user, "pos"))
    return Response.json(
      { error: "Sin permiso de punto de venta." },
      { status: 403 },
    );
  const rut = rutConvenio.safeParse(
    new URL(request.url).searchParams.get("rut") ?? "",
  );
  if (!rut.success)
    return Response.json(
      { error: rut.error.issues[0]?.message ?? "RUT inválido." },
      { status: 400 },
    );
  const cliente = await convenioDeCliente(rut.data);
  return cliente
    ? Response.json(cliente, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        { error: "Este RUT no tiene un convenio activo." },
        { status: 404 },
      );
}
