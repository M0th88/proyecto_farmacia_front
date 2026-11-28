import { recibirOrden } from "@/lib/private/abastecimiento";
import { recepcionSchema } from "@/lib/validation/abastecimiento";
import { ruta } from "../../../_gestion";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "Orden inválida." }, { status: 400 });
  return ruta("compras", recepcionSchema, async (input, user) =>
    Response.json(await recibirOrden(id, input, user.id)),
  )(request);
}
