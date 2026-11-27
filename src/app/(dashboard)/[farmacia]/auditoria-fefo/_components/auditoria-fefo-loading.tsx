import styles from "@/components/admin-table.module.css";
import { LoadingLines, LoadingMetrics } from "@/components/section-loading";
import { Skeleton } from "@/components/ui/skeleton";

export function AuditoriaFefoLoading() {
  return (
    <section
      className={styles.page}
      role="status"
      aria-busy="true"
      aria-label="Cargando Auditoría FEFO"
    >
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Auditoría FEFO</h1>
          <Skeleton style={{ width: "min(520px, 80vw)", marginTop: 8 }} />
        </div>
      </header>
      <LoadingMetrics
        labels={[
          "Pendientes / bloqueados",
          "Lotes vencidos para retiro",
          "Próximos según sucursal",
          "Recepciones / devoluciones pendientes",
        ]}
      />
      <section className={styles.card}>
        <h2>Existencias y lista de retiro físico</h2>
        <Skeleton style={{ width: "min(320px, 100%)", height: 40 }} />
        <LoadingLines />
      </section>
      <section className={styles.card}>
        <h2>Recepciones y devoluciones pendientes de revisión</h2>
        <LoadingLines />
      </section>
    </section>
  );
}
