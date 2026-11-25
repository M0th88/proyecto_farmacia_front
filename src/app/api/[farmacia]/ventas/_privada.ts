import { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";
import { confirmSale } from "@/lib/private/fefo-sales";
import { saleSchema } from "@/lib/types/fefo";

export async function GET() {
  if (!(await currentPrivateUser()))
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  try {
    const ventas = await prismaPrivada.venta.findMany({
      take: 30,
      orderBy: { creadaEn: "desc" },
      include: {
        detalles: {
          include: {
            medicamento: { select: { nombre: true } },
            lote: { select: { numeroLote: true } },
          },
        },
      },
    });
    return Response.json(
      ventas.map((v) => ({
        id: v.id,
        creadaEn: v.creadaEn,
        estado: v.estado,
        tipoOperacion: v.tipoOperacion,
        usuarioId: v.usuarioId,
        sucursalId: v.sucursalId,
        metodoPago: v.metodoPago,
        total: Number(v.total),
        detalles: v.detalles.map((d) => ({
          id: d.id,
          stockId: d.stockId,
          ubicacionId: d.ubicacionId,
          nombre: d.nombreProducto ?? d.medicamento.nombre,
          lote: d.lote.numeroLote,
          cantidad: d.cantidad,
          precioUnitario: Number(d.precioUnitario),
          subtotal: Number(d.subtotal),
        })),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Historial privado:", error);
    return Response.json(
      { error: "No se pudo cargar el historial." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const user = await currentPrivateUser();
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (!canOperate(user, "pos"))
    return Response.json(
      { error: "Sin permiso de punto de venta." },
      { status: 403 },
    );
  const parsed = saleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Datos de venta inválidos." },
      { status: 400 },
    );
  try {
    const sale = await confirmSale(parsed.data, user).catch(
      (error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")
        ) {
          return confirmSale(parsed.data, user);
        }
        throw error;
      },
    );
    return Response.json(
      {
        id: sale.id,
        total: Number(sale.total),
        vuelto: sale.vuelto === null ? null : Number(sale.vuelto),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && !("code" in error))
      return Response.json({ error: error.message }, { status: 409 });
    return Response.json(
      {
        error: "No se pudo confirmar el registro. Reintenta el mismo cobro.",
      },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  const user = await currentPrivateUser();
  if (!user || !canOperate(user, "ventas_anular"))
    return Response.json(
      { error: "Sin permiso para anular ventas." },
      { status: 403 },
    );
  const parsed = z
    .object({
      id: z.number().int().positive(),
      motivo: z.string().trim().min(5).max(500),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Indica la venta y el motivo de anulación." },
      { status: 400 },
    );
  const result = await prismaPrivada.venta.updateMany({
    where: { id: parsed.data.id, estado: "CONFIRMADA" },
    data: {
      estado: "ANULADA",
      anuladaPor: user.id,
      anuladaEn: new Date(),
      motivoAnulacion: parsed.data.motivo,
    },
  });
  return result.count === 1
    ? Response.json({
        success: true,
        mensaje: "Venta anulada. No se reincorporaron unidades al inventario.",
      })
    : Response.json(
        { error: "La venta no existe o ya fue anulada." },
        { status: 409 },
      );
}
