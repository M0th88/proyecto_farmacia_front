import styles from "@/components/admin-table.module.css";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <section className={styles.page} aria-label="Cargando configuración">
      <h1 className={styles.title}>Configuración</h1>
      <Skeleton style={{ height: 360 }} />
    </section>
  );
}
