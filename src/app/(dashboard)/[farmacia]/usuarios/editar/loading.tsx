import styles from "@/components/admin-table.module.css";
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <section
      className={styles.page}
      role="status"
      aria-label="Cargando edición de usuario"
    >
      <Skeleton style={{ width: 240, height: 28 }} />
      <Skeleton style={{ height: 320 }} />
      <Skeleton style={{ height: 240 }} />
    </section>
  );
}
