import type { StockMetrics as Metrics } from "@/lib/types/stock-y-lotes";

export function StockMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="pos-metrics">
      <div>
        <small>Productos</small>
        <strong>{metrics.productos}</strong>
      </div>
      <div>
        <small>Stock bajo</small>
        <strong>{metrics.bajo}</strong>
      </div>
      <div>
        <small>Vencen en 30 días</small>
        <strong>{metrics.proximos}</strong>
      </div>
      <div>
        <small>Lotes vencidos</small>
        <strong>{metrics.vencidos}</strong>
      </div>
    </div>
  );
}
