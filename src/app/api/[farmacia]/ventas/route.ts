import { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { getPharmacyUser } from "@/lib/auth/session";
import {
  calcularTotales,
  facturacionSchema,
  montoPos,
} from "@/lib/validation/punto-de-venta";
import * as privada from "./_privada";

class VentaRechazada extends Error {}

const documento = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("BOLETA") }),
  z.object({ tipo: z.literal("FACTURA"), facturacion: facturacionSchema }),
]);

const entrada = z.object({
  metodoPago: z.enum(["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"]),
  recibido: montoPos.optional(),
  descuento: montoPos.default(0),
  totalEsperado: montoPos.optional(),
  cobroId: z.uuid().optional(),
  documento: documento.optional(),
  items: z
    .array(
      z.object({
        medicamentoId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(2_147_483_647),
      }),
    )
    .min(1),
});

export const GET = pharmacyRoute(async (_request, pharmacy, db) => {
  if (pharmacy === "privada") return privada.GET();
  if (!(await getPharmacyUser(pharmacy)))
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  try {
    const ventas = await db.venta.findMany({
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
        metodoPago: v.metodoPago,
        total: Number(v.total),
        detalles: v.detalles.map((d) => ({
          nombre: d.medicamento.nombre,
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
});

export const POST = pharmacyRoute(async (request, pharmacy, db) => {
  if (pharmacy === "privada") return privada.POST(request);
  if (!(await getPharmacyUser(pharmacy)))
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.path[0] === "documento"
            ? "Revisa los datos de facturación."
            : "Datos de venta inválidos.",
      },
      { status: 400 },
    );
  const {
    items,
    metodoPago,
    recibido,
    descuento,
    totalEsperado,
    cobroId,
    documento,
  } = parsed.data;
  if (new Set(items.map((i) => i.medicamentoId)).size !== items.length)
    return Response.json(
      { error: "Hay productos repetidos." },
      { status: 400 },
    );
  try {
    const venta = await db.$transaction(
      async (tx) => {
        if (cobroId) {
          const previa = await tx.venta.findUnique({
            where: { claveOperacion: cobroId },
          });
          if (previa) return previa;
        }
        const detalles: {
          medicamentoId: number;
          nombreProducto: string;
          loteId: number;
          cantidad: number;
          precioUnitario: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }[] = [];
        let subtotalVenta = new Prisma.Decimal(0);
        const ahora = new Date();
        for (const item of items) {
          const medicamento = await tx.medicamento.findUnique({
            where: { id: item.medicamentoId },
            include: {
              lotes: {
                where: { fechaVencimiento: { gt: ahora } },
                orderBy: { fechaVencimiento: "asc" },
                include: { stocks: { orderBy: { id: "asc" } } },
              },
            },
          });
          if (
            !medicamento?.activo ||
            medicamento.precioVenta === null ||
            medicamento.precioVenta.lte(0)
          )
            throw new VentaRechazada("Producto sin precio válido o inactivo.");
          if (medicamento.condicionVenta !== "VENTA_DIRECTA")
            throw new VentaRechazada(
              `${medicamento.nombre} requiere revisión de su condición de venta y, cuando corresponda, validación de receta. La venta no fue registrada.`,
            );
          let pendiente = item.cantidad;
          for (const lote of medicamento.lotes) {
            for (const stock of lote.stocks) {
              if (pendiente === 0) break;
              const cantidad = Math.min(
                pendiente,
                stock.cantidad - stock.cantidadBloqueada,
              );
              if (cantidad <= 0) continue;
              const actualizado = await tx.stock.updateMany({
                where: {
                  id: stock.id,
                  cantidad: { gte: cantidad + stock.cantidadBloqueada },
                  cantidadBloqueada: stock.cantidadBloqueada,
                  lote: { fechaVencimiento: { gt: new Date() } },
                },
                data: { cantidad: { decrement: cantidad } },
              });
              if (actualizado.count !== 1)
                throw new VentaRechazada(
                  "El stock cambió. Actualiza el catálogo e intenta nuevamente.",
                );
              const subtotal = medicamento.precioVenta.mul(cantidad);
              detalles.push({
                medicamentoId: medicamento.id,
                nombreProducto: medicamento.nombre,
                loteId: lote.id,
                cantidad,
                precioUnitario: medicamento.precioVenta,
                subtotal,
              });
              subtotalVenta = subtotalVenta.add(subtotal);
              pendiente -= cantidad;
            }
          }
          if (pendiente > 0)
            throw new VentaRechazada(
              `Stock insuficiente para ${medicamento.nombre}.`,
            );
        }
        if (subtotalVenta.gt(9_999_999_999.99))
          throw new VentaRechazada("El subtotal supera el importe permitido.");
        if (subtotalVenta.lt(descuento))
          throw new VentaRechazada("El descuento supera el subtotal.");
        const { total, neto, iva } = calcularTotales(
          Number(subtotalVenta),
          descuento,
        );
        if (totalEsperado !== undefined && totalEsperado !== total)
          throw new VentaRechazada(
            "El total cambió. Actualiza el catálogo y revisa el cobro.",
          );
        if (
          metodoPago === "EFECTIVO" &&
          (recibido === undefined || new Prisma.Decimal(recibido).lt(total))
        )
          throw new VentaRechazada("El efectivo recibido no cubre el total.");
        const creada = await tx.venta.create({
          data: {
            metodoPago,
            total,
            claveOperacion: cobroId,
            subtotal: subtotalVenta,
            descuento,
            neto,
            iva,
            tipoDocumento: documento?.tipo,
            datosFacturacion:
              documento?.tipo === "FACTURA" ? documento.facturacion : undefined,
            recibido: metodoPago === "EFECTIVO" ? recibido : null,
            vuelto:
              metodoPago === "EFECTIVO"
                ? new Prisma.Decimal(recibido ?? 0).sub(total)
                : null,
            detalles: { create: detalles },
          },
        });
        for (const detalle of detalles)
          await tx.movimientoStock.create({
            data: {
              tipo: "SALIDA",
              cantidad: detalle.cantidad,
              loteId: detalle.loteId,
              motivo: `Venta #${creada.id}`,
            },
          });
        return creada;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return respuestaVenta(venta);
  } catch (error) {
    if (error instanceof VentaRechazada)
      return Response.json({ error: error.message }, { status: 409 });
    if (cobroId) {
      const previa = await db.venta
        .findUnique({ where: { claveOperacion: cobroId } })
        .catch(() => null);
      if (previa) return respuestaVenta(previa);
    }
    console.error(
      "Venta privada:",
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : error instanceof Error
          ? error.name
          : "Error desconocido",
    );
    return Response.json(
      {
        error:
          "No se pudo confirmar el registro de la venta. Reintenta el mismo cobro.",
      },
      { status: 503 },
    );
  }
});

function respuestaVenta(venta: {
  id: number;
  total: Prisma.Decimal;
  vuelto: Prisma.Decimal | null;
}) {
  return Response.json(
    {
      id: venta.id,
      total: Number(venta.total),
      vuelto: venta.vuelto === null ? null : Number(venta.vuelto),
    },
    { status: 201 },
  );
}

export const PATCH = pharmacyRoute(async (request, pharmacy) =>
  pharmacy === "privada"
    ? privada.PATCH(request)
    : new Response(null, { status: 405 }),
);
