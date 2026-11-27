import "server-only";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";

/**
 * Libro oficial digital de estupefacientes y psicotrópicos.
 *
 * Cada medicamento con condición RECETA_RETENIDA o RECETA_CHEQUE lleva su
 * propio saldo. El saldo del libro solo cambia con registros del libro
 * (apertura, entradas, salidas por venta y ajustes); si el stock físico se
 * mueve por otra vía, la diferencia aparece como descuadre.
 */
type Tx = Prisma.TransactionClient;
export const CONDICIONES_CONTROLADAS = [
  "RECETA_RETENIDA",
  "RECETA_CHEQUE",
] as const;

async function stockReal(tx: Tx, medicamentoId: number) {
  const r = await tx.stock.aggregate({
    where: { lote: { medicamentoId } },
    _sum: { cantidad: true },
  });
  return r._sum.cantidad ?? 0;
}

async function ultimoSaldo(tx: Tx, medicamentoId: number) {
  const ultimo = await tx.registroControlado.findFirst({
    where: { medicamentoId },
    orderBy: { id: "desc" },
    select: { saldo: true },
  });
  return ultimo?.saldo ?? null;
}

/**
 * Anota en el libro las salidas de una venta. Debe llamarse dentro de la
 * misma transacción de la venta y después de descontar el stock.
 */
export async function registrarSalidasControladas(
  tx: Tx,
  venta: { id: number; usuarioId: number; recetaId: number | null },
  detalles: { medicamentoId: number; loteId: number; cantidad: number }[],
) {
  const ids = [...new Set(detalles.map((d) => d.medicamentoId))];
  const controlados = await tx.medicamento.findMany({
    where: {
      id: { in: ids },
      condicionVenta: { in: [...CONDICIONES_CONTROLADAS] },
    },
    select: { id: true },
  });
  for (const { id } of controlados) {
    const propios = detalles.filter((d) => d.medicamentoId === id);
    const vendidas = propios.reduce((n, d) => n + d.cantidad, 0);
    let saldo = await ultimoSaldo(tx, id);
    if (saldo === null) {
      // Primer movimiento: el libro se abre con el stock previo a la venta.
      saldo = (await stockReal(tx, id)) + vendidas;
      await tx.registroControlado.create({
        data: {
          medicamentoId: id,
          tipo: "APERTURA",
          cantidad: saldo,
          saldo,
          usuarioId: venta.usuarioId,
          detalle: "Apertura automática con el stock previo a la primera venta",
        },
      });
    }
    for (const d of propios) {
      saldo -= d.cantidad;
      await tx.registroControlado.create({
        data: {
          medicamentoId: id,
          tipo: "SALIDA",
          cantidad: d.cantidad,
          saldo,
          loteId: d.loteId,
          recetaId: venta.recetaId,
          ventaId: venta.id,
          usuarioId: venta.usuarioId,
          detalle: `Venta #${venta.id}`,
        },
      });
    }
  }
}

export class LibroError extends Error {}

/** Apertura manual, entrada (recepción) o ajuste con motivo. */
export async function registrarMovimientoLibro(input: {
  medicamentoId: number;
  tipo: "APERTURA" | "ENTRADA" | "AJUSTE";
  cantidad: number;
  detalle: string;
  usuarioId: number;
}) {
  return prismaPrivada.$transaction(
    async (tx) => {
      const med = await tx.medicamento.findUnique({
        where: { id: input.medicamentoId },
        select: { condicionVenta: true, nombre: true },
      });
      if (
        !med ||
        !(CONDICIONES_CONTROLADAS as readonly string[]).includes(
          med.condicionVenta,
        )
      )
        throw new LibroError("El medicamento no es controlado.");
      const previo = await ultimoSaldo(tx, input.medicamentoId);
      if (input.tipo === "APERTURA") {
        if (previo !== null)
          throw new LibroError(`El libro de ${med.nombre} ya está abierto.`);
        const saldo = await stockReal(tx, input.medicamentoId);
        return tx.registroControlado.create({
          data: { ...input, cantidad: saldo, saldo },
        });
      }
      if (previo === null)
        throw new LibroError(`Abre primero el libro de ${med.nombre}.`);
      if (input.tipo === "ENTRADA" && input.cantidad <= 0)
        throw new LibroError("La entrada debe ser mayor que cero.");
      if (input.tipo === "AJUSTE" && input.cantidad === 0)
        throw new LibroError("El ajuste no puede ser cero.");
      const saldo = previo + input.cantidad;
      if (saldo < 0)
        throw new LibroError("El ajuste dejaría el saldo del libro negativo.");
      return tx.registroControlado.create({ data: { ...input, saldo } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Firma del Químico Farmacéutico sobre registros pendientes. */
export async function firmarRegistros(ids: number[], usuarioId: number) {
  const r = await prismaPrivada.registroControlado.updateMany({
    where: { id: { in: ids }, firmadoEn: null },
    data: { firmadoPor: usuarioId, firmadoEn: new Date() },
  });
  return r.count;
}

export type ResumenControlado = {
  medicamentoId: number;
  nombre: string;
  condicion: string;
  saldoLibro: number | null;
  stockReal: number;
  diferencia: number | null;
  pendientesFirma: number;
};

export async function resumenLibro(): Promise<ResumenControlado[]> {
  const meds = await prismaPrivada.medicamento.findMany({
    where: { condicionVenta: { in: [...CONDICIONES_CONTROLADAS] } },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      concentracion: true,
      condicionVenta: true,
      lotes: { select: { stocks: { select: { cantidad: true } } } },
      registrosControlados: {
        orderBy: { id: "desc" },
        take: 1,
        select: { saldo: true },
      },
      _count: {
        select: { registrosControlados: { where: { firmadoEn: null } } },
      },
    },
  });
  return meds.map((m) => {
    const stock = m.lotes.reduce(
      (n, l) => n + l.stocks.reduce((s, x) => s + x.cantidad, 0),
      0,
    );
    const saldo = m.registrosControlados[0]?.saldo ?? null;
    return {
      medicamentoId: m.id,
      nombre: m.concentracion ? `${m.nombre} · ${m.concentracion}` : m.nombre,
      condicion: m.condicionVenta,
      saldoLibro: saldo,
      stockReal: stock,
      diferencia: saldo === null ? null : stock - saldo,
      pendientesFirma: m._count.registrosControlados,
    };
  });
}

const fechaHora = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export async function registrosLibro(opciones: {
  medicamentoId?: number;
  soloPendientes?: boolean;
  take?: number;
}) {
  const registros = await prismaPrivada.registroControlado.findMany({
    where: {
      medicamentoId: opciones.medicamentoId,
      firmadoEn: opciones.soloPendientes ? null : undefined,
    },
    orderBy: { id: "desc" },
    take: opciones.take ?? 200,
    include: {
      medicamento: { select: { nombre: true } },
      receta: {
        select: {
          tipo: true,
          folio: true,
          pacienteRut: true,
          medicoNombre: true,
        },
      },
    },
  });
  const usuarios = await prismaPrivada.usuario.findMany({
    where: {
      id: {
        in: [
          ...new Set(
            registros.flatMap((r) =>
              [r.usuarioId, r.firmadoPor].filter((x): x is number => !!x),
            ),
          ),
        ],
      },
    },
    select: { id: true, nombre: true, apellido: true },
  });
  const nombre = new Map(
    usuarios.map((u) => [
      u.id,
      [u.nombre, u.apellido].filter(Boolean).join(" "),
    ]),
  );
  return registros.map((r) => ({
    id: r.id,
    // Se formatea en el servidor para evitar diferencias de ICU al hidratar.
    fecha: fechaHora.format(r.creadoEn),
    medicamento: r.medicamento.nombre,
    tipo: r.tipo,
    cantidad: r.cantidad,
    saldo: r.saldo,
    detalle: r.detalle,
    ventaId: r.ventaId,
    receta: r.receta,
    registradoPor: r.usuarioId ? (nombre.get(r.usuarioId) ?? null) : null,
    firmadoPor: r.firmadoPor ? (nombre.get(r.firmadoPor) ?? null) : null,
    firmadoEn: r.firmadoEn ? fechaHora.format(r.firmadoEn) : null,
  }));
}
export type RegistroLibro = Awaited<ReturnType<typeof registrosLibro>>[number];
