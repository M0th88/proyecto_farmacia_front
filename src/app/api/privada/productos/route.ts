import { z } from "zod";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { currentPrivateUser } from "@/lib/private/auth";
import {
  createProduct,
  deleteProduct,
  paginateProducts,
  productDetail,
  productListSchema,
  productSnapshot,
} from "@/lib/private/products";
import { productProfileSchema } from "@/lib/types/productos";

async function catalogUser() {
  const user = await currentPrivateUser();
  return user &&
    (user.rol.nombre === "Administrador" ||
      user.rol.permisos.includes("catalogo"))
    ? user
    : null;
}
const denied = () =>
  Response.json(
    { error: "Debes iniciar sesión con permiso de Productos." },
    { status: 403 },
  );
export async function GET(request: Request) {
  if (!(await catalogUser())) return denied();
  const params = new URL(request.url).searchParams;
  try {
    if (params.has("id")) {
      const id = z.coerce.number().int().positive().safeParse(params.get("id"));
      if (!id.success)
        return Response.json({ error: "Producto inválido." }, { status: 400 });
      const product = await productDetail(id.data);
      return product
        ? Response.json(product)
        : Response.json(
            { error: "El producto ya no existe." },
            { status: 404 },
          );
    }
    if (params.get("opciones") === "1")
      return Response.json({
        categorias: await prismaPrivada.categoriaMedicamento.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
      });
    const options = productListSchema.safeParse(Object.fromEntries(params));
    if (!options.success)
      return Response.json({ error: "Filtros inválidos." }, { status: 400 });
    const snapshot = await productSnapshot();
    return Response.json({
      ...paginateProducts(snapshot.rows, options.data),
      metrics: snapshot.metrics,
    });
  } catch {
    return Response.json(
      { error: "No se pudieron cargar los productos. Intenta nuevamente." },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  if (!(await catalogUser())) return denied();
  const body = await request.json().catch(() => null);
  const parsed = productProfileSchema.safeParse(body);
  const id = z.object({ id: z.number().int().positive() }).safeParse(body);
  if (!parsed.success || !id.success)
    return Response.json(
      {
        error: !parsed.success
          ? parsed.error.issues[0]?.message
          : "Producto inválido.",
      },
      { status: 400 },
    );
  try {
    return Response.json(await createProduct(parsed.data, id.data.id));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !("code" in error)
            ? error.message
            : "No se pudo actualizar el producto. Revisa los códigos únicos e intenta nuevamente.",
      },
      { status: 409 },
    );
  }
}
export async function DELETE(request: Request) {
  const user = await currentPrivateUser();
  if (user?.rol.nombre !== "Administrador")
    return Response.json(
      { error: "Solo el administrador puede eliminar productos." },
      { status: 403 },
    );
  const parsed = z
    .object({ id: z.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Producto inválido." }, { status: 400 });
  try {
    await deleteProduct(parsed.data.id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !("code" in error)
            ? error.message
            : "No se pudo eliminar el producto. Comprueba que no esté en uso.",
      },
      { status: 409 },
    );
  }
}
export async function POST(request: Request) {
  if (!(await catalogUser())) return denied();
  const parsed = productProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Datos de producto inválidos.",
      },
      { status: 400 },
    );
  try {
    return Response.json(await createProduct(parsed.data), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && !("code" in error)
        ? error.message
        : "No se pudo añadir el producto. Comprueba que sus códigos de barras y catálogo sean únicos.";
    return Response.json({ error: message }, { status: 409 });
  }
}
