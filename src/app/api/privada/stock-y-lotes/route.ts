import { prismaPrivada } from "@/lib/db/prisma-privada";
import { currentPrivateUser } from "@/lib/private/auth";
import { editStock } from "@/lib/private/edit-stock";
import {
  paginateStock,
  stockListSchema,
  stockSnapshot,
} from "@/lib/private/stock";
import { stockDate } from "@/lib/private/stock-dates";
import { stockEditSchema } from "@/lib/types/stock-y-lotes";

async function inventoryUser() {
  const user = await currentPrivateUser();
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

export async function GET(request: Request) {
  if (!(await inventoryUser())) return denied();
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("opciones") === "1") {
      const [products, ubicaciones] = await Promise.all([
        prismaPrivada.medicamento.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
          select: {
            id: true,
            nombre: true,
            concentracion: true,
            formaFarmaceutica: true,
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
        prismaPrivada.ubicacionInventario.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, tipo: true, sucursalId: true },
        }),
      ]);
      return Response.json({
        productos: products.map((p) => ({
          ...p,
          nombre: [p.nombre, p.concentracion, p.formaFarmaceutica]
            .filter(Boolean)
            .join(" · "),
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
    const snapshot = await stockSnapshot();
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
}

export async function POST() {
  if (!(await inventoryUser())) return denied();
  return Response.json(
    {
      error:
        "Registra las recepciones mediante el formulario actualizado de Añadir stock.",
    },
    { status: 410 },
  );
}
export async function PATCH(request: Request) {
  const user = await inventoryUser();
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
    return Response.json(await editStock(parsed.data, user.id));
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
}
export async function DELETE() {
  return Response.json(
    { error: "No se permite eliminar registros de stock y lotes." },
    { status: 405 },
  );
}
