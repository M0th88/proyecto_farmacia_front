import "server-only";
import { panelDay } from "@/lib/dashboard-summary";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import {
  stockDate,
  stockDaysRemaining,
  stockExpiry,
} from "@/lib/private/stock-dates";
import type { DashboardData } from "@/lib/types/panel";

export async function dashboardSnapshot(): Promise<DashboardData> {
  const now = new Date();
  const today = stockDate(now);
  const start = new Date(stockExpiry(panelDay(today, -60)).getTime() + 1);
  const [sales, products] = await Promise.all([
    prismaPrivada.venta.findMany({
      where: { creadaEn: { gte: start, lte: now } },
      orderBy: { creadaEn: "desc" },
      select: {
        id: true,
        creadaEn: true,
        total: true,
        metodoPago: true,
        detalles: {
          select: {
            medicamentoId: true,
            cantidad: true,
            subtotal: true,
            medicamento: { select: { nombre: true } },
          },
        },
      },
    }),
    prismaPrivada.medicamento.findMany({
      select: {
        id: true,
        nombre: true,
        activo: true,
        stockMinimo: true,
        lotes: {
          select: {
            id: true,
            numeroLote: true,
            fechaVencimiento: true,
            stocks: { select: { cantidad: true } },
          },
        },
      },
    }),
  ]);
  const inventory = { vigente: 0, proximo: 0, vencido: 0 };
  const lows: DashboardData["bajos"] = [];
  const expiries: DashboardData["vencimientos"] = [];
  let availableUnits = 0;
  for (const product of products) {
    let available = 0;
    for (const lot of product.lotes) {
      const quantity = lot.stocks.reduce(
        (sum, stock) => sum + stock.cantidad,
        0,
      );
      const days = stockDaysRemaining(lot.fechaVencimiento, now);
      if (lot.fechaVencimiento <= now) inventory.vencido += quantity;
      else {
        available += quantity;
        if (days <= 30) inventory.proximo += quantity;
        else inventory.vigente += quantity;
      }
      if (quantity > 0 && days <= 30)
        expiries.push({
          id: lot.id,
          nombre: product.nombre,
          lote: lot.numeroLote,
          dias: lot.fechaVencimiento <= now ? Math.min(-1, days) : days,
          cantidad: quantity,
        });
    }
    if (product.activo) availableUnits += available;
    if (
      product.activo &&
      product.stockMinimo > 0 &&
      available <= product.stockMinimo
    )
      lows.push({
        id: product.id,
        nombre: product.nombre,
        cantidad: available,
        minimo: product.stockMinimo,
      });
  }
  lows.sort(
    (a, b) =>
      a.cantidad / a.minimo - b.cantidad / b.minimo ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
  expiries.sort(
    (a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre, "es"),
  );
  return {
    hoy: today,
    actualizado: now.toISOString(),
    productos: products.length,
    activos: products.filter((product) => product.activo).length,
    disponibles: availableUnits,
    inventario: inventory,
    bajos: lows,
    vencimientos: expiries,
    ventas: sales.map((sale) => ({
      id: sale.id,
      fecha: sale.creadaEn.toISOString(),
      dia: stockDate(sale.creadaEn),
      total: Number(sale.total),
      metodo: sale.metodoPago,
      items: sale.detalles.map((item) => ({
        medicamentoId: item.medicamentoId,
        nombre: item.medicamento.nombre,
        cantidad: item.cantidad,
        subtotal: Number(item.subtotal),
      })),
    })),
  };
}
