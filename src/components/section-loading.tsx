import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

export function LoadingLines() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Skeleton />
      <Skeleton style={{ width: "85%" }} />
      <Skeleton style={{ width: "65%" }} />
    </div>
  );
}

export function LoadingMetrics({ labels }: { labels: readonly string[] }) {
  return (
    <div className="pos-metrics">
      {labels.map((label) => (
        <div key={label}>
          <small>{label}</small>
          <Skeleton style={{ width: 64, height: 32, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function LoadingPanel({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="pos-panel">
      <header className="pos-title">
        <h2>{title}</h2>
      </header>
      {children ?? <LoadingLines />}
    </section>
  );
}

export function SectionLoading({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="pos-shell"
      role="status"
      aria-busy="true"
      aria-label={title ? `Cargando ${title}` : "Cargando farmacia"}
    >
      <header className="pos-header">
        {title ? (
          <h1>{title}</h1>
        ) : (
          <Skeleton style={{ width: "min(240px, 65%)", height: 28 }} />
        )}
      </header>
      {children ?? <Skeleton style={{ width: "min(400px, 90%)" }} />}
    </section>
  );
}
