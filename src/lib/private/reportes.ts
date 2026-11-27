import "server-only";
import type { PharmacyDb } from "@/lib/db/pharmacy-db";
import { calcularTotales } from "@/lib/validation/punto-de-venta";

export const TIPOS_REPORTE = {
  ventas: {
    titulo: "Ventas",
    permisos: ["ventas", "indicadores"],
    usaFechas: true,
  },
  productos: {
    titulo: "Productos vendidos",
    permisos: ["ventas", "indicadores"],
    usaFechas: true,
  },
  inventario: {
    titulo: "Inventario por lote",
    permisos: ["inventario"],
    usaFechas: false,
  },
  categorias: {
    titulo: "Stock por categoría",
    permisos: ["inventario", "indicadores"],
    usaFechas: false,
  },
} as const;
export type TipoReporte = keyof typeof TIPOS_REPORTE;
export const esTipoReporte = (v: string): v is TipoReporte =>
  Object.hasOwn(TIPOS_REPORTE, v);

export type ColumnaReporte = {
  clave: string;
  titulo: string;
  formato?: "pesos" | "entero" | "fecha";
  ancho?: number;
};
export type FilaReporte = Record<string, string | number | Date | null>;
export type Reporte = {
  titulo: string;
  subtitulo: string;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
  totales?: FilaReporte;
};

const ZONA = "America/Santiago";
const diaChile = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const fechaHoraChile = (d: Date) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);

/** Convierte un día "YYYY-MM-DD" de Chile en el instante UTC de su inicio. */
function inicioDiaChile(dia: string) {
  const base = new Date(`${dia}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    timeZoneName: "longOffset",
  })
    .formatToParts(base)
    .find((p) => p.type === "timeZoneName")
    ?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!offset) return base;
  const minutos =
    (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "-" ? -1 : 1);
  return new Date(base.getTime() - minutos * 60_000);
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

/** Valida el rango; por defecto los últimos 30 días en hora de Chile. */
export function rangoReporte(desde?: string | null, hasta?: string | null) {
  const hoy = diaChile(new Date());
  const fin = hasta && DIA.test(hasta) ? hasta : hoy;
  const inicio =
    desde && DIA.test(desde)
      ? desde
      : diaChile(new Date(inicioDiaChile(fin).getTime() - 29 * 86_400_000));
  if (inicio > fin) return { error: "La fecha inicial supera a la final." };
  const gte = inicioDiaChile(inicio);
  const finExclusivo = new Date(inicioDiaChile(fin).getTime() + 36 * 3_600_000);
  const lt = inicioDiaChile(diaChile(finExclusivo));
  if ((lt.getTime() - gte.getTime()) / 86_400_000 > MAX_DIAS)
    return { error: `El rango no puede superar ${MAX_DIAS} días.` };
  return { desde: inicio, hasta: fin, gte, lt };
}

const METODO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

async function reporteVentas(
  db: PharmacyDb,
  gte: Date,
  lt: Date,
): Promise<Omit<Reporte, "titulo" | "subtitulo">> {
  const ventas = await db.venta.findMany({
    where: { creadaEn: { gte, lt } },
    orderBy: { creadaEn: "asc" },
    select: {
      id: true,
      creadaEn: true,
      metodoPago: true,
      tipoDocumento: true,
      subtotal: true,
      descuento: true,
      neto: true,
      iva: true,
      total: true,
      _count: { select: { detalles: true } },
    },
  });
  const filas = ventas.map((v) => {
    const total = Number(v.total);
    const descuento = Number(v.descuento);
    // Ventas anteriores a la migración de documentos POS no guardaron el
    // desglose; se reconstruye con la misma fórmula del POS (IVA incluido).
    const desglose =
      v.neto === null || v.iva === null
        ? calcularTotales(total + descuento, descuento)
        : { neto: Number(v.neto), iva: Number(v.iva) };
    return {
      numero: v.id,
      fecha: fechaHoraChile(v.creadaEn),
      documento: v.tipoDocumento === "FACTURA" ? "Factura" : "Boleta",
      pago: METODO[v.metodoPago] ?? v.metodoPago,
      items: v._count.detalles,
      subtotal: Number(v.subtotal) || total + descuento,
      descuento,
      neto: desglose.neto,
      iva: desglose.iva,
      total,
    };
  });
  const suma = (k: keyof (typeof filas)[number]) =>
    filas.reduce((n, f) => n + Number(f[k]), 0);
  return {
    columnas: [
      { clave: "numero", titulo: "N° venta", formato: "entero", ancho: 10 },
      { clave: "fecha", titulo: "Fecha", ancho: 18 },
      { clave: "documento", titulo: "Documento", ancho: 12 },
      { clave: "pago", titulo: "Medio de pago", ancho: 15 },
      { clave: "items", titulo: "Ítems", formato: "entero", ancho: 8 },
      { clave: "subtotal", titulo: "Subtotal", formato: "pesos", ancho: 14 },
      { clave: "descuento", titulo: "Descuento", formato: "pesos", ancho: 13 },
      { clave: "neto", titulo: "Neto", formato: "pesos", ancho: 14 },
      { clave: "iva", titulo: "IVA", formato: "pesos", ancho: 12 },
      { clave: "total", titulo: "Total", formato: "pesos", ancho: 14 },
    ],
    filas,
    totales: {
      numero: null,
      fecha: `${filas.length} ventas`,
      documento: null,
      pago: null,
      items: suma("items"),
      subtotal: suma("subtotal"),
      descuento: suma("descuento"),
      neto: suma("neto"),
      iva: suma("iva"),
      total: suma("total"),
    },
  };
}

async function reporteProductos(
  db: PharmacyDb,
  gte: Date,
  lt: Date,
): Promise<Omit<Reporte, "titulo" | "subtitulo">> {
  const grupos = await db.detalleVenta.groupBy({
    by: ["medicamentoId"],
    where: { venta: { creadaEn: { gte, lt } } },
    _sum: { cantidad: true, subtotal: true },
    _count: { ventaId: true },
  });
  const meds = await db.medicamento.findMany({
    where: { id: { in: grupos.map((g) => g.medicamentoId) } },
    select: {
      id: true,
      nombre: true,
      codigoBarra: true,
      categoria: { select: { nombre: true } },
    },
  });
  const porId = new Map(meds.map((m) => [m.id, m]));
  const filas = grupos
    .map((g) => {
      const m = porId.get(g.medicamentoId);
      return {
        producto: m?.nombre ?? `#${g.medicamentoId}`,
        codigo: m?.codigoBarra ?? "",
        categoria: m?.categoria?.nombre ?? "Sin clasificar",
        lineas: g._count.ventaId,
        unidades: g._sum.cantidad ?? 0,
        monto: Number(g._sum.subtotal ?? 0),
      };
    })
    .sort((a, b) => b.monto - a.monto);
  return {
    columnas: [
      { clave: "producto", titulo: "Producto", ancho: 38 },
      { clave: "codigo", titulo: "Código de barras", ancho: 18 },
      { clave: "categoria", titulo: "Categoría", ancho: 22 },
      { clave: "lineas", titulo: "Ventas", formato: "entero", ancho: 9 },
      { clave: "unidades", titulo: "Unidades", formato: "entero", ancho: 10 },
      { clave: "monto", titulo: "Monto vendido", formato: "pesos", ancho: 15 },
    ],
    filas,
    totales: {
      producto: `${filas.length} productos`,
      codigo: null,
      categoria: null,
      lineas: filas.reduce((n, f) => n + f.lineas, 0),
      unidades: filas.reduce((n, f) => n + f.unidades, 0),
      monto: filas.reduce((n, f) => n + f.monto, 0),
    },
  };
}

async function reporteInventario(
  db: PharmacyDb,
): Promise<Omit<Reporte, "titulo" | "subtitulo">> {
  const stocks = await db.stock.findMany({
    where: { cantidad: { gt: 0 } },
    select: {
      cantidad: true,
      ubicacion: { select: { nombre: true, tipo: true } },
      lote: {
        select: {
          numeroLote: true,
          fechaVencimiento: true,
          medicamento: {
            select: {
              nombre: true,
              stockMinimo: true,
              categoria: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });
  const hoy = inicioDiaChile(diaChile(new Date())).getTime();
  const filas = stocks
    .map((s) => {
      const dias = Math.floor(
        (s.lote.fechaVencimiento.getTime() - hoy) / 86_400_000,
      );
      return {
        producto: s.lote.medicamento.nombre,
        categoria: s.lote.medicamento.categoria?.nombre ?? "Sin clasificar",
        lote: s.lote.numeroLote,
        vencimiento: s.lote.fechaVencimiento.toISOString().slice(0, 10),
        ubicacion: `${s.ubicacion.nombre} (${s.ubicacion.tipo === "BODEGA" ? "Bodega" : "Vitrina"})`,
        cantidad: s.cantidad,
        estado:
          dias < 0
            ? "Vencido"
            : dias <= 30
              ? "Por vencer (30 días)"
              : "Vigente",
      };
    })
    .sort(
      (a, b) =>
        a.vencimiento.localeCompare(b.vencimiento) ||
        a.producto.localeCompare(b.producto),
    );
  return {
    columnas: [
      { clave: "producto", titulo: "Producto", ancho: 36 },
      { clave: "categoria", titulo: "Categoría", ancho: 22 },
      { clave: "lote", titulo: "Lote", ancho: 14 },
      { clave: "vencimiento", titulo: "Vencimiento", ancho: 13 },
      { clave: "ubicacion", titulo: "Ubicación", ancho: 22 },
      { clave: "cantidad", titulo: "Unidades", formato: "entero", ancho: 10 },
      { clave: "estado", titulo: "Estado", ancho: 16 },
    ],
    filas,
    totales: {
      producto: `${filas.length} registros`,
      categoria: null,
      lote: null,
      vencimiento: null,
      ubicacion: null,
      cantidad: filas.reduce((n, f) => n + f.cantidad, 0),
      estado: null,
    },
  };
}

async function reporteCategorias(
  db: PharmacyDb,
): Promise<Omit<Reporte, "titulo" | "subtitulo">> {
  const meds = await db.medicamento.findMany({
    where: { activo: true },
    select: {
      stockMinimo: true,
      categoria: { select: { nombre: true } },
      lotes: {
        select: {
          fechaVencimiento: true,
          stocks: { select: { cantidad: true } },
        },
      },
    },
  });
  const ahora = Date.now();
  const grupos = new Map<
    string,
    {
      productos: number;
      unidades: number;
      bajoMinimo: number;
      vencidas: number;
    }
  >();
  for (const m of meds) {
    const clave = m.categoria?.nombre ?? "Sin clasificar";
    const g = grupos.get(clave) ?? {
      productos: 0,
      unidades: 0,
      bajoMinimo: 0,
      vencidas: 0,
    };
    let vigentes = 0;
    for (const l of m.lotes) {
      const u = l.stocks.reduce((n, s) => n + s.cantidad, 0);
      if (l.fechaVencimiento.getTime() < ahora) g.vencidas += u;
      else vigentes += u;
    }
    g.productos += 1;
    g.unidades += vigentes;
    if (vigentes <= m.stockMinimo) g.bajoMinimo += 1;
    grupos.set(clave, g);
  }
  const filas = [...grupos]
    .map(([categoria, g]) => ({ categoria, ...g }))
    .sort((a, b) => b.unidades - a.unidades);
  const suma = (k: "productos" | "unidades" | "bajoMinimo" | "vencidas") =>
    filas.reduce((n, f) => n + f[k], 0);
  return {
    columnas: [
      { clave: "categoria", titulo: "Categoría", ancho: 32 },
      { clave: "productos", titulo: "Productos", formato: "entero", ancho: 11 },
      {
        clave: "unidades",
        titulo: "Unidades vigentes",
        formato: "entero",
        ancho: 17,
      },
      {
        clave: "bajoMinimo",
        titulo: "Bajo stock mínimo",
        formato: "entero",
        ancho: 17,
      },
      {
        clave: "vencidas",
        titulo: "Unidades vencidas",
        formato: "entero",
        ancho: 17,
      },
    ],
    filas,
    totales: {
      categoria: `${filas.length} categorías`,
      productos: suma("productos"),
      unidades: suma("unidades"),
      bajoMinimo: suma("bajoMinimo"),
      vencidas: suma("vencidas"),
    },
  };
}

export async function generarReporte(
  db: PharmacyDb,
  tipo: TipoReporte,
  farmacia: string,
  rango: { desde: string; hasta: string; gte: Date; lt: Date },
): Promise<Reporte> {
  const { titulo, usaFechas } = TIPOS_REPORTE[tipo];
  const datos =
    tipo === "ventas"
      ? await reporteVentas(db, rango.gte, rango.lt)
      : tipo === "productos"
        ? await reporteProductos(db, rango.gte, rango.lt)
        : tipo === "inventario"
          ? await reporteInventario(db)
          : await reporteCategorias(db);
  const nombreFarmacia =
    farmacia === "asistencial" ? "Farmacia Asistencial" : "Farmacia Privada";
  const periodo = usaFechas
    ? `Período ${rango.desde} a ${rango.hasta}`
    : `Existencias al ${fechaHoraChile(new Date())}`;
  return { titulo, subtitulo: `${nombreFarmacia} · ${periodo}`, ...datos };
}
