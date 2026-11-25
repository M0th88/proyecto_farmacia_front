import "server-only";
import { z } from "zod";
import type { PharmacyDb } from "@/lib/db/pharmacy-db";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { stockDisponibleFefo } from "@/lib/fefo";
import type { PaginationResponse } from "@/lib/types/pagination";
import type { StockMetrics, StockRow } from "@/lib/types/stock-y-lotes";
import { stockDaysRemaining } from "./stock-dates";

export const stockListSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(200).default(""),
  sort: z
    .enum([
      "nombre",
      "codigo",
      "condicion",
      "minimo",
      "precio",
      "numeroLote",
      "fechaFabricacion",
      "fechaVencimiento",
      "ubicacion",
      "cantidad",
      "estado",
    ])
    .default("nombre"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export async function stockSnapshot(db?: PharmacyDb) {
  const query = {
    orderBy: { nombre: "asc" },
    include: {
      lotes: {
        orderBy: { fechaVencimiento: "asc" },
        include: { stocks: { include: { ubicacion: true } } },
      },
    },
  } as const;
  const products = db
    ? await db.medicamento.findMany(query)
    : await prismaPrivada.medicamento.findMany(query);
  const now = new Date();
  const metrics: StockMetrics = {
    productos: products.length,
    bajo: 0,
    proximos: 0,
    vencidos: 0,
  };
  const rows: StockRow[] = [];
  for (const product of products) {
    const available = product.lotes
      .filter((lot) => lot.fechaVencimiento > now)
      .reduce(
        (sum, lot) =>
          sum +
          lot.stocks
            .filter((stock) => db || stockDisponibleFefo(stock, lot, now))
            .reduce((n, stock) => n + stock.cantidad, 0),
        0,
      );
    if (product.stockMinimo > 0 && available <= product.stockMinimo)
      metrics.bajo++;
    const base = {
      medicamentoId: product.id,
      nombre: product.nombre,
      codigo: product.codigoBarra,
      condicion: product.condicionVenta.replaceAll("_", " "),
      minimo: product.stockMinimo,
      precio: product.precioVenta === null ? null : Number(product.precioVenta),
    };
    if (!product.lotes.length)
      rows.push({
        ...base,
        id: `producto-${product.id}`,
        loteId: null,
        stockId: null,
        numeroLote: null,
        fechaFabricacion: null,
        fechaVencimiento: null,
        ubicacion: null,
        cantidad: 0,
        diasParaVencer: null,
        estado: "Sin lotes",
      });
    for (const lot of product.lotes) {
      const quantity = lot.stocks.reduce(
        (sum, stock) => sum + stock.cantidad,
        0,
      );
      const expired = lot.fechaVencimiento <= now;
      const days = stockDaysRemaining(lot.fechaVencimiento, now);
      const near = !expired && days <= 30;
      if (quantity > 0 && expired) metrics.vencidos++;
      if (quantity > 0 && near) metrics.proximos++;
      const common = {
        ...base,
        loteId: lot.id,
        numeroLote: lot.numeroLote,
        fechaFabricacion: lot.fechaFabricacion?.toISOString() ?? null,
        fechaVencimiento: lot.fechaVencimiento.toISOString(),
        diasParaVencer: days,
        estado: expired
          ? ("Vencido" as const)
          : days === 0
            ? ("Vence hoy" as const)
            : days === 1
              ? ("Vence en 1 día" as const)
              : (`Vence en ${days} días` as const),
      };
      if (!lot.stocks.length)
        rows.push({
          ...common,
          id: `lote-${lot.id}`,
          stockId: null,
          ubicacion: null,
          cantidad: 0,
        });
      for (const stock of lot.stocks)
        rows.push({
          ...common,
          estado:
            expired ||
            db ||
            !("estado" in lot) ||
            typeof lot.estado !== "string"
              ? common.estado
              : lot.estado !== "APTO"
                ? lot.estado.replaceAll("_", " ")
                : !("fechaRecepcion" in stock) ||
                    !stock.fechaRecepcion ||
                    !("sucursalId" in stock.ubicacion) ||
                    !stock.ubicacion.sucursalId
                  ? "Pendiente de conciliación"
                  : common.estado,
          id: `stock-${stock.id}`,
          stockId: stock.id,
          ubicacion: stock.ubicacion.nombre,
          cantidad: stock.cantidad,
        });
    }
  }
  return { rows, metrics };
}

export function paginateStock(
  rows: StockRow[],
  options: z.infer<typeof stockListSchema>,
): PaginationResponse<StockRow> {
  const { page, pageSize, search, sort, direction } = options;
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  const filtered = rows.filter((row) =>
    normalize(
      [
        row.nombre,
        row.codigo,
        row.numeroLote,
        row.ubicacion,
        row.estado,
        row.condicion,
      ].join(" "),
    ).includes(normalize(search)),
  );
  filtered.sort((a, b) => {
    const x = a[sort],
      y = b[sort];
    const comparison =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x ?? "").localeCompare(String(y ?? ""), "es", {
            numeric: true,
          });
    return (
      (direction === "desc" ? -comparison : comparison) ||
      a.id.localeCompare(b.id)
    );
  });
  const start = page * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    totalRows: filtered.length,
    nextPage: start + pageSize < filtered.length ? page + 1 : null,
  };
}
