import { z } from "zod";
import type { Prisma } from "@/generated/asistencial/client";
import type { Prisma as PrismaPrivada } from "@/generated/privada/client";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { getPharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import {
  DIAS_PROXIMO_VENCIMIENTO,
  etiquetaVencimiento,
} from "@/lib/etiqueta-vencimiento";
import { canOperate } from "@/lib/fefo";
import { stockDate, stockExpiry } from "@/lib/private/stock-dates";
import { tiposCuarentena } from "@/lib/types/cuarentena";

const vistaSchema = z.enum([...tiposCuarentena, "SEGREGAR", "VENCIDOS"]);
const id = z.number().int().positive().max(2_147_483_647);
const motivo = z.string().trim().min(3).max(500);
const comando = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("REGISTRAR"),
    stockId: id,
    tipo: z.enum(tiposCuarentena),
    cantidad: id,
    motivo,
  }),
  z.object({
    accion: z.literal("RESOLVER"),
    casoId: id,
    resolucion: z.enum(["LIBERADO", "RECHAZADO"]),
    motivo,
  }),
  z.object({
    accion: z.literal("RETIRAR_VENCIDO"),
    stockId: id,
    cantidad: id,
    motivo,
  }),
]);

const incluir = {
  lote: { include: { medicamento: { select: { nombre: true } } } },
  ubicacion: { select: { nombre: true } },
} as const;

const columnas = {
  producto: (sort: Prisma.SortOrder) => ({
    lote: { medicamento: { nombre: sort } },
  }),
  lote: (sort: Prisma.SortOrder) => ({ lote: { numeroLote: sort } }),
  ubicacion: (sort: Prisma.SortOrder) => ({ ubicacion: { nombre: sort } }),
  vencimiento: (sort: Prisma.SortOrder) => ({
    lote: { fechaVencimiento: sort },
  }),
  cantidad: (sort: Prisma.SortOrder) => ({ cantidad: sort }),
  cantidadBloqueada: (sort: Prisma.SortOrder) => ({ cantidadBloqueada: sort }),
} satisfies Record<
  string,
  (sort: Prisma.SortOrder) => Prisma.StockOrderByWithRelationInput
>;

const filtrosSegregar = z.object({
  pagina: z.coerce.number().int().min(0).max(10_000).default(0),
  buscar: z.string().trim().max(200).default(""),
  ordenar: z
    .enum([
      "producto",
      "lote",
      "ubicacion",
      "vencimiento",
      "cantidad",
      "cantidadBloqueada",
    ])
    .default("vencimiento"),
  direccion: z.enum(["asc", "desc"]).default("asc"),
  alerta: z
    .enum(["todos", "rojo", "amarillo", "verde", "gris"])
    .default("todos"),
});

function finDiaRelativo(hoy: string, dias: number) {
  const fecha = new Date(Date.parse(hoy) + dias * 86400000);
  return stockExpiry(fecha.toISOString().slice(0, 10));
}

function filtroSegregar(
  filtros: z.infer<typeof filtrosSegregar>,
  privada: boolean,
): PrismaPrivada.StockWhereInput {
  const { alerta, buscar } = filtros;
  const texto = { contains: buscar, mode: "insensitive" } as const;
  const hoy = stockDate(new Date());
  const ayer = finDiaRelativo(hoy, -1);
  const limite = finDiaRelativo(hoy, DIAS_PROXIMO_VENCIMIENTO);
  const fechaVencimiento =
    alerta === "rojo"
      ? { lte: ayer }
      : alerta === "amarillo"
        ? { gt: ayer, lte: limite }
        : { gt: limite };
  return {
    cantidad: { gt: 0 },
    ...(buscar && {
      OR: [
        { lote: { medicamento: { nombre: texto } } },
        { lote: { numeroLote: texto } },
        { ubicacion: { nombre: texto } },
      ],
    }),
    ...(alerta === "gris"
      ? privada
        ? {
            lote: {
              OR: [
                { precisionVencimiento: { not: "DIA" } },
                { rotuloVencimiento: null },
                { rotuloVencimiento: "" },
              ],
            },
          }
        : { id: { in: [] } }
      : alerta !== "todos" && {
          lote: {
            fechaVencimiento,
            ...(privada && { precisionVencimiento: "DIA" }),
          },
        }),
  };
}

export const GET = pharmacyRoute(async (request, farmacia, db) => {
  const user = await getPharmacyUser(farmacia);
  if (!user || !canOperate(user, "inventario"))
    return Response.json(
      { error: "Sin acceso a inventario." },
      { status: user ? 403 : 401 },
    );
  const params = new URL(request.url).searchParams;
  const vista = vistaSchema.safeParse(params.get("vista"));
  if (!vista.success)
    return Response.json({ error: "Vista inválida." }, { status: 400 });

  const tipo =
    vista.data === "SANITARIA" || vista.data === "TRANSITORIA"
      ? vista.data
      : null;
  const filtros =
    vista.data === "SEGREGAR"
      ? filtrosSegregar.safeParse(Object.fromEntries(params))
      : null;
  if (filtros && !filtros.success)
    return Response.json({ error: "Revisa los filtros." }, { status: 400 });
  const tabla = filtros?.data;
  // pharmacyRoute uses the common schema for typing. Only the private client receives label fields.
  const where = tabla
    ? (filtroSegregar(tabla, farmacia === "privada") as Prisma.StockWhereInput)
    : { cantidad: { gt: 0 } };
  const porPagina = 50;
  const [stocks, casos, totalRows] = await Promise.all([
    tipo
      ? []
      : db.stock.findMany({
          where,
          include: incluir,
          orderBy: [
            tabla
              ? columnas[tabla.ordenar](tabla.direccion)
              : columnas.vencimiento("asc"),
            { id: "asc" },
          ],
          ...(tabla && { skip: tabla.pagina * porPagina, take: porPagina }),
        }),
    tipo
      ? db.casoCuarentena.findMany({
          where: { tipo },
          include: { stock: { include: incluir } },
          orderBy: { id: "desc" },
        })
      : [],
    tabla ? db.stock.count({ where }) : 0,
  ]);
  const lotes = [
    ...new Set(
      [...stocks, ...casos.map((caso) => caso.stock)].map(
        (stock) => stock.loteId,
      ),
    ),
  ];
  const privados =
    farmacia === "privada" && lotes.length
      ? await prismaPrivada.lote.findMany({
          where: { id: { in: lotes } },
          select: {
            id: true,
            precisionVencimiento: true,
            rotuloVencimiento: true,
          },
        })
      : [];
  const rotulos = new Map(privados.map((lote) => [lote.id, lote]));
  function existencia(stock: (typeof stocks)[number]) {
    const rotulo = rotulos.get(stock.loteId);
    return {
      id: stock.id,
      producto: stock.lote.medicamento.nombre,
      lote: stock.lote.numeroLote,
      cantidad: stock.cantidad,
      cantidadBloqueada: stock.cantidadBloqueada,
      ubicacion: stock.ubicacion.nombre,
      vencimiento:
        farmacia === "asistencial" || rotulo?.precisionVencimiento === "DIA"
          ? stockDate(stock.lote.fechaVencimiento)
          : null,
      rotulo: rotulo?.rotuloVencimiento ?? null,
      vencimientoPorVerificar:
        rotulo?.precisionVencimiento === "DIA" && !rotulo.rotuloVencimiento,
    };
  }
  if (tabla)
    return Response.json(
      {
        data: stocks.map(existencia),
        totalRows,
        nextPage:
          (tabla.pagina + 1) * porPagina < totalRows ? tabla.pagina + 1 : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    {
      existencias: stocks
        .map(existencia)
        .filter(
          (stock) =>
            vista.data !== "VENCIDOS" ||
            etiquetaVencimiento(stock.vencimiento).color === "rojo",
        ),
      casos: casos.map(({ stock, ...caso }) => ({
        ...caso,
        existencia: existencia(stock),
      })),
      puedeResolver: canOperate(user, "inventario_liberar"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

class ConflictoInventario extends Error {}

export const POST = pharmacyRoute(async (request, farmacia, db) => {
  const user = await getPharmacyUser(farmacia);
  if (!user || !canOperate(user, "inventario"))
    return Response.json(
      { error: "Sin acceso a inventario." },
      { status: user ? 403 : 401 },
    );
  const parsed = comando.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Revisa la cantidad y escribe un motivo de al menos 3 caracteres.",
      },
      { status: 400 },
    );
  const input = parsed.data;
  if (input.accion === "RESOLVER" && !canOperate(user, "inventario_liberar"))
    return Response.json(
      { error: "No tienes permiso para resolver cuarentenas." },
      { status: 403 },
    );

  try {
    await db.$transaction(async (tx) => {
      if (input.accion === "REGISTRAR") {
        const stock = await tx.stock.findUnique({
          where: { id: input.stockId },
        });
        if (!stock || stock.cantidad - stock.cantidadBloqueada < input.cantidad)
          throw new ConflictoInventario(
            "La cantidad supera el saldo sin bloquear.",
          );
        const actualizado = await tx.stock.updateMany({
          where: {
            id: stock.id,
            cantidad: { gte: stock.cantidadBloqueada + input.cantidad },
            cantidadBloqueada: stock.cantidadBloqueada,
          },
          data: { cantidadBloqueada: { increment: input.cantidad } },
        });
        if (!actualizado.count)
          throw new ConflictoInventario(
            "El saldo cambió. Actualiza e intenta nuevamente.",
          );
        const caso = await tx.casoCuarentena.create({
          data: {
            stockId: stock.id,
            tipo: input.tipo,
            cantidad: input.cantidad,
            motivo: input.motivo,
            registradoPor: user.id,
          },
        });
        await tx.movimientoStock.create({
          data: {
            tipo: "AJUSTE",
            loteId: stock.loteId,
            cantidad: 0,
            motivo: `Cuarentena ${input.tipo.toLowerCase()} #${caso.id} · ${caso.cantidad} unidades · ${input.motivo}`,
            ...(farmacia === "privada" && {
              origen: "CUARENTENA",
              usuarioId: user.id,
              ubicacionId: stock.ubicacionId,
            }),
          },
        });
        return;
      }

      if (input.accion === "RETIRAR_VENCIDO") {
        const stock = await tx.stock.findUnique({
          where: { id: input.stockId },
          include: { lote: true },
        });
        const hoy = stockDate(new Date());
        if (
          !stock ||
          stockDate(stock.lote.fechaVencimiento) >= hoy ||
          ("precisionVencimiento" in stock.lote &&
            (stock.lote.precisionVencimiento !== "DIA" ||
              !(
                "rotuloVencimiento" in stock.lote &&
                stock.lote.rotuloVencimiento
              )))
        )
          throw new ConflictoInventario(
            "La existencia no tiene un vencimiento confirmado anterior a hoy.",
          );
        const actualizado = await tx.stock.updateMany({
          where: {
            id: stock.id,
            cantidad: { gte: stock.cantidadBloqueada + input.cantidad },
            cantidadBloqueada: stock.cantidadBloqueada,
            lote: { fechaVencimiento: stock.lote.fechaVencimiento },
          },
          data: { cantidad: { decrement: input.cantidad } },
        });
        if (!actualizado.count)
          throw new ConflictoInventario(
            "El saldo cambió o incluye unidades en cuarentena.",
          );
        await tx.movimientoStock.create({
          data: {
            tipo: "SALIDA",
            loteId: stock.loteId,
            cantidad: input.cantidad,
            motivo: input.motivo,
            ...(farmacia === "privada" && {
              origen: "RETIRO_FISICO_VENCIDO",
              usuarioId: user.id,
              ubicacionId: stock.ubicacionId,
            }),
          },
        });
        return;
      }

      const caso = await tx.casoCuarentena.findUnique({
        where: { id: input.casoId },
        include: { stock: { include: { lote: true } } },
      });
      if (!caso || caso.resueltoEn)
        throw new ConflictoInventario("El caso ya no está pendiente.");
      const rechazo = input.resolucion === "RECHAZADO";
      const ahora = new Date();
      if (!rechazo && caso.stock.lote.fechaVencimiento <= ahora)
        throw new ConflictoInventario(
          "El lote venció. Registra el retiro físico para cerrar el caso.",
        );
      if (
        !rechazo &&
        "precisionVencimiento" in caso.stock.lote &&
        (caso.stock.lote.precisionVencimiento !== "DIA" ||
          !(
            "rotuloVencimiento" in caso.stock.lote &&
            caso.stock.lote.rotuloVencimiento
          ))
      )
        throw new ConflictoInventario(
          "Confirma primero el vencimiento en Auditoría FEFO.",
        );
      const cerrado = await tx.casoCuarentena.updateMany({
        where: { id: caso.id, resueltoEn: null },
        data: {
          resolucion: input.resolucion,
          motivoResolucion: input.motivo,
          resueltoPor: user.id,
          resueltoEn: ahora,
        },
      });
      if (!cerrado.count)
        throw new ConflictoInventario("El caso ya fue resuelto.");
      const actualizado = await tx.stock.updateMany({
        where: {
          id: caso.stockId,
          cantidadBloqueada: { gte: caso.cantidad },
          ...(!rechazo && { lote: { fechaVencimiento: { gt: new Date() } } }),
        },
        data: {
          cantidadBloqueada: { decrement: caso.cantidad },
          ...(rechazo && { cantidad: { decrement: caso.cantidad } }),
        },
      });
      if (!actualizado.count)
        throw new ConflictoInventario(
          "El saldo o el vencimiento cambió. Actualiza el caso.",
        );
      await tx.movimientoStock.create({
        data: {
          tipo: rechazo ? "SALIDA" : "AJUSTE",
          loteId: caso.stock.loteId,
          cantidad: rechazo ? caso.cantidad : 0,
          motivo: `${rechazo ? "Retiro físico" : "Liberación"} · Cuarentena #${caso.id} · ${caso.cantidad} unidades · ${input.motivo}`,
          ...(farmacia === "privada" && {
            origen: rechazo ? "RETIRO_CUARENTENA" : "LIBERACION_CUARENTENA",
            usuarioId: user.id,
            ubicacionId: caso.stock.ubicacionId,
          }),
        },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ConflictoInventario)
      return Response.json({ error: error.message }, { status: 409 });
    console.error("Cuarentena:", error);
    return Response.json(
      { error: "No se pudo guardar el cambio." },
      { status: 500 },
    );
  }
});
