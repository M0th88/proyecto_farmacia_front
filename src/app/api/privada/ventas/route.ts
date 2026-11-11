import { prismaPrivada } from "@/lib/db/prisma-privada";
import { Prisma } from "@/generated/privada/client";
import { z } from "zod";
import { currentPrivateUser } from "@/lib/private/auth";

const entrada = z.object({
  metodoPago: z.enum(["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"]),
  recibido: z.number().finite().nonnegative().optional(),
  items: z.array(z.object({ medicamentoId: z.number().int().positive(), cantidad: z.number().int().positive() })).min(1),
});

export async function GET() {
  if (!await currentPrivateUser()) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  try {
    const ventas = await prismaPrivada.venta.findMany({ take: 30, orderBy: { creadaEn: "desc" }, include: { detalles: { include: { medicamento: { select: { nombre: true } }, lote: { select: { numeroLote: true } } } } } });
    return Response.json(ventas.map(v => ({ id: v.id, creadaEn: v.creadaEn, metodoPago: v.metodoPago, total: Number(v.total), detalles: v.detalles.map(d => ({ nombre: d.medicamento.nombre, lote: d.lote.numeroLote, cantidad: d.cantidad, precioUnitario: Number(d.precioUnitario), subtotal: Number(d.subtotal) })) })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Historial privado:", error);
    return Response.json({ error: "No se pudo cargar el historial." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await currentPrivateUser()) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos de venta inválidos." }, { status: 400 });
  const { items, metodoPago, recibido } = parsed.data;
  if (new Set(items.map((i) => i.medicamentoId)).size !== items.length) return Response.json({ error: "Hay productos repetidos." }, { status: 400 });
  try {
    const venta = await prismaPrivada.$transaction(async (tx) => {
      const detalles: { medicamentoId: number; loteId: number; cantidad: number; precioUnitario: Prisma.Decimal; subtotal: Prisma.Decimal }[] = [];
      let total = new Prisma.Decimal(0);
      const ahora = new Date();
      for (const item of items) {
        const medicamento = await tx.medicamento.findUnique({ where: { id: item.medicamentoId }, include: { lotes: { where: { fechaVencimiento: { gt: ahora } }, orderBy: { fechaVencimiento: "asc" }, include: { stocks: { orderBy: { id: "asc" } } } } } });
        if (!medicamento?.activo || medicamento.precioVenta === null || medicamento.precioVenta.lte(0)) throw new Error("Producto sin precio válido o inactivo.");
        if (medicamento.condicionVenta !== "VENTA_DIRECTA") throw new Error(`${medicamento.nombre} requiere revisión de su condición de venta y, cuando corresponda, validación de receta. La venta no fue registrada.`);
        let pendiente = item.cantidad;
        for (const lote of medicamento.lotes) {
          for (const stock of lote.stocks) {
            if (pendiente === 0) break;
            const cantidad = Math.min(pendiente, stock.cantidad);
            if (cantidad <= 0) continue;
            const actualizado = await tx.stock.updateMany({ where: { id: stock.id, cantidad: { gte: cantidad } }, data: { cantidad: { decrement: cantidad } } });
            if (actualizado.count !== 1) throw new Error("El stock cambió. Actualiza el catálogo e intenta nuevamente.");
            const subtotal = medicamento.precioVenta.mul(cantidad);
            detalles.push({ medicamentoId: medicamento.id, loteId: lote.id, cantidad, precioUnitario: medicamento.precioVenta, subtotal });
            total = total.add(subtotal);
            pendiente -= cantidad;
          }
        }
        if (pendiente > 0) throw new Error(`Stock insuficiente para ${medicamento.nombre}.`);
      }
      if (metodoPago === "EFECTIVO" && (recibido === undefined || new Prisma.Decimal(recibido).lt(total))) throw new Error("El efectivo recibido no cubre el total.");
      const creada = await tx.venta.create({ data: { metodoPago, total, recibido: metodoPago === "EFECTIVO" ? recibido : null, vuelto: metodoPago === "EFECTIVO" ? new Prisma.Decimal(recibido!).sub(total) : null, detalles: { create: detalles } } });
      for (const detalle of detalles) await tx.movimientoStock.create({ data: { tipo: "SALIDA", cantidad: detalle.cantidad, loteId: detalle.loteId, motivo: `Venta #${creada.id}` } });
      return creada;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ id: venta.id, total: Number(venta.total), vuelto: venta.vuelto === null ? null : Number(venta.vuelto) }, { status: 201 });
  } catch (error) {
    console.error("Venta privada:", error);
    const mensaje = error instanceof Error && !error.message.startsWith("P") ? error.message : "No se pudo registrar la venta. Actualiza e intenta nuevamente.";
    return Response.json({ error: mensaje }, { status: 409 });
  }
}
