import "server-only";
import { Prisma } from "@/generated/asistencial/client";
import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import {
  type DispensacionInput,
  problemaRecetaAsistencial,
  type RemesaInput,
} from "@/lib/validation/dispensacion";
import { hoyChile } from "@/lib/validation/recetas";

type Tx = Prisma.TransactionClient;
export class DispensacionError extends Error {}

/** Instante UTC en que empieza un día "YYYY-MM-DD" en Chile. */
function inicioDiaChile(dia: string) {
  const base = new Date(`${dia}T00:00:00Z`);
  const m = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    timeZoneName: "longOffset",
  })
    .formatToParts(base)
    .find((p) => p.type === "timeZoneName")
    ?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return base;
  const min = (Number(m[2]) * 60 + Number(m[3])) * (m[1] === "-" ? -1 : 1);
  return new Date(base.getTime() - min * 60_000);
}
const inicioMesChile = (hoy = hoyChile()) =>
  inicioDiaChile(`${hoy.slice(0, 8)}01`);
const fechaDb = (dia: string) => new Date(`${dia}T00:00:00Z`);

async function stockDisponible(tx: Tx | typeof db, medicamentoIds: number[]) {
  const filas = await tx.stock.findMany({
    where: {
      lote: {
        medicamentoId: { in: medicamentoIds },
        fechaVencimiento: { gt: new Date() },
      },
      cantidad: { gt: 0 },
    },
    include: { lote: true, ubicacion: true },
    orderBy: [{ lote: { fechaVencimiento: "asc" } }, { id: "asc" }],
  });
  return filas
    .map((s) => ({ ...s, disponible: s.cantidad - s.cantidadBloqueada }))
    .filter((s) => s.disponible > 0);
}

/** Unidades ya entregadas este mes por paciente, programa y medicamento. */
async function usadoEnMes(tx: Tx | typeof db, pacienteId: number) {
  const filas = await tx.dispensacionDetalle.groupBy({
    by: ["medicamentoId"],
    where: {
      dispensacion: { pacienteId, creadaEn: { gte: inicioMesChile() } },
    },
    _sum: { cantidad: true },
  });
  return new Map(filas.map((f) => [f.medicamentoId, f._sum.cantidad ?? 0]));
}

/** Ficha del paciente para la pantalla de dispensación. */
export async function fichaPaciente(rut: string) {
  const paciente = await db.paciente.findUnique({
    where: { rut },
    include: {
      inscripciones: {
        include: {
          programa: {
            include: {
              medicamentos: {
                include: {
                  medicamento: {
                    select: {
                      id: true,
                      nombre: true,
                      concentracion: true,
                      formaFarmaceutica: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      dispensaciones: {
        orderBy: { creadaEn: "desc" },
        take: 10,
        include: {
          programa: { select: { nombre: true } },
          detalles: {
            include: { medicamento: { select: { nombre: true } } },
          },
        },
      },
    },
  });
  if (!paciente) return null;
  const hoy = hoyChile();
  const usado = await usadoEnMes(db, paciente.id);
  const ids = paciente.inscripciones.flatMap((i) =>
    i.programa.medicamentos.map((m) => m.medicamentoId),
  );
  const stock = await stockDisponible(db, ids);
  const disponible = (id: number) =>
    stock
      .filter((s) => s.lote.medicamentoId === id)
      .reduce((n, s) => n + s.disponible, 0);
  const fecha = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago",
  });
  return {
    id: paciente.id,
    rut: paciente.rut,
    nombre: paciente.nombre,
    programas: paciente.inscripciones.map((i) => {
      const vigente =
        i.activo &&
        i.programa.activo &&
        i.desde.toISOString().slice(0, 10) <= hoy &&
        (!i.hasta || i.hasta.toISOString().slice(0, 10) >= hoy);
      return {
        id: i.programa.id,
        codigo: i.programa.codigo,
        nombre: i.programa.nombre,
        tipo: i.programa.tipo,
        vigente,
        medicamentos: i.programa.medicamentos.map((m) => ({
          id: m.medicamentoId,
          nombre: [
            m.medicamento.nombre,
            m.medicamento.concentracion,
            m.medicamento.formaFarmaceutica,
          ]
            .filter(Boolean)
            .join(" · "),
          cuotaMensual: m.cuotaMensual,
          usadoMes: usado.get(m.medicamentoId) ?? 0,
          stock: disponible(m.medicamentoId),
        })),
      };
    }),
    historial: paciente.dispensaciones.map((d) => ({
      id: d.id,
      fecha: fecha.format(d.creadaEn),
      programa: d.programa.nombre,
      retira: d.retiraNombre
        ? `${d.retiraNombre} (${d.retiraParentesco})`
        : "Titular",
      detalle: d.detalles
        .map((x) => `${x.cantidad} × ${x.medicamento.nombre}`)
        .join(", "),
    })),
  };
}
export type FichaPaciente = NonNullable<
  Awaited<ReturnType<typeof fichaPaciente>>
>;

/** Registra una entrega sin costo con asignación FEFO, en una transacción. */
export async function dispensar(input: DispensacionInput, usuarioId: number) {
  return db.$transaction(
    async (tx) => {
      const repetida = await tx.dispensacion.findUnique({
        where: { claveOperacion: input.claveOperacion },
      });
      if (repetida) return repetida;

      const hoy = hoyChile();
      const problema = problemaRecetaAsistencial(input.receta.fecha, hoy);
      if (problema) throw new DispensacionError(problema);
      if (input.retira && input.retira.rut === input.pacienteRut)
        throw new DispensacionError(
          "Si retira el titular, deja vacíos los datos de quien retira.",
        );
      if (
        new Set(input.items.map((i) => i.medicamentoId)).size !==
        input.items.length
      )
        throw new DispensacionError("Hay medicamentos repetidos.");

      const paciente = await tx.paciente.findUnique({
        where: { rut: input.pacienteRut },
      });
      if (!paciente)
        throw new DispensacionError("El paciente no está registrado.");
      const inscripcion = await tx.inscripcionPrograma.findUnique({
        where: {
          pacienteId_programaId: {
            pacienteId: paciente.id,
            programaId: input.programaId,
          },
        },
        include: { programa: { include: { medicamentos: true } } },
      });
      const desde = inscripcion?.desde.toISOString().slice(0, 10);
      const hasta = inscripcion?.hasta?.toISOString().slice(0, 10);
      if (
        !inscripcion?.activo ||
        !inscripcion.programa.activo ||
        (desde && desde > hoy) ||
        (hasta && hasta < hoy)
      )
        throw new DispensacionError(
          "El paciente no tiene una inscripción vigente en ese programa.",
        );

      const usado = await usadoEnMes(tx, paciente.id);
      for (const item of input.items) {
        const cubierto = inscripcion.programa.medicamentos.find(
          (m) => m.medicamentoId === item.medicamentoId,
        );
        if (!cubierto)
          throw new DispensacionError(
            `El medicamento #${item.medicamentoId} no pertenece al programa.`,
          );
        const restante =
          cubierto.cuotaMensual - (usado.get(item.medicamentoId) ?? 0);
        if (item.cantidad > restante)
          throw new DispensacionError(
            `Supera la cuota mensual: quedan ${Math.max(0, restante)} unidades de ese medicamento este mes.`,
          );
      }

      const stock = await stockDisponible(
        tx,
        input.items.map((i) => i.medicamentoId),
      );
      const detalles: {
        medicamentoId: number;
        loteId: number;
        ubicacionId: number;
        cantidad: number;
        stockId: number;
      }[] = [];
      for (const item of input.items) {
        let falta = item.cantidad;
        for (const s of stock.filter(
          (x) => x.lote.medicamentoId === item.medicamentoId,
        )) {
          if (!falta) break;
          const toma = Math.min(falta, s.disponible);
          detalles.push({
            medicamentoId: item.medicamentoId,
            loteId: s.loteId,
            ubicacionId: s.ubicacionId,
            cantidad: toma,
            stockId: s.id,
          });
          falta -= toma;
        }
        if (falta)
          throw new DispensacionError(
            `Stock insuficiente: faltan ${falta} unidades del medicamento #${item.medicamentoId}.`,
          );
      }

      for (const d of detalles) {
        const r = await tx.stock.updateMany({
          where: { id: d.stockId, cantidad: { gte: d.cantidad } },
          data: { cantidad: { decrement: d.cantidad } },
        });
        if (r.count !== 1)
          throw new DispensacionError(
            "Otro usuario modificó el stock. Intenta nuevamente.",
          );
      }
      const dispensacion = await tx.dispensacion.create({
        data: {
          claveOperacion: input.claveOperacion,
          pacienteId: paciente.id,
          programaId: input.programaId,
          folioReceta: input.receta.folio || null,
          medicoRut: input.receta.medicoRut,
          medicoNombre: input.receta.medicoNombre,
          fechaReceta: fechaDb(input.receta.fecha),
          retiraRut: input.retira?.rut ?? null,
          retiraNombre: input.retira?.nombre ?? null,
          retiraParentesco: input.retira?.parentesco ?? null,
          observaciones: input.observaciones || null,
          usuarioId,
          detalles: {
            create: detalles.map((d) => ({
              medicamentoId: d.medicamentoId,
              loteId: d.loteId,
              ubicacionId: d.ubicacionId,
              cantidad: d.cantidad,
            })),
          },
        },
      });
      await tx.movimientoStock.createMany({
        data: detalles.map((d) => ({
          tipo: "SALIDA" as const,
          cantidad: d.cantidad,
          loteId: d.loteId,
          motivo: `Dispensación #${dispensacion.id} · ${inscripcion.programa.nombre}`,
        })),
      });
      return dispensacion;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Recepción de una remesa: crea o completa lotes y suma stock. */
export async function recibirRemesa(input: RemesaInput, usuarioId: number) {
  const hoy = hoyChile();
  return db.$transaction(
    async (tx) => {
      if (
        await tx.remesa.findUnique({
          where: {
            proveedor_guia: { proveedor: input.proveedor, guia: input.guia },
          },
        })
      )
        throw new DispensacionError(
          `La guía ${input.guia} de ${input.proveedor} ya fue recibida.`,
        );
      const remesa = await tx.remesa.create({
        data: {
          guia: input.guia,
          proveedor: input.proveedor,
          observaciones: input.observaciones || null,
          usuarioId,
        },
      });
      for (const item of input.items) {
        if (item.fechaVencimiento <= hoy)
          throw new DispensacionError(
            `El lote ${item.numeroLote} ya está vencido; no se recibe.`,
          );
        const vencimiento = fechaDb(item.fechaVencimiento);
        const lote = await tx.lote.upsert({
          where: {
            medicamentoId_numeroLote: {
              medicamentoId: item.medicamentoId,
              numeroLote: item.numeroLote,
            },
          },
          create: {
            medicamentoId: item.medicamentoId,
            numeroLote: item.numeroLote,
            fechaVencimiento: vencimiento,
          },
          update: {},
        });
        if (
          lote.fechaVencimiento.toISOString().slice(0, 10) !==
          item.fechaVencimiento
        )
          throw new DispensacionError(
            `El lote ${item.numeroLote} ya existe con otro vencimiento.`,
          );
        await tx.stock.upsert({
          where: {
            loteId_ubicacionId: {
              loteId: lote.id,
              ubicacionId: item.ubicacionId,
            },
          },
          create: {
            loteId: lote.id,
            ubicacionId: item.ubicacionId,
            cantidad: item.cantidad,
          },
          update: { cantidad: { increment: item.cantidad } },
        });
        await tx.remesaDetalle.create({
          data: {
            remesaId: remesa.id,
            loteId: lote.id,
            ubicacionId: item.ubicacionId,
            cantidad: item.cantidad,
          },
        });
        await tx.movimientoStock.create({
          data: {
            tipo: "ENTRADA",
            cantidad: item.cantidad,
            loteId: lote.id,
            motivo: `Remesa ${input.proveedor} guía ${input.guia}`,
          },
        });
      }
      return remesa;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
