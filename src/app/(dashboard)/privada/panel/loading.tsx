import { Skeleton } from "@/components/ui/skeleton";
import styles from "./_components/panel.module.css";

export default function PanelLoading() {
  return (
    <section
      className={styles.dashboard}
      role="status"
      aria-label="Cargando dashboard"
    >
      <header className={styles.header}>
        <div>
          <h1>Panel</h1>
          <p>Cargando resumen de ventas e inventario…</p>
        </div>
      </header>
      <div className={styles.metrics}>
        {[0, 1, 2, 3].map((index) => (
          <div className={styles.metric} key={index}>
            <Skeleton style={{ height: 18, width: "60%" }} />
            <Skeleton style={{ height: 36, marginTop: 16 }} />
            <Skeleton style={{ height: 12, width: "80%", marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className={styles.chartsGrid}>
        <div className={styles.card}>
          <Skeleton style={{ height: 320 }} />
        </div>
        <div className={styles.card}>
          <Skeleton style={{ height: 320 }} />
        </div>
      </div>
    </section>
  );
}
