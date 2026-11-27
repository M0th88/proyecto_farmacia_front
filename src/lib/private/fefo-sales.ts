import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { allocateFefo, aptStock, canOperate, sameAllocation } from "@/lib/fefo";
import { registrarSalidasControladas } from "@/lib/private/controlados";
import { stockDate } from "@/lib/private/stock-dates";
import {
  type FefoPlan,
  type PreparedLot,
  preparationSchema,
  saleSchema,
} from "@/lib/types/fefo";
import {
  calcularTotales,
  facturacionSchema,
  montoPos,
} from "@/lib/validation/punto-de-venta";
import {
  hoyChile,
  problemaReceta,
  recetaExigida,
  recetaRequerida,
} from "@/lib/validation/recetas";

type User = { id: number; rol: { nombre: string; permisos: string[] } };
type Tx = Prisma.TransactionClient;
async function plan(
  tx: Tx,
  input: z.infer<typeof preparationSchema>,
  user: User,
): Promise<FefoPlan> {
  if (
    new Set(input.items.map((item) => item.medicamentoId)).size !==
    input.items.length
  )
    throw new Error("Hay productos repetidos.");
  const branch = await tx.sucursal.findUnique({
    where: { id: input.sucursalId },
  });
  if (!branch) throw new Error("Selecciona una sucursal válida.");
  const candidates: PreparedLot[] = [];
  const condiciones: string[] = [];
  let total = new Prisma.Decimal(0);
  for (const item of input.items) {
    const product = await tx.medicamento.findUnique({
      where: { id: item.medicamentoId },
    });
    if (!product?.activo || !product.precioVenta || product.precioVenta.lte(0))
      throw new Error(
        `Producto #${item.medicamentoId} inactivo o sin precio válido.`,
      );
    if (
      product.condicionVenta !== "VENTA_DIRECTA" &&
      !recetaExigida(product.condicionVenta)
    )
      throw new Error(
        `${product.nombre}: falta clasificar su condición de venta antes de venderlo.`,
      );
    condiciones.push(product.condicionVenta);
    total = total.add(product.precioVenta.mul(item.cantidad));
    const stocks = await tx.stock.findMany({
      where: {
        lote: { medicamentoId: product.id },
        ubicacion: { sucursalId: branch.id },
      },
      include: { lote: true, ubicacion: true },
    });
    for (const stock of stocks.filter((row) => aptStock(row)))
      candidates.push({
        stockId: stock.id,
        loteId: stock.loteId,
        medicamentoId: product.id,
        producto: `${product.nombre}${product.concentracion ? ` · ${product.concentracion}` : ""}${product.formaFarmaceutica ? ` · ${product.formaFarmaceutica}` : ""}`,
        numeroLote: stock.lote.numeroLote,
        rotulo: stock.lote.rotuloVencimiento!,
        vencimiento: stock.lote.fechaVencimiento.toISOString(),
        recepcion: stock.fechaRecepcion!.toISOString(),
        ubicacion: stock.ubicacion.nombre,
        disponible: stock.cantidad - stock.cantidadBloqueada,
        cantidad: 0,
      });
  }
  const allocation = allocateFefo(candidates, input.items);
  return {
    sugeridos: allocation.suggested,
    aptos: allocation.sorted,
    faltantes: allocation.missing,
    total: Number(total),
    permiteExcepcion:
      branch.permiteExcepcion &&
      !!branch.procedimiento &&
      canOperate(user, "fefo_excepcion"),
    recetaRequerida: recetaRequerida(condiciones),
  };
}
export async function prepareSale(
  input: z.infer<typeof preparationSchema>,
  user: User,
) {
  return prismaPrivada.$transaction((tx) => plan(tx, input, user), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}
export async function confirmSale(
  input: z.infer<typeof saleSchema>,
  user: User,
) {
  return prismaPrivada.$transaction(
    async (tx) => {
      const repeated = await tx.venta.findUnique({
        where: { claveOperacion: input.claveOperacion },
        include: { detalles: true },
      });
      if (repeated) {
        if (
          repeated.usuarioId !== user.id ||
          repeated.sucursalId !== input.sucursalId ||
          repeated.tipoOperacion !== input.tipoOperacion ||
          repeated.metodoPago !== input.metodoPago ||
          !repeated.total.eq(input.totalEsperado) ||
          !repeated.descuento.eq(input.descuento) ||
          repeated.tipoDocumento !== (input.documento?.tipo ?? null) ||
          (input.documento?.tipo === "FACTURA" &&
            JSON.stringify(
              facturacionSchema.safeParse(repeated.datosFacturacion).data,
            ) !== JSON.stringify(input.documento.facturacion)) ||
          (input.metodoPago === "EFECTIVO" &&
            (input.recibido === undefined ||
              !repeated.recibido?.eq(input.recibido))) ||
          !sameAllocation(
            input.lotes,
            repeated.detalles.map((detail) => ({
              stockId: detail.stockId!,
              cantidad: detail.cantidad,
            })),
          )
        )
          throw new Error("La operación ya fue utilizada.");
        return repeated;
      }
      const current = await plan(tx, input, user);
      if (!montoPos.safeParse(current.total).success)
        throw new Error("El subtotal supera el importe permitido.");
      if (input.descuento > current.total)
        throw new Error("El descuento supera el subtotal.");
      const { total, neto, iva } = calcularTotales(
        current.total,
        input.descuento,
      );
      if (total !== input.totalEsperado)
        throw new Error(
          "El precio cambió. Actualiza la preparación y verifica nuevamente el total a cobrar.",
        );
      if (current.faltantes.length)
        throw new Error(
          `Stock apto insuficiente: ${current.faltantes.map((row) => `${row.nombre}, faltan ${row.cantidad}`).join("; ")}.`,
        );
      if (
        new Set(input.lotes.map((lot) => lot.stockId)).size !==
        input.lotes.length
      )
        throw new Error("La confirmación contiene existencias repetidas.");
      for (const item of input.items)
        if (
          input.lotes
            .filter((row) => row.medicamentoId === item.medicamentoId)
            .reduce((sum, row) => sum + row.cantidad, 0) !== item.cantidad
        )
          throw new Error(
            "Las cantidades de los lotes no coinciden con el pedido.",
          );
      if (
        input.lotes.some(
          (row) =>
            !input.items.some(
              (item) => item.medicamentoId === row.medicamentoId,
            ),
        )
      )
        throw new Error("Hay lotes ajenos al pedido.");
      const exception = !sameAllocation(input.lotes, current.sugeridos);
      const errorReceta = problemaReceta(
        input.receta,
        current.recetaRequerida,
        hoyChile(),
      );
      if (errorReceta) throw new Error(errorReceta);
      const receta =
        current.recetaRequerida && input.receta ? input.receta : null;
      if (receta && receta.tipo !== "SIMPLE") {
        const usada = await tx.receta.findFirst({
          where: { tipo: receta.tipo, folio: receta.folio },
          select: { ventaId: true },
        });
        if (usada)
          throw new Error(
            `La receta folio ${receta.folio} ya fue retenida${usada.ventaId ? ` en la venta #${usada.ventaId}` : ""}.`,
          );
      }
      const recetaGuardada = receta
        ? await tx.receta.create({
            data: {
              ...receta,
              folio: receta.folio || null,
              observaciones: receta.observaciones || null,
              fechaEmision: new Date(`${receta.fechaEmision}T00:00:00Z`),
              vigenteHasta: new Date(`${receta.vigenteHasta}T00:00:00Z`),
              registradaPor: user.id,
            },
          })
        : null;
      if (
        exception &&
        (!current.permiteExcepcion || !input.motivoExcepcion.trim())
      )
        throw new Error(
          "El orden FEFO cambió. Actualiza la preparación; una excepción exige permiso, procedimiento local y motivo.",
        );
      const details: Prisma.DetalleVentaUncheckedCreateWithoutVentaInput[] = [];
      for (const chosen of input.lotes) {
        const candidate = current.aptos.find(
          (row) =>
            row.stockId === chosen.stockId &&
            row.medicamentoId === chosen.medicamentoId,
        );
        if (!candidate || candidate.disponible < chosen.cantidad)
          throw new Error(
            "El lote elegido no es apto o no tiene saldo suficiente.",
          );
        const product = await tx.medicamento.findUniqueOrThrow({
          where: { id: chosen.medicamentoId },
        });
        const stock = await tx.stock.findUniqueOrThrow({
          where: { id: candidate.stockId },
          include: { lote: true },
        });
        if (!aptStock(stock))
          throw new Error(
            "El lote dejó de ser apto. Prepara la venta nuevamente.",
          );
        const updated = await tx.stock.updateMany({
          where: {
            id: candidate.stockId,
            cantidad: { gte: chosen.cantidad + stock.cantidadBloqueada },
            cantidadBloqueada: stock.cantidadBloqueada,
            lote: { estado: "APTO", fechaVencimiento: { gt: new Date() } },
            ubicacion: { sucursalId: input.sucursalId },
          },
          data: { cantidad: { decrement: chosen.cantidad } },
        });
        if (updated.count !== 1)
          throw new Error(
            "Otra caja modificó el saldo. Prepara la venta nuevamente.",
          );
        const subtotal = product.precioVenta!.mul(chosen.cantidad);
        details.push({
          recetaId:
            recetaGuardada && recetaExigida(product.condicionVenta)
              ? recetaGuardada.id
              : null,
          medicamentoId: product.id,
          nombreProducto: product.nombre,
          loteId: stock.loteId,
          stockId: stock.id,
          ubicacionId: stock.ubicacionId,
          cantidad: chosen.cantidad,
          precioUnitario: product.precioVenta!,
          subtotal,
        });
      }
      if (
        input.metodoPago === "EFECTIVO" &&
        (input.recibido === undefined ||
          new Prisma.Decimal(input.recibido).lt(total))
      )
        throw new Error("El efectivo recibido no cubre el total.");
      const sale = await tx.venta.create({
        data: {
          sucursalId: input.sucursalId,
          usuarioId: user.id,
          tipoOperacion: input.tipoOperacion,
          claveOperacion: input.claveOperacion,
          motivoExcepcion: exception ? input.motivoExcepcion : null,
          metodoPago: input.metodoPago,
          subtotal: current.total,
          descuento: input.descuento,
          total,
          neto,
          iva,
          tipoDocumento: input.documento?.tipo,
          datosFacturacion:
            input.documento?.tipo === "FACTURA"
              ? input.documento.facturacion
              : undefined,
          recibido: input.metodoPago === "EFECTIVO" ? input.recibido : null,
          vuelto:
            input.metodoPago === "EFECTIVO"
              ? new Prisma.Decimal(input.recibido!).sub(total)
              : null,
          detalles: { create: details },
        },
      });
      for (const detail of details)
        await tx.movimientoStock.create({
          data: {
            tipo: "SALIDA",
            cantidad: detail.cantidad,
            loteId: detail.loteId,
            ubicacionId: detail.ubicacionId,
            usuarioId: user.id,
            ventaId: sale.id,
            origen: input.tipoOperacion,
            motivo: `Salida FEFO${exception ? ` · Excepción: ${input.motivoExcepcion}` : ""} · ${stockDate(new Date())}`,
          },
        });
      if (recetaGuardada)
        await tx.receta.update({
          where: { id: recetaGuardada.id },
          data: { ventaId: sale.id },
        });
      await registrarSalidasControladas(
        tx,
        {
          id: sale.id,
          usuarioId: user.id,
          recetaId: recetaGuardada?.id ?? null,
        },
        details,
      );
      return sale;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
