import { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";
import { receiveFefo } from "@/lib/private/fefo-inventory";
import { stockDate, stockExpiry } from "@/lib/private/stock-dates";
import { lotStates, receiptSchema } from "@/lib/types/fefo";

const id = z.number().int().positive();
const reason = z.string().trim().min(5).max(1000);
const actions = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("SUCURSAL"),
    id: id.optional(),
    nombre: z.string().trim().min(2).max(100),
    alertasDias: z.array(z.number().int().min(0).max(730)).min(1).max(10),
    permiteExcepcion: z.boolean(),
    permiteReingreso: z.boolean(),
    procedimiento: z.string().trim().max(1000),
  }),
  z.object({
    accion: z.literal("CREAR_UBICACION"),
    nombre: z.string().trim().min(2).max(100),
    tipo: z.enum(["BODEGA", "VITRINA"]),
    sucursalId: id,
  }),
  z.object({ accion: z.literal("UBICACION"), ubicacionId: id, sucursalId: id }),
  z.object({
    accion: z.literal("BLOQUEAR"),
    loteId: id,
    estado: z.enum(lotStates.filter((state) => state !== "APTO")),
    motivo: reason,
  }),
  z.object({
    accion: z.literal("CONCILIAR"),
    stockId: id,
    numeroLote: z.string().trim().min(1).max(100),
    rotulo: z.iso.date(),
    fechaRecepcion: z.iso.datetime(),
    motivo: reason,
    confirmado: z.literal(true),
  }),
  z.object({
    accion: z.literal("RETIRAR"),
    stockId: id,
    cantidadAnterior: z.number().int().nonnegative(),
    confirmado: z.literal(true),
    motivo: reason,
  }),
  z.object({
    accion: z.literal("TRASPASAR"),
    stockId: id,
    destinoId: id,
    cantidad: z.number().int().positive(),
    motivo: reason,
  }),
  z.object({
    accion: z.literal("DEVOLVER"),
    detalleVentaId: id,
    ubicacionId: id,
    cantidad: z.number().int().positive(),
    motivo: reason,
  }),
  z.object({ accion: z.literal("RECHAZAR"), revisionId: id, motivo: reason }),
  z.object({
    accion: z.literal("APROBAR"),
    revisionId: id,
    numeroLote: z.string().trim().min(1).max(100),
    rotulo: z.iso.date(),
    motivo: reason,
  }),
]);
export async function GET(request: Request) {
  const user = await currentPrivateUser();
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  if (
    params.get("meta") === "1" &&
    (canOperate(user, "pos") || canOperate(user, "inventario"))
  )
    return Response.json({
      sucursales: await prismaPrivada.sucursal.findMany({
        orderBy: { nombre: "asc" },
      }),
    });
  if (!canOperate(user, "inventario"))
    return Response.json(
      { error: "Sin permiso de inventario." },
      { status: 403 },
    );
  if (params.get("configuracion") === "1") {
    const [sucursales, ubicaciones] = await Promise.all([
      prismaPrivada.sucursal.findMany({ orderBy: { nombre: "asc" } }),
      prismaPrivada.ubicacionInventario.findMany({
        orderBy: [{ nombre: "asc" }, { id: "asc" }],
        select: { id: true, nombre: true, tipo: true, sucursalId: true },
      }),
    ]);
    return Response.json({
      sucursales,
      ubicaciones,
      puedeConfigurar: canOperate(user, "inventario_configurar"),
    });
  }
  const [sucursales, ubicaciones, revisiones, stocks] = await Promise.all([
    prismaPrivada.sucursal.findMany({ orderBy: { nombre: "asc" } }),
    prismaPrivada.ubicacionInventario.findMany({ include: { sucursal: true } }),
    prismaPrivada.revisionInventario.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { creadoEn: "asc" },
    }),
    prismaPrivada.stock.findMany({
      include: {
        lote: {
          include: {
            medicamento: {
              select: {
                nombre: true,
                concentracion: true,
                formaFarmaceutica: true,
              },
            },
          },
        },
        ubicacion: { include: { sucursal: true } },
      },
    }),
  ]);
  const traceId = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(params.get("loteId"));
  const movimientos = traceId.success
    ? await prismaPrivada.movimientoStock.findMany({
        where: { loteId: traceId.data },
        orderBy: { creadoEn: "desc" },
      })
    : [];
  return Response.json({
    sucursales,
    ubicaciones,
    revisiones,
    stocks,
    movimientos,
    permisos: {
      configurar: canOperate(user, "inventario_configurar"),
      liberar: canOperate(user, "inventario_liberar"),
      devolver: canOperate(user, "devoluciones"),
      anular: canOperate(user, "ventas_anular"),
    },
  });
}
export async function POST(request: Request) {
  const user = await currentPrivateUser();
  if (!user || !canOperate(user, "inventario"))
    return Response.json(
      { error: "Sin permiso de recepción." },
      { status: 403 },
    );
  const parsed = receiptSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Recepción inválida." },
      { status: 400 },
    );
  try {
    return Response.json(await receiveFefo(parsed.data, user.id), {
      status: 201,
    });
  } catch (error) {
    return failure(error);
  }
}
const failure = (error: unknown) =>
  Response.json(
    {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "El inventario cambió. Actualiza e intenta nuevamente.",
    },
    { status: 409 },
  );
export async function PATCH(request: Request) {
  const user = await currentPrivateUser();
  if (!user || !canOperate(user, "inventario"))
    return Response.json(
      { error: "Sin permiso de inventario." },
      { status: 403 },
    );
  const parsed = actions.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  const input = parsed.data;
  const permission = ["SUCURSAL", "UBICACION", "CREAR_UBICACION"].includes(
    input.accion,
  )
    ? "inventario_configurar"
    : ["CONCILIAR", "APROBAR", "RECHAZAR"].includes(input.accion)
      ? "inventario_liberar"
      : input.accion === "DEVOLVER"
        ? "devoluciones"
        : "inventario";
  if (!canOperate(user, permission))
    return Response.json(
      { error: "No tienes permiso para esta operación." },
      { status: 403 },
    );
  try {
    await prismaPrivada.$transaction(
      async (tx) => {
        if (input.accion === "SUCURSAL") {
          if (
            (input.permiteExcepcion || input.permiteReingreso) &&
            input.procedimiento.length < 5
          )
            throw new Error(
              "Indica la referencia del procedimiento validado por el director técnico.",
            );
          const data = {
            nombre: input.nombre,
            alertasDias: [...new Set(input.alertasDias)].sort((a, b) => a - b),
            permiteExcepcion: input.permiteExcepcion,
            permiteReingreso: input.permiteReingreso,
            procedimiento: input.procedimiento || null,
            configuradaPor: user.id,
            configuradaEn: new Date(),
          };
          if (input.id)
            await tx.sucursal.update({ where: { id: input.id }, data });
          else await tx.sucursal.create({ data });
        } else if (input.accion === "UBICACION") {
          const location = await tx.ubicacionInventario.findUnique({
            where: { id: input.ubicacionId },
          });
          if (location?.sucursalId && location.sucursalId !== input.sucursalId)
            throw new Error(
              "La ubicación ya pertenece a otra sucursal; usa un traspaso físico.",
            );
          await tx.ubicacionInventario.update({
            where: { id: input.ubicacionId },
            data: { sucursalId: input.sucursalId },
          });
        } else if (input.accion === "CREAR_UBICACION") {
          await tx.ubicacionInventario.create({
            data: {
              nombre: input.nombre,
              tipo: input.tipo,
              sucursalId: input.sucursalId,
            },
          });
        } else if (input.accion === "BLOQUEAR") {
          const previous = await tx.lote.findUniqueOrThrow({
            where: { id: input.loteId },
          });
          if (
            ["RETIRADO_ALERTA", "DETERIORADO"].includes(previous.estado) &&
            input.estado !== previous.estado
          )
            throw new Error(
              "El retiro por alerta o deterioro no puede revertirse mediante un cambio de estado.",
            );
          await tx.lote.update({
            where: { id: input.loteId },
            data: { estado: input.estado },
          });
          await tx.movimientoStock.create({
            data: {
              loteId: input.loteId,
              cantidad: 0,
              tipo: "AJUSTE",
              usuarioId: user.id,
              origen: input.estado,
              motivo: input.motivo,
            },
          });
        } else if (input.accion === "CONCILIAR") {
          const stock = await tx.stock.findUnique({
            where: { id: input.stockId },
            include: { lote: true, ubicacion: true },
          });
          if (!stock?.ubicacion.sucursalId)
            throw new Error(
              "Asigna la ubicación a una sucursal antes de conciliar.",
            );
          if (stock.lote.precisionVencimiento === "MES_ANIO")
            throw new Error("Los r?tulos mes/a?o deben permanecer pendientes.");
          if (["RETIRADO_ALERTA", "DETERIORADO"].includes(stock.lote.estado))
            throw new Error(
              "No se puede liberar un lote retirado o deteriorado.",
            );
          if (
            new Date(input.fechaRecepcion) > new Date() ||
            stockExpiry(input.rotulo) <= new Date()
          )
            throw new Error("Recepción futura o lote vencido.");
          if (
            stock.lote.estado === "APTO" &&
            (stock.lote.numeroLote !== input.numeroLote ||
              stockDate(stock.lote.fechaVencimiento) !== input.rotulo)
          )
            throw new Error("El lote ya fue verificado con otros datos.");
          await tx.lote.update({
            where: { id: stock.loteId },
            data: {
              numeroLote: input.numeroLote,
              rotuloVencimiento: input.rotulo,
              precisionVencimiento: "DIA",
              fechaVencimiento: stockExpiry(input.rotulo),
              estado: "APTO",
            },
          });
          await tx.stock.update({
            where: { id: stock.id },
            data: { fechaRecepcion: new Date(input.fechaRecepcion) },
          });
          await tx.movimientoStock.create({
            data: {
              loteId: stock.loteId,
              ubicacionId: stock.ubicacionId,
              usuarioId: user.id,
              tipo: "AJUSTE",
              cantidad: 0,
              origen: "CONCILIACION_FISICA",
              motivo: `${input.motivo} · Recepción verificada ${input.fechaRecepcion} · Rótulo ${input.rotulo}`,
            },
          });
        } else if (input.accion === "RETIRAR") {
          const stock = await tx.stock.findUnique({
            where: { id: input.stockId },
            include: { lote: true },
          });
          if (
            !stock ||
            stock.lote.fechaVencimiento > new Date() ||
            stock.cantidad !== input.cantidadAnterior ||
            stock.cantidad <= 0
          )
            throw new Error("El lote no está vencido o su saldo cambió.");
          if (stock.cantidadBloqueada > 0)
            throw new Error(
              "Registra el retiro desde Productos vencidos y resuelve por separado los casos de cuarentena.",
            );
          const retirado = await tx.stock.updateMany({
            where: {
              id: stock.id,
              cantidad: stock.cantidad,
              cantidadBloqueada: 0,
            },
            data: { cantidad: 0 },
          });
          if (!retirado.count)
            throw new Error("El saldo cambió. Actualiza e intenta nuevamente.");
          await tx.movimientoStock.create({
            data: {
              loteId: stock.loteId,
              ubicacionId: stock.ubicacionId,
              usuarioId: user.id,
              tipo: "SALIDA",
              cantidad: stock.cantidad,
              origen: "RETIRO_FISICO_VENCIDO",
              motivo: input.motivo,
            },
          });
        } else if (input.accion === "TRASPASAR") {
          const stock = await tx.stock.findUnique({
            where: { id: input.stockId },
          });
          const target = await tx.ubicacionInventario.findUnique({
            where: { id: input.destinoId },
          });
          if (
            !stock ||
            !target?.sucursalId ||
            stock.ubicacionId === target.id ||
            stock.cantidad - stock.cantidadBloqueada < input.cantidad
          )
            throw new Error("Saldo o ubicación de destino inválidos.");
          const dest = await tx.stock.findUnique({
            where: {
              loteId_ubicacionId: {
                loteId: stock.loteId,
                ubicacionId: target.id,
              },
            },
          });
          const reception =
            !stock.fechaRecepcion ||
            (dest && !dest.fechaRecepcion && dest.cantidad > 0)
              ? null
              : dest?.fechaRecepcion &&
                  dest.fechaRecepcion < stock.fechaRecepcion
                ? dest.fechaRecepcion
                : stock.fechaRecepcion;
          const trasladado = await tx.stock.updateMany({
            where: {
              id: stock.id,
              cantidad: { gte: input.cantidad + stock.cantidadBloqueada },
              cantidadBloqueada: stock.cantidadBloqueada,
            },
            data: { cantidad: { decrement: input.cantidad } },
          });
          if (!trasladado.count)
            throw new Error("El saldo cambió. Actualiza e intenta nuevamente.");
          await tx.stock.upsert({
            where: {
              loteId_ubicacionId: {
                loteId: stock.loteId,
                ubicacionId: target.id,
              },
            },
            update: {
              cantidad: { increment: input.cantidad },
              fechaRecepcion: reception,
            },
            create: {
              loteId: stock.loteId,
              ubicacionId: target.id,
              cantidad: input.cantidad,
              fechaRecepcion: reception,
            },
          });
          for (const [location, quantity] of [
            [stock.ubicacionId, -input.cantidad],
            [target.id, input.cantidad],
          ])
            await tx.movimientoStock.create({
              data: {
                loteId: stock.loteId,
                ubicacionId: location,
                usuarioId: user.id,
                tipo: "TRASPASO",
                cantidad: quantity,
                origen: "TRASPASO_FISICO",
                motivo: input.motivo,
              },
            });
        } else if (input.accion === "DEVOLVER") {
          const detail = await tx.detalleVenta.findUnique({
            where: { id: input.detalleVentaId },
            include: { lote: true, venta: true },
          });
          const location = await tx.ubicacionInventario.findUnique({
            where: { id: input.ubicacionId },
          });
          if (!detail || !location?.sucursalId)
            throw new Error("Detalle de venta o ubicación inválidos.");
          const returned = await tx.revisionInventario.aggregate({
            where: { detalleVentaId: detail.id },
            _sum: { cantidad: true },
          });
          if ((returned._sum.cantidad ?? 0) + input.cantidad > detail.cantidad)
            throw new Error(
              "La cantidad supera lo entregado pendiente de devolución.",
            );
          await tx.revisionInventario.create({
            data: {
              medicamentoId: detail.medicamentoId,
              ubicacionId: location.id,
              cantidad: input.cantidad,
              numeroLote: detail.lote.numeroLote,
              rotuloVencimiento: detail.lote.rotuloVencimiento,
              precisionVencimiento: detail.lote.precisionVencimiento,
              fechaFabricacion: detail.lote.fechaFabricacion,
              fechaRecepcion: new Date(),
              detalleVentaId: detail.id,
              origen: "DEVOLUCION",
              motivo: input.motivo,
              registradoPor: user.id,
            },
          });
        } else if (input.accion === "RECHAZAR") {
          const changed = await tx.revisionInventario.updateMany({
            where: { id: input.revisionId, estado: "PENDIENTE" },
            data: {
              estado: "RECHAZADA",
              revisadoPor: user.id,
              revisadoEn: new Date(),
              resolucion: input.motivo,
            },
          });
          if (changed.count !== 1)
            throw new Error("La revisión ya fue resuelta.");
        } else if (input.accion === "APROBAR") {
          const review = await tx.revisionInventario.findUnique({
            where: { id: input.revisionId },
          });
          if (!review || review.estado !== "PENDIENTE")
            throw new Error("La revisión ya fue resuelta.");
          if (review.precisionVencimiento === "MES_ANIO")
            throw new Error(
              "Los rótulos mes/año quedan pendientes hasta integrar el criterio del director técnico.",
            );
          const location = await tx.ubicacionInventario.findUnique({
            where: { id: review.ubicacionId },
            include: { sucursal: true },
          });
          if (!location?.sucursal)
            throw new Error("Asigna la ubicación a una sucursal.");
          if (
            review.origen === "DEVOLUCION" &&
            (!location.sucursal.permiteReingreso ||
              !location.sucursal.procedimiento)
          )
            throw new Error(
              "El procedimiento de la sucursal no autoriza reincorporar devoluciones.",
            );
          if (stockExpiry(input.rotulo) <= new Date())
            throw new Error("Un lote vencido no puede reincorporarse.");
          const lot = await tx.lote.upsert({
            where: {
              medicamentoId_numeroLote: {
                medicamentoId: review.medicamentoId,
                numeroLote: input.numeroLote,
              },
            },
            update: {},
            create: {
              medicamentoId: review.medicamentoId,
              numeroLote: input.numeroLote,
              fechaFabricacion: review.fechaFabricacion,
              fechaVencimiento: stockExpiry(input.rotulo),
              rotuloVencimiento: input.rotulo,
              precisionVencimiento: "DIA",
              estado: "APTO",
            },
          });
          if (
            lot.estado !== "APTO" ||
            stockDate(lot.fechaVencimiento) !== input.rotulo
          )
            throw new Error(
              "El lote está bloqueado o no coincide con el rótulo verificado.",
            );
          const existing = await tx.stock.findUnique({
            where: {
              loteId_ubicacionId: { loteId: lot.id, ubicacionId: location.id },
            },
          });
          if (existing && !existing.fechaRecepcion && existing.cantidad > 0)
            throw new Error(
              "Primero concilia la existencia histórica de esta ubicación.",
            );
          const reception =
            existing?.fechaRecepcion &&
            existing.fechaRecepcion < review.fechaRecepcion
              ? existing.fechaRecepcion
              : review.fechaRecepcion;
          const saved = await tx.stock.upsert({
            where: {
              loteId_ubicacionId: { loteId: lot.id, ubicacionId: location.id },
            },
            create: {
              loteId: lot.id,
              ubicacionId: location.id,
              cantidad: review.cantidad,
              fechaRecepcion: reception,
            },
            update: {
              cantidad: { increment: review.cantidad },
              fechaRecepcion: reception,
            },
          });
          await tx.revisionInventario.update({
            where: { id: review.id },
            data: {
              estado: "APROBADA",
              revisadoPor: user.id,
              revisadoEn: new Date(),
              resolucion: input.motivo,
              stockDestinoId: saved.id,
            },
          });
          await tx.movimientoStock.create({
            data: {
              loteId: lot.id,
              ubicacionId: location.id,
              cantidad: review.cantidad,
              tipo: "ENTRADA",
              usuarioId: user.id,
              origen: "REVISION_APROBADA",
              motivo: `Revisión #${review.id} · ${input.motivo}`,
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
