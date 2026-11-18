import styles from "@/components/admin-table.module.css";
import { TableSkeleton } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Productos</h1>
      <div className="pos-metrics">
        {[
          "Productos",
          "Sin precio",
          "Sin código de barras",
          "Sin clasificar",
        ].map((label) => (
          <div key={label}>
            <small>{label}</small>
            <Skeleton style={{ height: 32, marginTop: 9 }} />
          </div>
        ))}
      </div>
      <div className={styles.skeletonToolbar}>
        <div className={styles.skeletonSearch}>
          <span>Filtrar</span>
          <Skeleton style={{ height: 36 }} />
        </div>
        <Button disabled>Añadir productos +</Button>
      </div>
      <TableSkeleton
        headers={[
          "Estado",
          "ID",
          "Producto",
          "Código de barras",
          "Código de catálogo",
          "Categoría",
          "Principio activo",
          "Concentración",
          "Forma farmacéutica",
          "Condición de venta",
          "Precio venta",
          "Código ATC",
          "Fuente del catálogo",
          "Acciones",
        ]}
      />
    </section>
  );
}
