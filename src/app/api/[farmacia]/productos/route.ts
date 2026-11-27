import { z } from "zod";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { getPharmacyUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/private/permissions";
import {
  assignProductBarcode,
  createProduct,
  deleteProduct,
  paginateProducts,
  productDetail,
  productLabel,
  productListSchema,
  productSnapshot,
} from "@/lib/private/products";
import { productProfileSchema } from "@/lib/types/productos";

async function catalogUser(pharmacy: Pharmacy) {
  const user = await getPharmacyUser(pharmacy);
  return user && roleHasPermission(user.rol, "catalogo") ? user : null;
}
const denied = () =>
  Response.json(
    { error: "Debes iniciar sesión con permiso de Productos." },
    { status: 403 },
  );
export const GET = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await catalogUser(pharmacy))) return denied();
  const params = new URL(request.url).searchParams;
  try {
    if (params.has("id")) {
      const id = z.coerce.number().int().positive().safeParse(params.get("id"));
      if (!id.success)
        return Response.json({ error: "Producto inválido." }, { status: 400 });
      const product =
        params.get("etiqueta") === "1"
          ? await productLabel(id.data, db)
          : await productDetail(id.data, db);
      return product
        ? Response.json(product)
        : Response.json(
            { error: "El producto ya no existe." },
            { status: 404 },
          );
    }
    if (params.get("opciones") === "1")
      return Response.json({
        categorias: await db.categoriaMedicamento.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
      });
    const options = productListSchema.safeParse(Object.fromEntries(params));
    if (!options.success)
      return Response.json({ error: "Filtros inválidos." }, { status: 400 });
    const snapshot = await productSnapshot(db);
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
});
export const PATCH = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await catalogUser(pharmacy))) return denied();
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
    return Response.json(await createProduct(parsed.data, id.data.id, db));
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
});
export const DELETE = pharmacyRoute(async (request, pharmacy, db) => {
  const user = await getPharmacyUser(pharmacy);
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
    await deleteProduct(parsed.data.id, db);
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
});
export const POST = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await catalogUser(pharmacy))) return denied();
  const params = new URL(request.url).searchParams;
  if (params.get("etiqueta") === "1") {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return Response.json(
        { error: "Formato de solicitud inválido." },
        { status: 415 },
      );
    const id = z
      .object({ id: z.number().int().positive().max(2_147_483_647) })
      .safeParse(await request.json().catch(() => null));
    if (!id.success)
      return Response.json({ error: "Producto inválido." }, { status: 400 });
    try {
      const product = await assignProductBarcode(id.data.id, db);
      return product
        ? Response.json(product)
        : Response.json(
            { error: "El producto ya no existe." },
            { status: 404 },
          );
    } catch {
      return Response.json(
        { error: "No se pudo generar el código. Intenta nuevamente." },
        { status: 503 },
      );
    }
  }
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
    return Response.json(await createProduct(parsed.data, undefined, db), {
      status: 201,
    });
  } catch (error) {
    const message =
      error instanceof Error && !("code" in error)
        ? error.message
        : "No se pudo añadir el producto. Comprueba que sus códigos de barras y catálogo sean únicos.";
    return Response.json({ error: message }, { status: 409 });
  }
});
