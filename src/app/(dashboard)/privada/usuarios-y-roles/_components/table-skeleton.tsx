import { TableSkeleton } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { userTableHeaders } from "./table-config";
import styles from "./usuarios-table.module.css";

export function UsersTableSkeleton() {
  return (
    <section className={styles.page} aria-label="Cargando usuarios y roles">
      <h1 className={styles.title}>Usuarios y roles</h1>
      <div className={styles.skeletonToolbar}>
        <div className={styles.skeletonSearch}>
          <span>Filtrar</span>
          <Skeleton style={{ height: 36 }} />
        </div>
        <Button disabled>Crear usuario +</Button>
      </div>
      <TableSkeleton headers={userTableHeaders} />
    </section>
  );
}
