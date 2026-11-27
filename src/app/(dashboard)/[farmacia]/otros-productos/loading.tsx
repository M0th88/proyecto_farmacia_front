import styles from "@/components/admin-table.module.css";
import { TableSkeleton } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className={styles.page} aria-label="Cargando otros productos">
      <h1 className={styles.title}>Otros Productos</h1>
      <div className={styles.skeletonSearch}>
        <span>Filtrar</span>
        <Skeleton style={{ height: 36 }} />
      </div>
      <TableSkeleton
        headers={[
          "Estado",
          "Producto",
          "Código de barras",
          "Código de catálogo",
          "Categoría",
          "Precio venta",
          "Stock físico",
          "Acciones",
        ]}
      />
    </section>
  );
}
