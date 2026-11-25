import type { ProductMetrics as Metrics } from "@/lib/types/productos";

export function ProductMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="pos-metrics">
      <div>
        <small>Productos</small>
        <strong>{metrics.productos}</strong>
      </div>
      <div>
        <small>Sin precio</small>
        <strong>{metrics.sinPrecio}</strong>
      </div>
      <div>
        <small>Sin código de barras</small>
        <strong>{metrics.sinCodigo}</strong>
      </div>
      <div>
        <small>Sin clasificar</small>
        <strong>{metrics.sinClasificar}</strong>
      </div>
    </div>
  );
}
