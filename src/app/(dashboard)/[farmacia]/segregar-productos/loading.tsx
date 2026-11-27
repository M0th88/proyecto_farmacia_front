import styles from "@/components/admin-table.module.css";
import { TableSkeleton } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { columnasSegregar } from "./_components/table-config";

export default function Loading() {
  return (
    <section className={styles.page} aria-label="Cargando existencias">
      <h1 className={styles.title}>Segregar Productos</h1>
      <div className={styles.skeletonToolbar}>
        <div className={styles.skeletonSearch}>
          <span>Filtrar</span>
          <Skeleton style={{ height: 36 }} />
        </div>
      </div>
      <TableSkeleton headers={Object.values(columnasSegregar)} />
    </section>
  );
}
