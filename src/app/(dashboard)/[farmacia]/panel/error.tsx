"use client";
import { Button } from "@/components/ui/button";
import styles from "./_components/panel.module.css";

export default function PanelError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.dashboard}>
      <h1>Panel</h1>
      <div className={styles.card} role="alert">
        <h2>No se pudo cargar el dashboard</h2>
        <p>Comprueba la conexión e intenta nuevamente.</p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </section>
  );
}
