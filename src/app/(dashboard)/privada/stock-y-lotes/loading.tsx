import styles from "@/components/admin-table.module.css";
import { TableSkeleton } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function StockLoading() {
  return (
    <section className={styles.page} aria-label="Cargando stock y lotes">
      <h1 className={styles.title}>Stock y lotes</h1>
      <div className="pos-metrics">
        {["Productos", "Stock bajo", "Vencen en 30 días", "Lotes vencidos"].map(
          (label) => (
            <div key={label}>
              <small>{label}</small>
              <Skeleton style={{ height: 32, width: 60 }} />
            </div>
          ),
        )}
      </div>
      <div className={styles.skeletonToolbar}>
        <div className={styles.skeletonSearch}>
          <span>Filtrar</span>
          <Skeleton style={{ height: 36 }} />
        </div>
        <Button disabled>Añadir stock +</Button>
      </div>
      <TableSkeleton
        headers={[
          "Estado",
          "Producto",
          "Código de barras",
          "Lote",
          "Fabricación",
          "Vencimiento",
          "Ubicación",
          "Stock",
          "Stock mínimo",
          "Precio",
          "Condición de venta",
          "Acciones",
        ]}
      />
    </section>
  );
}
