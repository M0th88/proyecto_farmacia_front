import type { Pharmacy } from "@/lib/auth/pharmacies";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { getPharmacyUser } from "@/lib/auth/session";
import { addStock } from "@/lib/private/add-stock";
import { editStock } from "@/lib/private/edit-stock";
import {
  paginateStock,
  stockListSchema,
  stockSnapshot,
} from "@/lib/private/stock";
import { stockDate } from "@/lib/private/stock-dates";
import { stockEditSchema, stockEntrySchema } from "@/lib/types/stock-y-lotes";

async function inventoryUser(pharmacy: Pharmacy) {
  const user = await getPharmacyUser(pharmacy);
  return user &&
    (user.rol.nombre === "Administrador" ||
      user.rol.permisos.includes("inventario"))
    ? user
    : null;
}
const denied = () =>
  Response.json(
    { error: "Debes iniciar sesión con permiso de Stock y lotes." },
    { status: 403 },
  );

export const GET = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await inventoryUser(pharmacy))) return denied();
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("opciones") === "1") {
      const [products, ubicaciones] = await Promise.all([
        db.medicamento.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
          select: {
            id: true,
            nombre: true,
            codigoBarra: true,
            lotes: {
              select: {
                numeroLote: true,
                fechaFabricacion: true,
                fechaVencimiento: true,
              },
            },
          },
        }),
        db.ubicacionInventario.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, tipo: true },
        }),
      ]);
      return Response.json({
        productos: products.map((p) => ({
          ...p,
          lotes: p.lotes.map((l) => ({
            ...l,
            fechaFabricacion: l.fechaFabricacion
              ? stockDate(l.fechaFabricacion)
              : "",
            fechaVencimiento: stockDate(l.fechaVencimiento),
          })),
        })),
        ubicaciones,
      });
    }
    const options = stockListSchema.safeParse(Object.fromEntries(params));
    if (!options.success)
      return Response.json({ error: "Filtros inválidos." }, { status: 400 });
    const snapshot = await stockSnapshot(db);
    return Response.json({
      ...paginateStock(snapshot.rows, options.data),
      metrics: snapshot.metrics,
    });
  } catch {
    return Response.json(
      { error: "No se pudo cargar el inventario. Intenta nuevamente." },
      { status: 503 },
    );
  }
});

export const POST = pharmacyRoute(async (request, pharmacy, db) => {
  const user = await inventoryUser(pharmacy);
  if (!user) return denied();
  const parsed = stockEntrySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Datos de stock inválidos." },
      { status: 400 },
    );
  try {
    return Response.json(await addStock(parsed.data, user.id, db), {
      status: 201,
    });
  } catch (error) {
    const message =
      error instanceof Error && !("code" in error)
        ? error.message
        : "No se pudo registrar la entrada. El inventario pudo cambiar; actualiza e intenta nuevamente.";
    return Response.json({ error: message }, { status: 409 });
  }
});
export const PATCH = pharmacyRoute(async (request, pharmacy, db) => {
  const user = await inventoryUser(pharmacy);
  if (!user) return denied();
  const parsed = stockEditSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  try {
    return Response.json(await editStock(parsed.data, user.id, db));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !("code" in error)
            ? error.message
            : "No se pudo editar. Revisa el número de lote y actualiza el inventario.",
      },
      { status: 409 },
    );
  }
});
export const DELETE = pharmacyRoute(async () => {
  return Response.json(
    { error: "No se permite eliminar registros de stock y lotes." },
    { status: 405 },
  );
});
