import type { DashboardData } from "@/lib/types/panel";

export function panelDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function dashboardSummary(data: DashboardData, days: number) {
  const start = panelDay(data.hoy, 1 - days);
  const previousStart = panelDay(start, -days);
  const sales = data.ventas.filter(
    (sale) => sale.dia >= start && sale.dia <= data.hoy,
  );
  const previous = data.ventas.filter(
    (sale) => sale.dia >= previousStart && sale.dia < start,
  );
  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  const previousTotal = previous.reduce((sum, sale) => sum + sale.total, 0);
  const daily = Array.from({ length: days }, (_, index) => {
    const day = panelDay(start, index);
    return {
      dia: day,
      total: sales
        .filter((sale) => sale.dia === day)
        .reduce((sum, sale) => sum + sale.total, 0),
    };
  });
  const payments = [
    ["EFECTIVO", "Efectivo"],
    ["DEBITO", "Débito"],
    ["CREDITO", "Crédito"],
    ["TRANSFERENCIA", "Transferencia"],
  ].map(([id, label]) => ({
    id,
    label,
    total: sales
      .filter((sale) => sale.metodo === id)
      .reduce((sum, sale) => sum + sale.total, 0),
  }));
  const productMap = new Map<
    number,
    { id: number; nombre: string; cantidad: number; total: number }
  >();
  for (const sale of sales)
    for (const item of sale.items) {
      const product = productMap.get(item.medicamentoId) ?? {
        id: item.medicamentoId,
        nombre: item.nombre,
        cantidad: 0,
        total: 0,
      };
      product.cantidad += item.cantidad;
      product.total += item.subtotal;
      productMap.set(product.id, product);
    }
  return {
    sales,
    total,
    previousTotal,
    previousCount: previous.length,
    average: sales.length ? total / sales.length : 0,
    daily,
    payments,
    top: [...productMap.values()]
      .sort(
        (a, b) =>
          b.cantidad - a.cantidad ||
          b.total - a.total ||
          a.nombre.localeCompare(b.nombre, "es"),
      )
      .slice(0, 5),
  };
}
