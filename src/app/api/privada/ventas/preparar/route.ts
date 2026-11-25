import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";
import { prepareSale } from "@/lib/private/fefo-sales";
import { preparationSchema } from "@/lib/types/fefo";
export async function POST(request: Request) {
  const user = await currentPrivateUser();
  if (!user || !canOperate(user, "pos"))
    return Response.json(
      { error: "Sin permiso de punto de venta." },
      { status: 403 },
    );
  const parsed = preparationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Selecciona sucursal y cantidades válidas." },
      { status: 400 },
    );
  try {
    return Response.json(await prepareSale(parsed.data, user));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !("code" in error)
            ? error.message
            : "No se pudo preparar la venta.",
      },
      { status: 409 },
    );
  }
}
