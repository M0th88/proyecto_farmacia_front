import "server-only";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import { prismaAsistencial } from "@/lib/db/prisma-asistencial";
import { prismaPrivada } from "@/lib/db/prisma-privada";

export const TIPOS_MOVIMIENTO = [
  "ENTRADA",
  "SALIDA",
  "AJUSTE",
  "TRASPASO",
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];
export const PERIODOS = [7, 30, 90, 365] as const;

export type FiltroHistorico = {
  tipo?: TipoMovimiento;
  busqueda: string;
  dias: (typeof PERIODOS)[number];
};

export type Movimiento = {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  cantidad: number;
  producto: string;
  lote: string;
  motivo: string;
  ubicacion: string | null;
  usuario: string | null;
};

const LIMITE = 300;
const fechaHora = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  hourCycle: "h23",
  timeZone: "America/Santiago",
});

function filtros({ tipo, busqueda, dias }: FiltroHistorico) {
  const q = busqueda.trim();
  return {
    creadoEn: { gte: new Date(Date.now() - dias * 86_400_000) },
    tipo,
    ...(q && {
      OR: [
        { motivo: { contains: q, mode: "insensitive" as const } },
        { lote: { numeroLote: { contains: q, mode: "insensitive" as const } } },
        {
          lote: {
            medicamento: {
              nombre: { contains: q, mode: "insensitive" as const },
            },
          },
        },
      ],
    }),
  };
}

/** Movimientos de stock del período (más recientes primero) y totales por tipo. */
export async function historicoInventario(
  pharmacy: Pharmacy,
  filtro: FiltroHistorico,
) {
  const where = filtros(filtro);
  const lote = {
    select: {
      numeroLote: true,
      medicamento: { select: { nombre: true } },
    },
  };
  let movimientos: Movimiento[];
  let totales: { tipo: string; unidades: number; registros: number }[];

  if (pharmacy === "privada") {
    const [filas, grupos] = await Promise.all([
      prismaPrivada.movimientoStock.findMany({
        where,
        orderBy: { id: "desc" },
        take: LIMITE,
        include: { lote },
      }),
      prismaPrivada.movimientoStock.groupBy({
        by: ["tipo"],
        where,
        _sum: { cantidad: true },
        _count: true,
      }),
    ]);
    const [usuarios, ubicaciones] = await Promise.all([
      prismaPrivada.usuario.findMany({
        where: {
          id: { in: [...new Set(filas.flatMap((f) => f.usuarioId ?? []))] },
        },
        select: { id: true, nombre: true, apellido: true },
      }),
      prismaPrivada.ubicacionInventario.findMany({
        where: {
          id: { in: [...new Set(filas.flatMap((f) => f.ubicacionId ?? []))] },
        },
        select: { id: true, nombre: true },
      }),
    ]);
    const usuario = new Map(
      usuarios.map((u) => [
        u.id,
        [u.nombre, u.apellido].filter(Boolean).join(" "),
      ]),
    );
    const ubicacion = new Map(ubicaciones.map((u) => [u.id, u.nombre]));
    movimientos = filas.map((f) => ({
      id: f.id,
      fecha: fechaHora.format(f.creadoEn),
      tipo: f.tipo,
      cantidad: f.cantidad,
      producto: f.lote.medicamento.nombre,
      lote: f.lote.numeroLote,
      motivo: f.motivo ?? f.origen ?? "",
      ubicacion: f.ubicacionId ? (ubicacion.get(f.ubicacionId) ?? null) : null,
      usuario: f.usuarioId ? (usuario.get(f.usuarioId) ?? null) : null,
    }));
    totales = grupos.map((g) => ({
      tipo: g.tipo,
      unidades: g._sum.cantidad ?? 0,
      registros: g._count,
    }));
  } else {
    const [filas, grupos] = await Promise.all([
      prismaAsistencial.movimientoStock.findMany({
        where,
        orderBy: { id: "desc" },
        take: LIMITE,
        include: { lote },
      }),
      prismaAsistencial.movimientoStock.groupBy({
        by: ["tipo"],
        where,
        _sum: { cantidad: true },
        _count: true,
      }),
    ]);
    movimientos = filas.map((f) => ({
      id: f.id,
      fecha: fechaHora.format(f.creadoEn),
      tipo: f.tipo,
      cantidad: f.cantidad,
      producto: f.lote.medicamento.nombre,
      lote: f.lote.numeroLote,
      motivo: f.motivo ?? "",
      ubicacion: null,
      usuario: null,
    }));
    totales = grupos.map((g) => ({
      tipo: g.tipo,
      unidades: g._sum.cantidad ?? 0,
      registros: g._count,
    }));
  }
  const total = (tipo: TipoMovimiento) =>
    totales.find((t) => t.tipo === tipo) ?? { unidades: 0, registros: 0 };
  return {
    movimientos,
    limite: LIMITE,
    resumen: {
      entradas: total("ENTRADA"),
      salidas: total("SALIDA"),
      ajustes: total("AJUSTE"),
      registros: totales.reduce((n, t) => n + t.registros, 0),
    },
  };
}
