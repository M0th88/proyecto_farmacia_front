import type { ReactNode } from "react";
import styles from "./admin-table.module.css";

export function RecordDetails({
  fields,
}: {
  fields: Record<string, ReactNode>;
}) {
  return (
    <dl className={styles.details}>
      {Object.entries(fields).map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
