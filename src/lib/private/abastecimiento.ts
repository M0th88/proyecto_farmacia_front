import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { receiveFefoTx } from "@/lib/private/fefo-inventory";
import {
  type alertaRetiroSchema,
  type cierreCajaSchema,
  type devolucionSchema,
  efectivoEsperado,
  type movimientoCajaSchema,
  type recepcionSchema,
} from "@/lib/validation/abastecimiento";

export class AbastecimientoError extends Error {}
const serializable = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};
const n = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);

// ---------------------------------------------------------------- Compras

/** Recibe una orden enviada: lo aceptado entra al stock FEFO; lo rechazado queda registrado. */
export async function recibirOrden(
  ordenId: number,
  input: z.infer<typeof recepcionSchema>,
  usuarioId: number,
) {
  return db.$transaction(async (tx) => {
    const orden = await tx.ordenCompra.findUnique({
      where: { id: ordenId },
      include: { items: true },
    });
    if (!orden) throw new AbastecimientoError("La orden no existe.");
    if (orden.estado !== "ENVIADA" && orden.estado !== "RECIBIDA_PARCIAL")
      throw new AbastecimientoError(
        "Solo se reciben órdenes enviadas o recibidas en parte.",
      );
    const fechaRecepcion = new Date().toISOString();
    let pendientesRevision = 0;
    for (const linea of input.lineas) {
      const item = orden.items.find((i) => i.id === linea.itemId);
      if (!item)
        throw new AbastecimientoError("Hay una línea ajena a la orden.");
      const pendiente = item.cantidad - item.recibida - item.rechazada;
      if (linea.aceptada + linea.rechazada > pendiente)
        throw new AbastecimientoError(
          `Una línea supera lo pendiente de la orden (quedan ${pendiente} unidades).`,
        );
      if (linea.aceptada > 0) {
        const r = await receiveFefoTx(
          tx,
          {
            medicamentoId: item.medicamentoId,
            ubicacionId: input.ubicacionId,
            cantidad: linea.aceptada,
            numeroLote: linea.numeroLote,
            rotuloVencimiento: linea.vencimiento,
            precisionVencimiento: "DIA",
            fechaFabricacion: "",
            fechaRecepcion,
            verificado: true,
            motivo: `Orden de compra #${orden.id}`,
          },
          usuarioId,
        );
        if (r.pendiente) pendientesRevision++;
      }
      if (linea.rechazada > 0)
        await tx.productoRechazado.create({
          data: {
            ordenId: orden.id,
            proveedorId: orden.proveedorId,
            medicamentoId: item.medicamentoId,
            numeroLote: linea.numeroLote || null,
            cantidad: linea.rechazada,
            motivo: linea.motivoRechazo ?? "OTRO",
            detalle: linea.detalle || null,
            usuarioId,
          },
        });
      await tx.ordenCompraItem.update({
        where: { id: item.id },
        data: {
          recibida: { increment: linea.aceptada },
          rechazada: { increment: linea.rechazada },
        },
      });
    }
    const items = await tx.ordenCompraItem.findMany({
      where: { ordenId: orden.id },
    });
    const completa = items.every((i) => i.recibida + i.rechazada >= i.cantidad);
    await tx.ordenCompra.update({
      where: { id: orden.id },
      data: {
        estado: completa ? "RECIBIDA" : "RECIBIDA_PARCIAL",
        recibidaEn: completa ? new Date() : null,
      },
    });
    return { completa, pendientesRevision };
  }, serializable);
}

// ----------------------------------------------------------- Devoluciones

/** Emite una devolución: descuenta el stock elegido y marca los rechazos como devueltos. */
export async function crearDevolucion(
  input: z.infer<typeof devolucionSchema>,
  usuarioId: number,
) {
  return db.$transaction(async (tx) => {
    const rechazos = await tx.productoRechazado.findMany({
      where: { id: { in: input.rechazoIds } },
    });
    if (rechazos.length !== input.rechazoIds.length)
      throw new AbastecimientoError("Algún rechazo seleccionado no existe.");
    if (
      rechazos.some(
        (r) => r.estado !== "PENDIENTE" || r.proveedorId !== input.proveedorId,
      )
    )
      throw new AbastecimientoError(
        "Solo se devuelven rechazos pendientes del mismo proveedor.",
      );
    const devolucion = await tx.devolucionProveedor.create({
      data: {
        proveedorId: input.proveedorId,
        motivo: input.motivo,
        guia: input.guia || null,
        observaciones: input.observaciones || null,
        usuarioId,
      },
    });
    for (const r of rechazos)
      await tx.devolucionItem.create({
        data: {
          devolucionId: devolucion.id,
          medicamentoId: r.medicamentoId,
          cantidad: r.cantidad,
        },
      });
    await tx.productoRechazado.updateMany({
      where: { id: { in: input.rechazoIds } },
      data: { estado: "DEVUELTO", devolucionId: devolucion.id },
    });
    for (const item of input.items) {
      const stock = await tx.stock.findUnique({
        where: { id: item.stockId },
        include: { lote: true },
      });
      if (!stock || stock.cantidad < item.cantidad)
        throw new AbastecimientoError(
          "No hay unidades suficientes en una de las existencias elegidas.",
        );
      const restante = stock.cantidad - item.cantidad;
      const r = await tx.stock.updateMany({
        where: { id: stock.id, cantidad: stock.cantidad },
        data: {
          cantidad: restante,
          cantidadBloqueada: Math.min(stock.cantidadBloqueada, restante),
        },
      });
      if (r.count !== 1)
        throw new AbastecimientoError(
          "Otro usuario modificó el stock. Intenta nuevamente.",
        );
      await tx.devolucionItem.create({
        data: {
          devolucionId: devolucion.id,
          medicamentoId: stock.lote.medicamentoId,
          loteId: stock.loteId,
          stockId: stock.id,
          cantidad: item.cantidad,
        },
      });
      await tx.movimientoStock.create({
        data: {
          tipo: "SALIDA",
          cantidad: item.cantidad,
          loteId: stock.loteId,
          ubicacionId: stock.ubicacionId,
          usuarioId,
          origen: "DEVOLUCION_PROVEEDOR",
          motivo: `Devolución a proveedor #${devolucion.id}`,
        },
      });
    }
    return devolucion;
  }, serializable);
}

/** Existencias que conviene devolver: vencidas o de lotes retirados del mercado. */
export async function existenciasDevolvibles() {
  const filas = await db.stock.findMany({
    where: {
      cantidad: { gt: 0 },
      OR: [
        { lote: { fechaVencimiento: { lt: new Date() } } },
        { lote: { estado: "RETIRADO_ALERTA" } },
      ],
    },
    include: {
      lote: { include: { medicamento: { select: { nombre: true } } } },
      ubicacion: { select: { nombre: true } },
    },
    orderBy: { lote: { fechaVencimiento: "asc" } },
  });
  return filas.map((s) => ({
    stockId: s.id,
    producto: s.lote.medicamento.nombre,
    lote: s.lote.numeroLote,
    vencimiento: s.lote.fechaVencimiento.toISOString().slice(0, 10),
    ubicacion: s.ubicacion.nombre,
    cantidad: s.cantidad,
    razon:
      s.lote.estado === "RETIRADO_ALERTA"
        ? ("RETIRO_MERCADO" as const)
        : ("VENCIDO" as const),
  }));
}

// ------------------------------------------------------- Retiro de mercado

/** Registra la alerta del ISP y bloquea los lotes afectados (estado RETIRADO_ALERTA). */
export async function crearAlertaRetiro(
  input: z.infer<typeof alertaRetiroSchema>,
  usuarioId: number,
) {
  return db.$transaction(async (tx) => {
    const lotes = [...new Set(input.lotes.map((l) => l.trim()))];
    const alerta = await tx.alertaRetiro.create({
      data: {
        resolucion: input.resolucion,
        fecha: new Date(`${input.fecha}T00:00:00Z`),
        medicamentoId: input.medicamentoId,
        lotes,
        motivo: input.motivo,
        usuarioId,
      },
    });
    const bloqueados = await tx.lote.updateMany({
      where: { medicamentoId: input.medicamentoId, numeroLote: { in: lotes } },
      data: { estado: "RETIRADO_ALERTA" },
    });
    return { alerta, bloqueados: bloqueados.count };
  }, serializable);
}

export async function alertasRetiro() {
  const alertas = await db.alertaRetiro.findMany({
    orderBy: [{ estado: "asc" }, { id: "desc" }],
    include: { medicamento: { select: { id: true, nombre: true } } },
  });
  const stocks = await db.stock.findMany({
    where: {
      cantidad: { gt: 0 },
      lote: {
        estado: "RETIRADO_ALERTA",
        medicamentoId: { in: alertas.map((a) => a.medicamentoId) },
      },
    },
    include: { lote: true, ubicacion: { select: { nombre: true } } },
  });
  return alertas.map((a) => {
    const afectados = stocks.filter(
      (s) =>
        s.lote.medicamentoId === a.medicamentoId &&
        a.lotes.includes(s.lote.numeroLote),
    );
    return {
      id: a.id,
      resolucion: a.resolucion,
      fecha: a.fecha.toISOString().slice(0, 10),
      producto: a.medicamento.nombre,
      lotes: a.lotes,
      motivo: a.motivo,
      estado: a.estado,
      unidades: afectados.reduce((t, s) => t + s.cantidad, 0),
      existencias: afectados.map((s) => ({
        lote: s.lote.numeroLote,
        ubicacion: s.ubicacion.nombre,
        cantidad: s.cantidad,
      })),
    };
  });
}

// ------------------------------------------------------------------- Caja

async function ventasEfectivo(usuarioId: number, desde: Date, hasta?: Date) {
  const r = await db.venta.aggregate({
    where: {
      usuarioId,
      metodoPago: "EFECTIVO",
      estado: "CONFIRMADA",
      creadaEn: { gte: desde, ...(hasta && { lte: hasta }) },
    },
    _sum: { total: true },
    _count: true,
  });
  return { monto: n(r._sum.total), ventas: r._count };
}

/** Turno abierto del usuario con su arqueo en curso, o null. */
export async function turnoActual(usuarioId: number) {
  const turno = await db.turnoCaja.findFirst({
    where: { usuarioId, cerradoEn: null },
    include: { movimientos: { orderBy: { id: "desc" } } },
  });
  if (!turno) return null;
  const efectivo = await ventasEfectivo(usuarioId, turno.abiertoEn);
  const ingresos = turno.movimientos
    .filter((m) => m.tipo === "INGRESO")
    .reduce((t, m) => t + n(m.monto), 0);
  const egresos = turno.movimientos
    .filter((m) => m.tipo === "EGRESO")
    .reduce((t, m) => t + n(m.monto), 0);
  return {
    id: turno.id,
    abiertoEn: turno.abiertoEn.toISOString(),
    montoInicial: n(turno.montoInicial),
    ventasEfectivo: efectivo.monto,
    cantidadVentas: efectivo.ventas,
    ingresos,
    egresos,
    esperado: efectivoEsperado({
      montoInicial: n(turno.montoInicial),
      ventasEfectivo: efectivo.monto,
      ingresos,
      egresos,
    }),
    movimientos: turno.movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: n(m.monto),
      motivo: m.motivo,
      creadoEn: m.creadoEn.toISOString(),
    })),
  };
}
export type TurnoActual = NonNullable<Awaited<ReturnType<typeof turnoActual>>>;

export async function abrirTurno(usuarioId: number, montoInicial: number) {
  return db.$transaction(async (tx) => {
    if (await tx.turnoCaja.findFirst({ where: { usuarioId, cerradoEn: null } }))
      throw new AbastecimientoError("Ya tienes un turno de caja abierto.");
    return tx.turnoCaja.create({ data: { usuarioId, montoInicial } });
  }, serializable);
}

export async function registrarMovimientoCaja(
  usuarioId: number,
  input: z.infer<typeof movimientoCajaSchema>,
) {
  const turno = await turnoActual(usuarioId);
  if (!turno) throw new AbastecimientoError("Abre un turno de caja primero.");
  if (input.tipo === "EGRESO" && input.monto > turno.esperado)
    throw new AbastecimientoError(
      "El retiro supera el efectivo que debería haber en la caja.",
    );
  return db.movimientoCaja.create({
    data: { turnoId: turno.id, usuarioId, ...input },
  });
}

export async function cerrarTurno(
  usuarioId: number,
  input: z.infer<typeof cierreCajaSchema>,
) {
  const turno = await turnoActual(usuarioId);
  if (!turno) throw new AbastecimientoError("No tienes un turno abierto.");
  const cerrado = await db.turnoCaja.update({
    where: { id: turno.id, cerradoEn: null },
    data: {
      cerradoEn: new Date(),
      montoContado: input.montoContado,
      montoEsperado: turno.esperado,
      observaciones: input.observaciones || null,
    },
  });
  return {
    id: cerrado.id,
    esperado: turno.esperado,
    contado: input.montoContado,
    diferencia: Math.round((input.montoContado - turno.esperado) * 100) / 100,
  };
}

export async function turnosCerrados(take = 10) {
  const turnos = await db.turnoCaja.findMany({
    where: { cerradoEn: { not: null } },
    orderBy: { cerradoEn: "desc" },
    take,
  });
  const usuarios = new Map(
    (
      await db.usuario.findMany({
        where: { id: { in: [...new Set(turnos.map((t) => t.usuarioId))] } },
        select: { id: true, nombre: true, apellido: true },
      })
    ).map((u) => [u.id, [u.nombre, u.apellido].filter(Boolean).join(" ")]),
  );
  return turnos.map((t) => ({
    id: t.id,
    usuario: usuarios.get(t.usuarioId) ?? `#${t.usuarioId}`,
    abiertoEn: t.abiertoEn.toISOString(),
    cerradoEn: t.cerradoEn?.toISOString() ?? "",
    esperado: n(t.montoEsperado),
    contado: n(t.montoContado),
    diferencia:
      Math.round((n(t.montoContado) - n(t.montoEsperado)) * 100) / 100,
    observaciones: t.observaciones,
  }));
}
